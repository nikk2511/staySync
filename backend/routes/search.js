const express = require('express');
const { query, validationResult } = require('express-validator');
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

// @route   GET /api/search/external
// @desc    Search songs from external APIs (Audius, YouTube) - PUBLIC
// @access  Public (no auth required)
router.get('/external', 
  query('q').isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('source').optional().isIn(['all', 'audius', 'youtube']).withMessage('Invalid source'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { q, limit = 20, source = 'all' } = req.query;
      
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
  }
);

module.exports = router;