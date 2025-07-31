const express = require('express');
const multer = require('multer');
const { body, validationResult, param } = require('express-validator');
const path = require('path');
const fs = require('fs');
const Song = require('../models/Song');
const Room = require('../models/Room');
const Message = require('../models/Message');
const { requireRoomMember, requireRoomHost } = require('../middleware/auth');
const musicSearchService = require('../services/musicSearchService');

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

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/music';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// @route   GET /api/music/search
// @desc    Search for songs
// @access  Private
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20, genre, sourceType } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Search query must be at least 2 characters long' 
      });
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {
      isActive: true,
      $text: { $search: q }
    };
    
    if (genre) {
      query.genre = new RegExp(genre, 'i');
    }
    
    if (sourceType) {
      query.sourceType = sourceType;
    }
    
    const songs = await Song.find(query)
      .populate('addedBy', 'name avatar')
      .sort({ score: { $meta: 'textScore' }, 'stats.totalPlays': -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Song.countDocuments(query);
    
    res.json({
      songs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Search songs error:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

// @route   GET /api/music/popular
// @desc    Get popular songs
// @access  Private
router.get('/popular', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const songs = await Song.getPopular(parseInt(limit));
    
    res.json({ songs });
    
  } catch (error) {
    console.error('Get popular songs error:', error);
    res.status(500).json({ error: 'Failed to get popular songs' });
  }
});

// @route   GET /api/music/recent
// @desc    Get recent songs
// @access  Private
router.get('/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const songs = await Song.getRecent(parseInt(limit));
    
    res.json({ songs });
    
  } catch (error) {
    console.error('Get recent songs error:', error);
    res.status(500).json({ error: 'Failed to get recent songs' });
  }
});

// @route   GET /api/music/search-external
// @desc    Search songs from external APIs (Audius, YouTube)
// @access  Private
router.get('/search-external', async (req, res) => {
  try {
    const { q, limit = 20, source = 'all' } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Search query must be at least 2 characters long' 
      });
    }
    
    const includeYouTube = source === 'all' || source === 'youtube';
    const searchLimit = Math.min(parseInt(limit), 50);
    
    const results = await musicSearchService.searchSongs(
      q.trim(), 
      searchLimit, 
      includeYouTube
    );
    
    res.json({
      success: true,
      ...results,
      cached: false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('External search error:', error);
    
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({ 
        error: error.message,
        retryAfter: 60 
      });
    }
    
    if (error.message.includes('Invalid search query')) {
      return res.status(400).json({ 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to search external music sources',
      details: error.message
    });
  }
});

// @route   GET /api/music/track-details/:source/:trackId
// @desc    Get detailed information about an external track
// @access  Private
router.get('/track-details/:source/:trackId', 
  param('source').isIn(['audius', 'youtube']).withMessage('Invalid source'),
  param('trackId').notEmpty().withMessage('Track ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { source, trackId } = req.params;
      
      const trackDetails = await musicSearchService.getTrackDetails(trackId, source);
      
      if (!trackDetails) {
        return res.status(404).json({ 
          error: 'Track not found' 
        });
      }
      
      res.json({
        success: true,
        track: trackDetails,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Track details error:', error);
      res.status(500).json({ 
        error: 'Failed to get track details',
        details: error.message
      });
    }
  }
);

// @route   POST /api/music/validate-stream
// @desc    Validate if an external stream URL is accessible
// @access  Private
router.post('/validate-stream',
  body('url').isURL().withMessage('Valid URL is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { url } = req.body;
      
      const isValid = await musicSearchService.validateStreamUrl(url);
      
      res.json({
        success: true,
        isValid,
        url,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Stream validation error:', error);
      res.status(500).json({ 
        error: 'Failed to validate stream URL',
        details: error.message
      });
    }
  }
);

// @route   POST /api/music/upload
// @desc    Upload a music file
// @access  Private
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    const { title, artist, album, genre, duration } = req.body;
    
    if (!title || !artist || !duration) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: 'Title, artist, and duration are required' 
      });
    }
    
    const song = new Song({
      title: title.trim(),
      artist: artist.trim(),
      album: album ? album.trim() : '',
      genre: genre ? genre.trim() : '',
      duration: parseInt(duration),
      sourceType: 'upload',
      sourceURL: `/uploads/music/${req.file.filename}`,
      addedBy: req.userId,
      metadata: {
        fileSize: req.file.size,
        format: path.extname(req.file.originalname).substring(1),
        originalName: req.file.originalname
      }
    });
    
    await song.save();
    await song.populate('addedBy', 'name avatar');
    
    res.status(201).json({
      message: 'Song uploaded successfully',
      song: song.toObject()
    });
    
  } catch (error) {
    console.error('Upload song error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({ error: 'Failed to upload song' });
  }
});

// @route   POST /api/music/add-url
// @desc    Add song from URL
// @access  Private
router.post('/add-url',
  [
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('artist')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Artist must be between 1 and 100 characters'),
    body('sourceURL')
      .isURL()
      .withMessage('Valid source URL is required'),
    body('duration')
      .isInt({ min: 1 })
      .withMessage('Duration must be a positive integer'),
    body('sourceType')
      .isIn(['youtube', 'spotify', 'url'])
      .withMessage('Source type must be youtube, spotify, or url')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { title, artist, album, genre, sourceURL, duration, sourceType, thumbnailURL } = req.body;
      
      // Check if song already exists
      const existingSong = await Song.findOne({ sourceURL, sourceType });
      if (existingSong) {
        return res.json({
          message: 'Song already exists',
          song: existingSong.toObject()
        });
      }
      
      const song = new Song({
        title: title.trim(),
        artist: artist.trim(),
        album: album ? album.trim() : '',
        genre: genre ? genre.trim() : '',
        duration: parseInt(duration),
        sourceType,
        sourceURL,
        thumbnailURL: thumbnailURL || undefined,
        addedBy: req.userId
      });
      
      await song.save();
      await song.populate('addedBy', 'name avatar');
      
      res.status(201).json({
        message: 'Song added successfully',
        song: song.toObject()
      });
      
    } catch (error) {
      console.error('Add song URL error:', error);
      res.status(500).json({ error: 'Failed to add song' });
    }
  }
);

// @route   GET /api/music/:songId
// @desc    Get song details
// @access  Private
router.get('/:songId',
  param('songId').isMongoId().withMessage('Invalid song ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const song = await Song.findById(req.params.songId)
        .populate('addedBy', 'name avatar');
      
      if (!song || !song.isActive) {
        return res.status(404).json({ error: 'Song not found' });
      }
      
      res.json({ song: song.toObject() });
      
    } catch (error) {
      console.error('Get song error:', error);
      res.status(500).json({ error: 'Failed to get song' });
    }
  }
);

// @route   POST /api/music/:songId/like
// @desc    Like/unlike a song
// @access  Private
router.post('/:songId/like',
  param('songId').isMongoId().withMessage('Invalid song ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const song = await Song.findById(req.params.songId);
      
      if (!song || !song.isActive) {
        return res.status(404).json({ error: 'Song not found' });
      }
      
      const isLiked = song.isLikedBy(req.userId);
      
      if (isLiked) {
        song.removeLike(req.userId);
      } else {
        song.addLike(req.userId);
      }
      
      await song.save();
      
      res.json({
        message: isLiked ? 'Song unliked' : 'Song liked',
        isLiked: !isLiked,
        likeCount: song.likeCount
      });
      
    } catch (error) {
      console.error('Like song error:', error);
      res.status(500).json({ error: 'Failed to like song' });
    }
  }
);

// @route   POST /api/music/rooms/:roomId/queue
// @desc    Add song to room queue
// @access  Private
router.post('/rooms/:roomId/queue',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  body('songId').isMongoId().withMessage('Invalid song ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { songId } = req.body;
      const { roomId } = req.params;
      
      // Get room and check permissions
      const room = await Room.findById(roomId)
        .populate('queue.songId')
        .populate('queue.addedBy', 'name avatar');
      
      if (!room || !room.isActive) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      // Check if user is a member
      const isMember = room.members.some(member => 
        member.userId.toString() === req.userId.toString()
      );
      
      if (!isMember) {
        return res.status(403).json({ 
          error: 'You must be a room member to add songs' 
        });
      }
      
      // Check room settings
      const member = room.members.find(member => 
        member.userId.toString() === req.userId.toString()
      );
      
      if (!room.settings.allowMembersToAddSongs && member.role === 'member') {
        return res.status(403).json({ 
          error: 'Only moderators and host can add songs' 
        });
      }
      
      // Check if song exists
      const song = await Song.findById(songId);
      if (!song || !song.isActive) {
        return res.status(404).json({ error: 'Song not found' });
      }
      
      // Check if song is already in queue
      const isInQueue = room.queue.some(item => 
        item.songId.toString() === songId
      );
      
      if (isInQueue) {
        return res.status(400).json({ 
          error: 'Song is already in queue' 
        });
      }
      
      // Add song to queue
      room.addToQueue(songId, req.userId);
      room.stats.totalSongsPlayed += 1;
      await room.save();
      
      // Populate the new queue item
      await room.populate('queue.songId');
      await room.populate('queue.addedBy', 'name avatar');
      
      // Create message
      const addMessage = new Message({
        roomId: room._id,
        senderId: req.userId,
        content: `added "${song.title}" by ${song.artist} to the queue`,
        messageType: 'song_add',
        metadata: {
          songInfo: {
            songId: song._id,
            title: song.title,
            artist: song.artist,
            duration: song.duration
          }
        }
      });
      await addMessage.save();
      
      res.json({
        message: 'Song added to queue',
        queue: room.queue,
        queueLength: room.queueLength
      });
      
    } catch (error) {
      console.error('Add to queue error:', error);
      res.status(500).json({ error: 'Failed to add song to queue' });
    }
  }
);

// @route   DELETE /api/music/rooms/:roomId/queue/:songId
// @desc    Remove song from room queue
// @access  Private
router.delete('/rooms/:roomId/queue/:songId',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  param('songId').isMongoId().withMessage('Invalid song ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId, songId } = req.params;
      
      const room = await Room.findById(roomId);
      
      if (!room || !room.isActive) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      // Check permissions
      const member = room.members.find(member => 
        member.userId.toString() === req.userId.toString()
      );
      
      if (!member) {
        return res.status(403).json({ 
          error: 'You must be a room member' 
        });
      }
      
      const queueItem = room.queue.find(item => 
        item.songId.toString() === songId
      );
      
      if (!queueItem) {
        return res.status(404).json({ error: 'Song not found in queue' });
      }
      
      // Check if user can remove (own song, moderator, or host)
      const canRemove = queueItem.addedBy.toString() === req.userId.toString() ||
                       ['host', 'moderator'].includes(member.role);
      
      if (!canRemove) {
        return res.status(403).json({ 
          error: 'You can only remove songs you added' 
        });
      }
      
      // Remove from queue
      room.removeFromQueue(songId);
      await room.save();
      
      await room.populate('queue.songId');
      await room.populate('queue.addedBy', 'name avatar');
      
      res.json({
        message: 'Song removed from queue',
        queue: room.queue,
        queueLength: room.queueLength
      });
      
    } catch (error) {
      console.error('Remove from queue error:', error);
      res.status(500).json({ error: 'Failed to remove song from queue' });
    }
  }
);

// @route   PUT /api/music/rooms/:roomId/queue/reorder
// @desc    Reorder room queue
// @access  Private (Host/Moderator only)
router.put('/rooms/:roomId/queue/reorder',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  body('queue').isArray().withMessage('Queue must be an array'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { queue } = req.body;
      const { roomId } = req.params;
      
      const room = await Room.findById(roomId);
      
      if (!room || !room.isActive) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      // Check permissions
      const member = room.members.find(member => 
        member.userId.toString() === req.userId.toString()
      );
      
      if (!member || !['host', 'moderator'].includes(member.role)) {
        return res.status(403).json({ 
          error: 'Only hosts and moderators can reorder queue' 
        });
      }
      
      // Validate queue items
      const validItems = queue.filter(item => 
        item.songId && room.queue.some(q => q.songId.toString() === item.songId)
      );
      
      if (validItems.length !== room.queue.length) {
        return res.status(400).json({ 
          error: 'Invalid queue order' 
        });
      }
      
      // Reorder queue
      room.reorderQueue(validItems);
      await room.save();
      
      await room.populate('queue.songId');
      await room.populate('queue.addedBy', 'name avatar');
      
      res.json({
        message: 'Queue reordered successfully',
        queue: room.queue
      });
      
    } catch (error) {
      console.error('Reorder queue error:', error);
      res.status(500).json({ error: 'Failed to reorder queue' });
    }
  }
);

// @route   GET /api/music/rooms/:roomId/current
// @desc    Get current playing track
// @access  Private
router.get('/rooms/:roomId/current',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const room = await Room.findById(req.params.roomId)
        .populate('currentTrack.songId')
        .populate('currentTrack.playedBy', 'name avatar');
      
      if (!room || !room.isActive) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      res.json({
        currentTrack: room.currentTrack,
        settings: room.settings
      });
      
    } catch (error) {
      console.error('Get current track error:', error);
      res.status(500).json({ error: 'Failed to get current track' });
    }
  }
);

// @route   DELETE /api/music/:songId
// @desc    Delete song (own songs only)
// @access  Private
router.delete('/:songId',
  param('songId').isMongoId().withMessage('Invalid song ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const song = await Song.findById(req.params.songId);
      
      if (!song || !song.isActive) {
        return res.status(404).json({ error: 'Song not found' });
      }
      
      // Check if user owns the song
      if (song.addedBy.toString() !== req.userId.toString()) {
        return res.status(403).json({ 
          error: 'You can only delete your own songs' 
        });
      }
      
      // Soft delete
      song.isActive = false;
      await song.save();
      
      // Delete file if it's an upload
      if (song.sourceType === 'upload') {
        const filePath = path.join(__dirname, '..', song.sourceURL);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      res.json({ message: 'Song deleted successfully' });
      
    } catch (error) {
      console.error('Delete song error:', error);
      res.status(500).json({ error: 'Failed to delete song' });
    }
  }
);

module.exports = router;