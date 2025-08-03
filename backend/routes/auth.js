const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const passport = require('../config/passport');
const User = require('../models/User');
const { 
  generateToken, 
  authenticateToken, 
  setTokenCookies, 
  clearTokenCookies,
  refreshToken
} = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerValidation, handleValidationErrors, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'User already exists with this email' 
      });
    }
    
    // Create new user
    const user = new User({
      name,
      email,
      password
    });
    
    await user.save();
    
    // Set authentication cookies
    const { token } = setTokenCookies(res, user._id);
    
    // Update user stats
    user.stats.roomsJoined += 1;
    await user.save();
    
    res.status(201).json({
      message: 'User registered successfully',
      user: user.toSafeObject(),
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed. Please try again.' 
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid email or password' 
      });
    }
    
    // Check if user has a password (not OAuth only)
    if (!user.password) {
      return res.status(400).json({ 
        error: 'Please use Google sign-in for this account' 
      });
    }
    
    // Validate password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(400).json({ 
        error: 'Invalid email or password' 
      });
    }
    
    // Update user online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();
    
    // Set authentication cookies
    const { token } = setTokenCookies(res, user._id);
    
    res.json({
      message: 'Login successful',
      user: user.toSafeObject(),
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed. Please try again.' 
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Update user online status
    await User.findByIdAndUpdate(req.userId, {
      isOnline: false,
      lastSeen: new Date(),
      currentRoom: null
    });
    
    // Clear authentication cookies
    clearTokenCookies(res);
    
    res.json({ message: 'Logout successful' });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Logout failed. Please try again.' 
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('rooms', 'name isPrivate memberCount')
      .populate('currentRoom', 'name isPrivate memberCount');
    
    res.json({
      user: user.toSafeObject()
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Failed to get user information' 
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', refreshToken, (req, res) => {
  res.json({
    message: 'Token refreshed successfully',
    user: req.user.toSafeObject(),
    token: req.newToken
  });
});

// @route   GET /api/auth/google
// @desc    Start Google OAuth flow
// @access  Public
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// @route   GET /api/auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
    session: false 
  }),
  async (req, res) => {
    try {
      // Update user online status
      req.user.isOnline = true;
      req.user.lastSeen = new Date();
      await req.user.save();
      
      // Set authentication cookies
      const { token } = setTokenCookies(res, req.user._id);
      
      // Redirect to frontend with success
      res.redirect(`${process.env.CLIENT_URL}/dashboard?auth=success`);
      
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_callback_failed`);
    }
  }
);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', 
  authenticateToken,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('preferences.theme')
      .optional()
      .isIn(['light', 'dark'])
      .withMessage('Theme must be light or dark'),
    body('preferences.notifications')
      .optional()
      .isBoolean()
      .withMessage('Notifications must be a boolean'),
    body('preferences.autoJoinRooms')
      .optional()
      .isBoolean()
      .withMessage('Auto join rooms must be a boolean')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, preferences } = req.body;
      
      const updateData = {};
      if (name) updateData.name = name;
      if (preferences) updateData.preferences = { ...req.user.preferences, ...preferences };
      
      const user = await User.findByIdAndUpdate(
        req.userId,
        updateData,
        { new: true, runValidators: true }
      );
      
      res.json({
        message: 'Profile updated successfully',
        user: user.toSafeObject()
      });
      
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ 
        error: 'Failed to update profile' 
      });
    }
  }
);

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password',
  authenticateToken,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const user = await User.findById(req.userId);
      
      // Check if user has a password (not OAuth only)
      if (!user.password) {
        return res.status(400).json({ 
          error: 'Cannot change password for OAuth accounts' 
        });
      }
      
      // Verify current password
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        return res.status(400).json({ 
          error: 'Current password is incorrect' 
        });
      }
      
      // Update password
      user.password = newPassword;
      await user.save();
      
      res.json({ 
        message: 'Password changed successfully' 
      });
      
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ 
        error: 'Failed to change password' 
      });
    }
  }
);

// @route   DELETE /api/auth/account
// @desc    Delete user account
// @access  Private
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement proper account deletion with cleanup
    // - Remove user from all rooms
    // - Delete user's messages
    // - Delete user's uploaded songs
    // - Update room host if user is host
    
    await User.findByIdAndDelete(req.userId);
    
    // Clear authentication cookies
    clearTokenCookies(res);
    
    res.json({ 
      message: 'Account deleted successfully' 
    });
    
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ 
      error: 'Failed to delete account' 
    });
  }
});

module.exports = router;