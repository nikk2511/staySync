const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'music-app',
      audience: 'music-app-users'
    }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      issuer: 'music-app',
      audience: 'music-app-users'
    }
  );
};

// Verify JWT token
const verifyToken = (token, secret = process.env.JWT_SECRET) => {
  try {
    return jwt.verify(token, secret, {
      issuer: 'music-app',
      audience: 'music-app-users'
    });
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Middleware to authenticate token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies.token;
    
    let token = null;
    
    // Check for token in Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // Check for token in cookies
    else if (cookieToken) {
      token = cookieToken;
    }
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token. User not found.' 
      });
    }
    
    // Attach user to request
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    
    res.status(401).json({ error: 'Authentication failed.' });
  }
};

// Middleware to authenticate optional token (doesn't fail if no token)
const authenticateOptionalToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies.token;
    
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (cookieToken) {
      token = cookieToken;
    }
    
    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user) {
        req.user = user;
        req.userId = user._id;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Middleware to check if user is room host
const requireRoomHost = (req, res, next) => {
  // This middleware should be used after authenticateToken and after room is loaded
  if (!req.room) {
    return res.status(400).json({ error: 'Room not found in request.' });
  }
  
  if (req.room.hostId.toString() !== req.userId.toString()) {
    return res.status(403).json({ 
      error: 'Access denied. Only room host can perform this action.' 
    });
  }
  
  next();
};

// Middleware to check if user is room member
const requireRoomMember = (req, res, next) => {
  if (!req.room) {
    return res.status(400).json({ error: 'Room not found in request.' });
  }
  
  const isMember = req.room.members.some(member => {
    // Handle both populated and unpopulated userId
    const memberUserId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
    return memberUserId === req.userId.toString();
  });
  
  if (!isMember) {
    return res.status(403).json({ 
      error: 'Access denied. You must be a room member to perform this action.' 
    });
  }
  
  next();
};

// Middleware to check if user is room moderator or host
const requireRoomModerator = (req, res, next) => {
  if (!req.room) {
    return res.status(400).json({ error: 'Room not found in request.' });
  }
  
  const member = req.room.members.find(member => {
    // Handle both populated and unpopulated userId
    const memberUserId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
    return memberUserId === req.userId.toString();
  });
  
  if (!member || !['host', 'moderator'].includes(member.role)) {
    return res.status(403).json({ 
      error: 'Access denied. You must be a room moderator or host to perform this action.' 
    });
  }
  
  next();
};

// Middleware to refresh token
const refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token not provided.' });
    }
    
    const decoded = verifyToken(
      refreshToken, 
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }
    
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }
    
    // Generate new tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    
    // Set cookies
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    req.user = user;
    req.userId = user._id;
    req.newToken = newToken;
    
    next();
  } catch (error) {
    console.error('Token refresh error:', error.message);
    res.status(401).json({ error: 'Token refresh failed.' });
  }
};

// Set token cookies
const setTokenCookies = (res, userId) => {
  const token = generateToken(userId);
  const refreshToken = generateRefreshToken(userId);
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
  
  return { token, refreshToken };
};

// Clear token cookies
const clearTokenCookies = (res) => {
  res.clearCookie('token');
  res.clearCookie('refreshToken');
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  authenticateToken,
  authenticateOptionalToken,
  requireRoomHost,
  requireRoomMember,
  requireRoomModerator,
  refreshToken,
  setTokenCookies,
  clearTokenCookies
};