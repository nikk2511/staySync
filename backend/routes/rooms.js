const express = require('express');
const { body, validationResult, param } = require('express-validator');
const Room = require('../models/Room');
const User = require('../models/User');
const Song = require('../models/Song');
const Message = require('../models/Message');
const { requireRoomHost, requireRoomMember, requireRoomModerator } = require('../middleware/auth');

const router = express.Router();

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

// Middleware to load room and check access
const loadRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate('hostId', 'name email avatar')
      .populate('members.userId', 'name email avatar')
      .populate('queue.songId')
      .populate('queue.addedBy', 'name avatar')
      .populate('currentTrack.songId')
      .populate('currentTrack.playedBy', 'name avatar');
    
    if (!room || !room.isActive) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    req.room = room;
    next();
  } catch (error) {
    console.error('Load room error:', error);
    res.status(500).json({ error: 'Failed to load room' });
  }
};

// @route   GET /api/rooms
// @desc    Get all public rooms or user's rooms
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { type = 'public', page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = { isActive: true };
    
    if (type === 'public') {
      query.isPrivate = false;
    } else if (type === 'my') {
      query['members.userId'] = req.userId;
    }
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } }
      ];
    }
    
    const rooms = await Room.find(query)
      .populate('hostId', 'name avatar')
      .populate('members.userId', 'name avatar')
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Room.countDocuments(query);
    
    res.json({
      rooms: rooms.map(room => ({
        ...room.toObject(),
        members: room.members.filter(member => member.isOnline)
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// @route   POST /api/rooms
// @desc    Create a new room
// @access  Private
router.post('/',
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Room name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('isPrivate')
      .optional()
      .isBoolean()
      .withMessage('isPrivate must be a boolean'),
    body('passcode')
      .if(body('isPrivate').equals(true))
      .isLength({ min: 4, max: 20 })
      .withMessage('Passcode must be between 4 and 20 characters'),
    body('maxMembers')
      .optional()
      .isInt({ min: 2, max: 100 })
      .withMessage('Max members must be between 2 and 100'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, description, isPrivate, passcode, maxMembers, tags, settings } = req.body;
      
      // Check if user already has active rooms (limit to prevent spam)
      const userRoomsCount = await Room.countDocuments({
        hostId: req.userId,
        isActive: true
      });
      
      if (userRoomsCount >= 5) {
        return res.status(400).json({ 
          error: 'You can only create up to 5 active rooms' 
        });
      }
      
      const room = new Room({
        name,
        description: description || '',
        hostId: req.userId,
        isPrivate: isPrivate || false,
        passcode: isPrivate ? passcode : undefined,
        maxMembers: maxMembers || 50,
        tags: tags || [],
        settings: {
          ...{
            allowMembersToAddSongs: true,
            allowMembersToSkip: false,
            autoPlay: true,
            shuffleMode: false,
            repeatMode: 'off',
            volume: 80
          },
          ...settings
        }
      });
      
      // Add creator as first member with host role
      room.addMember(req.userId, 'host');
      
      await room.save();
      
      // Update user's room list and stats
      await User.findByIdAndUpdate(req.userId, {
        $addToSet: { rooms: room._id },
        currentRoom: room._id,
        $inc: { 'stats.roomsCreated': 1 }
      });
      
      // Populate room data
      await room.populate('hostId', 'name email avatar');
      await room.populate('members.userId', 'name email avatar');
      
      res.status(201).json({
        message: 'Room created successfully',
        room: room.toObject()
      });
      
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  }
);

// @route   GET /api/rooms/:roomId
// @desc    Get room details
// @access  Private
router.get('/:roomId', 
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  handleValidationErrors,
  loadRoom,
  requireRoomMember,
  async (req, res) => {
    try {
      res.json({
        room: req.room.toObject()
      });
    } catch (error) {
      console.error('Get room error:', error);
      res.status(500).json({ error: 'Failed to get room' });
    }
  }
);

// @route   POST /api/rooms/:roomId/join
// @desc    Join a room
// @access  Private
router.post('/:roomId/join',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  body('passcode').optional().trim(),
  handleValidationErrors,
  loadRoom,
  async (req, res) => {
    try {
      const { passcode } = req.body;
      const room = req.room;
      
      // Check if user is already a member
      const existingMember = room.members.find(member => 
        member.userId.toString() === req.userId.toString()
      );
      
      if (existingMember) {
        // Update member status to online
        room.updateMemberStatus(req.userId, true);
        await room.save();
        
        // Update user's current room
        await User.findByIdAndUpdate(req.userId, {
          currentRoom: room._id
        });
        
        return res.json({
          message: 'Already a member, status updated',
          room: room.toObject()
        });
      }
      
      // Check room capacity
      if (room.memberCount >= room.maxMembers) {
        return res.status(400).json({ 
          error: 'Room is full' 
        });
      }
      
      // Check passcode for private rooms
      if (room.isPrivate) {
        if (!passcode || passcode !== room.passcode) {
          return res.status(400).json({ 
            error: 'Invalid passcode' 
          });
        }
      }
      
      // Add user to room
      room.addMember(req.userId, 'member');
      await room.save();
      
      // Update user's room list and stats
      await User.findByIdAndUpdate(req.userId, {
        $addToSet: { rooms: room._id },
        currentRoom: room._id,
        $inc: { 'stats.roomsJoined': 1 }
      });
      
      // Create system message
      const joinMessage = new Message({
        roomId: room._id,
        senderId: req.userId,
        content: `${req.user.name} joined the room`,
        messageType: 'user_join'
      });
      await joinMessage.save();
      
      // Populate room data
      await room.populate('hostId', 'name email avatar');
      await room.populate('members.userId', 'name email avatar');
      
      res.json({
        message: 'Joined room successfully',
        room: room.toObject()
      });
      
    } catch (error) {
      console.error('Join room error:', error);
      res.status(500).json({ error: 'Failed to join room' });
    }
  }
);

// @route   POST /api/rooms/:roomId/leave
// @desc    Leave a room
// @access  Private
router.post('/:roomId/leave',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  handleValidationErrors,
  loadRoom,
  requireRoomMember,
  async (req, res) => {
    try {
      const room = req.room;
      
      // Check if user is the host
      if (room.hostId.toString() === req.userId.toString()) {
        // Transfer host to another member or delete room if no members
        const otherMembers = room.members.filter(member => 
          member.userId.toString() !== req.userId.toString()
        );
        
        if (otherMembers.length > 0) {
          // Transfer host to the oldest member
          const newHost = otherMembers.sort((a, b) => a.joinedAt - b.joinedAt)[0];
          room.hostId = newHost.userId;
          newHost.role = 'host';
        } else {
          // No other members, deactivate room
          room.isActive = false;
        }
      }
      
      // Remove user from room
      room.removeMember(req.userId);
      await room.save();
      
      // Update user's current room
      await User.findByIdAndUpdate(req.userId, {
        currentRoom: null,
        $pull: { rooms: room._id }
      });
      
      // Create system message if room is still active
      if (room.isActive) {
        const leaveMessage = new Message({
          roomId: room._id,
          senderId: req.userId,
          content: `${req.user.name} left the room`,
          messageType: 'user_leave'
        });
        await leaveMessage.save();
      }
      
      res.json({
        message: 'Left room successfully'
      });
      
    } catch (error) {
      console.error('Leave room error:', error);
      res.status(500).json({ error: 'Failed to leave room' });
    }
  }
);

// @route   PUT /api/rooms/:roomId
// @desc    Update room settings
// @access  Private (Host only)
router.put('/:roomId',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Room name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('maxMembers')
      .optional()
      .isInt({ min: 2, max: 100 })
      .withMessage('Max members must be between 2 and 100'),
    body('settings')
      .optional()
      .isObject()
      .withMessage('Settings must be an object')
  ],
  handleValidationErrors,
  loadRoom,
  requireRoomHost,
  async (req, res) => {
    try {
      const { name, description, maxMembers, settings, tags } = req.body;
      const room = req.room;
      
      // Update room fields
      if (name) room.name = name;
      if (description !== undefined) room.description = description;
      if (maxMembers) room.maxMembers = maxMembers;
      if (tags) room.tags = tags;
      if (settings) {
        room.settings = { ...room.settings, ...settings };
      }
      
      await room.save();
      
      res.json({
        message: 'Room updated successfully',
        room: room.toObject()
      });
      
    } catch (error) {
      console.error('Update room error:', error);
      res.status(500).json({ error: 'Failed to update room' });
    }
  }
);

// @route   DELETE /api/rooms/:roomId
// @desc    Delete room
// @access  Private (Host only)
router.delete('/:roomId',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  handleValidationErrors,
  loadRoom,
  requireRoomHost,
  async (req, res) => {
    try {
      const room = req.room;
      
      // Deactivate room instead of deleting
      room.isActive = false;
      await room.save();
      
      // Update all members' current room
      await User.updateMany(
        { currentRoom: room._id },
        { currentRoom: null }
      );
      
      // Create system message
      const deleteMessage = new Message({
        roomId: room._id,
        senderId: req.userId,
        content: 'Room has been closed by the host',
        messageType: 'system'
      });
      await deleteMessage.save();
      
      res.json({
        message: 'Room deleted successfully'
      });
      
    } catch (error) {
      console.error('Delete room error:', error);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  }
);

// @route   PUT /api/rooms/:roomId/members/:userId/role
// @desc    Update member role
// @access  Private (Host only)
router.put('/:roomId/members/:userId/role',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  param('userId').isMongoId().withMessage('Invalid user ID'),
  body('role')
    .isIn(['member', 'moderator'])
    .withMessage('Role must be member or moderator'),
  handleValidationErrors,
  loadRoom,
  requireRoomHost,
  async (req, res) => {
    try {
      const { role } = req.body;
      const { userId } = req.params;
      const room = req.room;
      
      const member = room.members.find(member => 
        member.userId.toString() === userId
      );
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      if (member.role === 'host') {
        return res.status(400).json({ error: 'Cannot change host role' });
      }
      
      member.role = role;
      await room.save();
      
      res.json({
        message: 'Member role updated successfully',
        member: member
      });
      
    } catch (error) {
      console.error('Update member role error:', error);
      res.status(500).json({ error: 'Failed to update member role' });
    }
  }
);

// @route   DELETE /api/rooms/:roomId/members/:userId
// @desc    Kick member from room
// @access  Private (Host/Moderator only)
router.delete('/:roomId/members/:userId',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  param('userId').isMongoId().withMessage('Invalid user ID'),
  handleValidationErrors,
  loadRoom,
  requireRoomModerator,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const room = req.room;
      
      if (userId === req.userId.toString()) {
        return res.status(400).json({ error: 'Cannot kick yourself' });
      }
      
      const member = room.members.find(member => 
        member.userId.toString() === userId
      );
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      if (member.role === 'host') {
        return res.status(400).json({ error: 'Cannot kick room host' });
      }
      
      // Remove member
      room.removeMember(userId);
      await room.save();
      
      // Update user's current room
      await User.findByIdAndUpdate(userId, {
        currentRoom: null
      });
      
      // Create system message
      const kickMessage = new Message({
        roomId: room._id,
        senderId: req.userId,
        content: `User was removed from the room`,
        messageType: 'system'
      });
      await kickMessage.save();
      
      res.json({
        message: 'Member kicked successfully'
      });
      
    } catch (error) {
      console.error('Kick member error:', error);
      res.status(500).json({ error: 'Failed to kick member' });
    }
  }
);

module.exports = router;