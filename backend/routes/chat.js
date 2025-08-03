const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const Message = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');
const { requireRoomMember, requireRoomModerator } = require('../middleware/auth');

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

// Middleware to load room and check member access
const loadRoomAndCheckAccess = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.roomId);
    
    if (!room || !room.isActive) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Check if user is a member
    const isMember = room.members.some(member => {
      // Handle both populated and unpopulated userId
      const memberUserId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
      return memberUserId === req.userId.toString();
    });
    
    if (!isMember) {
      return res.status(403).json({ 
        error: 'You must be a room member to access chat' 
      });
    }
    
    req.room = room;
    next();
  } catch (error) {
    console.error('Load room error:', error);
    res.status(500).json({ error: 'Failed to load room' });
  }
};

// @route   GET /api/chat/:roomId/messages
// @desc    Get messages for a room
// @access  Private
router.get('/:roomId/messages',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('before').optional().isISO8601().withMessage('Before must be a valid date'),
  handleValidationErrors,
  loadRoomAndCheckAccess,
  async (req, res) => {
    try {
      const { page = 1, limit = 50, before } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      let query = {
        roomId: req.params.roomId,
        isDeleted: false
      };
      
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }
      
      const messages = await Message.find(query)
        .populate('senderId', 'name avatar')
        .populate('replyTo.messageId', 'content senderId')
        .populate('mentions.userId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      // Mark messages as read by current user
      await Promise.all(
        messages.map(message => {
          if (!message.isReadBy(req.userId)) {
            message.markAsRead(req.userId);
            return message.save();
          }
          return Promise.resolve();
        })
      );
      
      const total = await Message.countDocuments({
        roomId: req.params.roomId,
        isDeleted: false
      });
      
      res.json({
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
      
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  }
);

// @route   POST /api/chat/:roomId/messages
// @desc    Send a message to a room
// @access  Private
router.post('/:roomId/messages',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  [
    body('content')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message content must be between 1 and 1000 characters'),
    body('messageType')
      .optional()
      .isIn(['text', 'emoji', 'image'])
      .withMessage('Invalid message type'),
    body('replyTo')
      .optional()
      .isMongoId()
      .withMessage('Invalid reply message ID'),
    body('mentions')
      .optional()
      .isArray()
      .withMessage('Mentions must be an array')
  ],
  handleValidationErrors,
  loadRoomAndCheckAccess,
  async (req, res) => {
    try {
      const { content, messageType = 'text', replyTo, mentions } = req.body;
      
      // Process mentions
      let processedMentions = [];
      if (mentions && mentions.length > 0) {
        for (const mention of mentions) {
          const user = await User.findById(mention.userId).select('name');
          if (user) {
            processedMentions.push({
              userId: mention.userId,
              username: user.name,
              startIndex: mention.startIndex,
              endIndex: mention.endIndex
            });
          }
        }
      }
      
      // Handle reply
      let replyData = null;
      if (replyTo) {
        const replyMessage = await Message.findById(replyTo)
          .populate('senderId', 'name');
        
        if (replyMessage && replyMessage.roomId.toString() === req.params.roomId) {
          replyData = {
            messageId: replyMessage._id,
            content: replyMessage.content.substring(0, 100) + (replyMessage.content.length > 100 ? '...' : ''),
            senderName: replyMessage.senderId.name
          };
        }
      }
      
      const message = new Message({
        roomId: req.params.roomId,
        senderId: req.userId,
        content,
        messageType,
        replyTo: replyData,
        mentions: processedMentions
      });
      
      await message.save();
      
      // Populate message data
      await message.populate('senderId', 'name avatar');
      
      // Update room stats
      await Room.findByIdAndUpdate(req.params.roomId, {
        $inc: { 'stats.totalMessages': 1 },
        lastActivity: new Date()
      });
      
      // Update user stats
      await User.findByIdAndUpdate(req.userId, {
        $inc: { 'stats.chatMessages': 1 }
      });
      
      res.status(201).json({
        message: 'Message sent successfully',
        data: message.toObject()
      });
      
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// @route   PUT /api/chat/messages/:messageId
// @desc    Edit a message
// @access  Private
router.put('/messages/:messageId',
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message content must be between 1 and 1000 characters'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { content } = req.body;
      
      const message = await Message.findById(req.params.messageId)
        .populate('senderId', 'name avatar');
      
      if (!message || message.isDeleted) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      // Check if user owns the message
      if (message.senderId._id.toString() !== req.userId.toString()) {
        return res.status(403).json({ 
          error: 'You can only edit your own messages' 
        });
      }
      
      // Check if message is too old to edit (5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (message.createdAt < fiveMinutesAgo) {
        return res.status(400).json({ 
          error: 'Messages can only be edited within 5 minutes of posting' 
        });
      }
      
      // Edit message
      message.editContent(content);
      await message.save();
      
      res.json({
        message: 'Message edited successfully',
        data: message.toObject()
      });
      
    } catch (error) {
      console.error('Edit message error:', error);
      res.status(500).json({ error: 'Failed to edit message' });
    }
  }
);

// @route   DELETE /api/chat/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/messages/:messageId',
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const message = await Message.findById(req.params.messageId)
        .populate('senderId', 'name avatar');
      
      if (!message || message.isDeleted) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      // Get room to check user permissions
      const room = await Room.findById(message.roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      const member = room.members.find(member => {
        // Handle both populated and unpopulated userId
        const memberUserId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        return memberUserId === req.userId.toString();
      });
      
      if (!member) {
        return res.status(403).json({ 
          error: 'You must be a room member' 
        });
      }
      
      // Check permissions (own message, moderator, or host)
      const canDelete = message.senderId._id.toString() === req.userId.toString() ||
                       ['host', 'moderator'].includes(member.role);
      
      if (!canDelete) {
        return res.status(403).json({ 
          error: 'You can only delete your own messages' 
        });
      }
      
      // Soft delete message
      message.softDelete(req.userId);
      await message.save();
      
      res.json({
        message: 'Message deleted successfully'
      });
      
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
);

// @route   POST /api/chat/messages/:messageId/react
// @desc    Add or remove reaction to a message
// @access  Private
router.post('/messages/:messageId/react',
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  body('emoji')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Emoji must be between 1 and 10 characters'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { emoji } = req.body;
      
      const message = await Message.findById(req.params.messageId);
      
      if (!message || message.isDeleted) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      // Check if user is a room member
      const room = await Room.findById(message.roomId);
      const isMember = room.members.some(member => {
        // Handle both populated and unpopulated userId
        const memberUserId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        return memberUserId === req.userId.toString();
      });
      
      if (!isMember) {
        return res.status(403).json({ 
          error: 'You must be a room member to react to messages' 
        });
      }
      
      // Check if user already reacted with this emoji
      const reaction = message.reactions.find(r => r.emoji === emoji);
      const hasReacted = reaction && reaction.users.some(u => 
        u.userId.toString() === req.userId.toString()
      );
      
      if (hasReacted) {
        // Remove reaction
        message.removeReaction(emoji, req.userId);
      } else {
        // Add reaction
        message.addReaction(emoji, req.userId);
      }
      
      await message.save();
      
      res.json({
        message: hasReacted ? 'Reaction removed' : 'Reaction added',
        reactions: message.reactions
      });
      
    } catch (error) {
      console.error('React to message error:', error);
      res.status(500).json({ error: 'Failed to react to message' });
    }
  }
);

// @route   POST /api/chat/messages/:messageId/pin
// @desc    Pin or unpin a message
// @access  Private (Moderator/Host only)
router.post('/messages/:messageId/pin',
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const message = await Message.findById(req.params.messageId);
      
      if (!message || message.isDeleted) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      // Check permissions
      const room = await Room.findById(message.roomId);
      const member = room.members.find(member => {
        // Handle both populated and unpopulated userId
        const memberUserId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        return memberUserId === req.userId.toString();
      });
      
      if (!member || !['host', 'moderator'].includes(member.role)) {
        return res.status(403).json({ 
          error: 'Only hosts and moderators can pin messages' 
        });
      }
      
      if (message.isPinned) {
        message.unpin();
      } else {
        message.pin(req.userId);
      }
      
      await message.save();
      
      res.json({
        message: message.isPinned ? 'Message pinned' : 'Message unpinned',
        isPinned: message.isPinned
      });
      
    } catch (error) {
      console.error('Pin message error:', error);
      res.status(500).json({ error: 'Failed to pin message' });
    }
  }
);

// @route   GET /api/chat/:roomId/pinned
// @desc    Get pinned messages for a room
// @access  Private
router.get('/:roomId/pinned',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  handleValidationErrors,
  loadRoomAndCheckAccess,
  async (req, res) => {
    try {
      const pinnedMessages = await Message.getPinnedForRoom(req.params.roomId);
      
      res.json({
        pinnedMessages
      });
      
    } catch (error) {
      console.error('Get pinned messages error:', error);
      res.status(500).json({ error: 'Failed to get pinned messages' });
    }
  }
);

// @route   GET /api/chat/:roomId/search
// @desc    Search messages in a room
// @access  Private
router.get('/:roomId/search',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  query('q')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  handleValidationErrors,
  loadRoomAndCheckAccess,
  async (req, res) => {
    try {
      const { q, limit = 20 } = req.query;
      
      const messages = await Message.searchInRoom(
        req.params.roomId, 
        q, 
        { limit: parseInt(limit) }
      );
      
      res.json({
        messages,
        query: q
      });
      
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(500).json({ error: 'Failed to search messages' });
    }
  }
);

// @route   GET /api/chat/:roomId/stats
// @desc    Get chat statistics for a room
// @access  Private
router.get('/:roomId/stats',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  handleValidationErrors,
  loadRoomAndCheckAccess,
  async (req, res) => {
    try {
      const stats = await Message.getStatsForRoom(req.params.roomId);
      
      res.json({
        stats: stats[0] || {
          totalMessages: 0,
          totalReactions: 0,
          messagesByType: [],
          messagesByUser: []
        }
      });
      
    } catch (error) {
      console.error('Get chat stats error:', error);
      res.status(500).json({ error: 'Failed to get chat statistics' });
    }
  }
);

// @route   POST /api/chat/messages/:messageId/read
// @desc    Mark message as read
// @access  Private
router.post('/messages/:messageId/read',
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const message = await Message.findById(req.params.messageId);
      
      if (!message || message.isDeleted) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      // Check if user is a room member
      const room = await Room.findById(message.roomId);
      const isMember = room.members.some(member => {
        // Handle both populated and unpopulated userId
        const memberUserId = member.userId._id ? member.userId._id.toString() : member.userId.toString();
        return memberUserId === req.userId.toString();
      });
      
      if (!isMember) {
        return res.status(403).json({ 
          error: 'You must be a room member' 
        });
      }
      
      message.markAsRead(req.userId);
      await message.save();
      
      res.json({
        message: 'Message marked as read'
      });
      
    } catch (error) {
      console.error('Mark message as read error:', error);
      res.status(500).json({ error: 'Failed to mark message as read' });
    }
  }
);

module.exports = router;