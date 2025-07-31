const express = require('express');
const axios = require('axios');
const { body, validationResult, param } = require('express-validator');
const Message = require('../models/Message');
const Room = require('../models/Room');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each user to 20 AI requests per windowMs
  message: 'Too many AI requests, please try again later.',
  keyGenerator: (req) => req.userId // Use user ID as key
});

router.use(aiLimiter);

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

// Helper function to call Gemini API
const callGeminiAPI = async (prompt, temperature = 0.7, maxTokens = 150) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: maxTokens,
          topP: 0.8,
          topK: 40
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    if (response.data.candidates && response.data.candidates.length > 0) {
      const candidate = response.data.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        return candidate.content.parts[0].text.trim();
      }
    }

    throw new Error('No valid response from Gemini API');
  } catch (error) {
    console.error('Gemini API error:', error.response?.data || error.message);
    
    if (error.response?.status === 429) {
      throw new Error('AI service is currently busy. Please try again later.');
    }
    
    if (error.response?.status === 403) {
      throw new Error('AI service access denied. Please check configuration.');
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('AI service timeout. Please try again.');
    }
    
    throw new Error('AI service temporarily unavailable. Please try again later.');
  }
};

// Helper function to get recent messages context
const getRecentMessagesContext = async (roomId, limit = 5) => {
  try {
    const messages = await Message.find({
      roomId,
      isDeleted: false,
      messageType: 'text'
    })
      .populate('senderId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit);

    return messages.reverse().map(msg => 
      `${msg.senderId.name}: ${msg.content}`
    ).join('\n');
  } catch (error) {
    console.error('Error getting messages context:', error);
    return '';
  }
};

// @route   POST /api/ai/suggest-reply/:roomId
// @desc    Get AI-powered chat reply suggestion
// @access  Private
router.post('/suggest-reply/:roomId',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  body('context')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Context must be less than 500 characters'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { context } = req.body;
      
      // Check if user is a room member
      const room = await Room.findById(roomId);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      const isMember = room.members.some(member => 
        member.userId.toString() === req.userId.toString()
      );
      
      if (!isMember) {
        return res.status(403).json({ 
          error: 'You must be a room member to use AI suggestions' 
        });
      }
      
      // Get recent messages for context
      const recentMessages = await getRecentMessagesContext(roomId, 5);
      
      // Build prompt for Gemini
      let prompt = `You're in a music room chat called "${room.name}". `;
      
      if (recentMessages) {
        prompt += `Recent conversation:\n${recentMessages}\n\n`;
      }
      
      if (context) {
        prompt += `Additional context: ${context}\n\n`;
      }
      
      prompt += `Generate a short, friendly, and relevant reply (maximum 100 characters) that would fit naturally in this music room conversation. Be casual, positive, and music-focused when appropriate. Don't use quotes around your response.`;
      
      const suggestion = await callGeminiAPI(prompt, 0.8, 100);
      
      // Validate suggestion length and content
      if (suggestion.length > 200) {
        throw new Error('Generated suggestion too long');
      }
      
      // Filter out potentially inappropriate suggestions
      const inappropriatePatterns = [
        /\b(hate|harmful|offensive)\b/i,
        /\b(spam|advertisement|promote)\b/i
      ];
      
      for (const pattern of inappropriatePatterns) {
        if (pattern.test(suggestion)) {
          throw new Error('Generated inappropriate content');
        }
      }
      
      res.json({
        suggestion: suggestion,
        context: 'chat_reply'
      });
      
    } catch (error) {
      console.error('AI suggestion error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to generate suggestion' 
      });
    }
  }
);

// @route   POST /api/ai/music-recommendation/:roomId
// @desc    Get AI-powered music recommendations
// @access  Private
router.post('/music-recommendation/:roomId',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  body('mood')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Mood must be between 1 and 100 characters'),
  body('genre')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Genre must be between 1 and 50 characters'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { mood, genre } = req.body;
      
      // Check if user is a room member
      const room = await Room.findById(roomId)
        .populate('queue.songId')
        .populate('currentTrack.songId');
      
      if (!room || !room.isActive) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      const isMember = room.members.some(member => 
        member.userId.toString() === req.userId.toString()
      );
      
      if (!isMember) {
        return res.status(403).json({ 
          error: 'You must be a room member to get recommendations' 
        });
      }
      
      // Build context from current and queued songs
      let musicContext = '';
      
      if (room.currentTrack.songId) {
        musicContext += `Currently playing: ${room.currentTrack.songId.title} by ${room.currentTrack.songId.artist}\n`;
      }
      
      if (room.queue.length > 0) {
        const queueTitles = room.queue.slice(0, 3).map(item => 
          `${item.songId.title} by ${item.songId.artist}`
        ).join(', ');
        musicContext += `Upcoming in queue: ${queueTitles}\n`;
      }
      
      // Build prompt for music recommendations
      let prompt = `You're a music DJ assistant in a room called "${room.name}". `;
      
      if (musicContext) {
        prompt += `Current music context:\n${musicContext}\n`;
      }
      
      if (mood) {
        prompt += `Requested mood: ${mood}\n`;
      }
      
      if (genre) {
        prompt += `Requested genre: ${genre}\n`;
      }
      
      prompt += `Suggest 3-5 song recommendations that would fit well. Format as: "Song Title - Artist" (one per line). Keep suggestions relevant to the current vibe and avoid repeating what's already playing or queued.`;
      
      const recommendations = await callGeminiAPI(prompt, 0.9, 200);
      
      // Parse recommendations into structured format
      const songList = recommendations
        .split('\n')
        .filter(line => line.trim() && line.includes(' - '))
        .slice(0, 5)
        .map(line => {
          const [title, artist] = line.trim().split(' - ');
          return {
            title: title?.trim(),
            artist: artist?.trim()
          };
        })
        .filter(song => song.title && song.artist);
      
      res.json({
        recommendations: songList,
        context: {
          mood: mood || null,
          genre: genre || null,
          currentSong: room.currentTrack.songId ? {
            title: room.currentTrack.songId.title,
            artist: room.currentTrack.songId.artist
          } : null
        }
      });
      
    } catch (error) {
      console.error('Music recommendation error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to generate music recommendations' 
      });
    }
  }
);

// @route   POST /api/ai/room-description/:roomId
// @desc    Generate AI room description
// @access  Private (Host only)
router.post('/room-description/:roomId',
  param('roomId').isMongoId().withMessage('Invalid room ID'),
  body('theme')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Theme must be between 1 and 100 characters'),
  body('style')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Style must be between 1 and 50 characters'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { theme, style } = req.body;
      
      // Check if user is room host
      const room = await Room.findById(roomId);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      if (room.hostId.toString() !== req.userId.toString()) {
        return res.status(403).json({ 
          error: 'Only room host can generate descriptions' 
        });
      }
      
      // Build prompt for room description
      let prompt = `Generate a creative and engaging description for a music room called "${room.name}". `;
      
      if (theme) {
        prompt += `Theme: ${theme}. `;
      }
      
      if (style) {
        prompt += `Style: ${style}. `;
      }
      
      prompt += `The description should be welcoming, fun, and music-focused. Keep it under 200 characters and suitable for all audiences. Make it engaging for people who want to listen to music together.`;
      
      const description = await callGeminiAPI(prompt, 0.8, 150);
      
      // Validate description length
      if (description.length > 500) {
        throw new Error('Generated description too long');
      }
      
      res.json({
        description: description.trim(),
        roomName: room.name
      });
      
    } catch (error) {
      console.error('Room description error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to generate room description' 
      });
    }
  }
);

// @route   POST /api/ai/chat-moderate
// @desc    Moderate chat message using AI
// @access  Private (Internal use)
router.post('/chat-moderate',
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Content must be between 1 and 1000 characters'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { content } = req.body;
      
      // Build moderation prompt
      const prompt = `Analyze this chat message for inappropriate content. Respond with only "SAFE" or "UNSAFE":

Message: "${content}"

Check for: hate speech, harassment, spam, inappropriate language, or harmful content. Consider the context of a music chat room.`;
      
      const result = await callGeminiAPI(prompt, 0.1, 10);
      
      const isUnsafe = result.toLowerCase().includes('unsafe');
      
      res.json({
        isSafe: !isUnsafe,
        confidence: isUnsafe ? 'high' : 'low',
        action: isUnsafe ? 'block' : 'allow'
      });
      
    } catch (error) {
      console.error('Content moderation error:', error);
      // On error, default to safe
      res.json({
        isSafe: true,
        confidence: 'unknown',
        action: 'allow',
        error: 'Moderation service unavailable'
      });
    }
  }
);

// @route   GET /api/ai/status
// @desc    Check AI service status
// @access  Private
router.get('/status', async (req, res) => {
  try {
    // Simple test prompt
    const testPrompt = 'Respond with "OK" if you are working correctly.';
    const response = await callGeminiAPI(testPrompt, 0.1, 10);
    
    const isWorking = response.toLowerCase().includes('ok');
    
    res.json({
      status: isWorking ? 'operational' : 'degraded',
      service: 'Gemini AI',
      timestamp: new Date().toISOString(),
      message: isWorking ? 'AI service is operational' : 'AI service may be experiencing issues'
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'down',
      service: 'Gemini AI',
      timestamp: new Date().toISOString(),
      message: 'AI service is currently unavailable',
      error: error.message
    });
  }
});

module.exports = router;