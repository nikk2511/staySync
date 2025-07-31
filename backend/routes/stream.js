const express = require('express');
const axios = require('axios');
const router = express.Router();

// @route   GET /api/stream/health
// @desc    Health check for streaming service
// @access  Public
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Audio Streaming Proxy',
    timestamp: new Date().toISOString(),
    supportedSources: ['audius', 'youtube']
  });
});

// @route   GET /api/stream/audius/:trackId
// @desc    Proxy Audius audio streams to bypass CORS
// @access  Public
router.get('/audius/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    const streamUrl = `https://api.audius.co/v1/tracks/${trackId}/stream`;
    
    console.log(`Proxying Audius stream: ${streamUrl}`);
    
    // Make request to Audius with proper headers
    const response = await axios({
      method: 'GET',
      url: streamUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'MusicApp/1.0',
        'Accept': 'audio/*',
      },
      timeout: 30000, // 30 second timeout
    });
    
    // Set proper headers for audio streaming
    res.set({
      'Content-Type': response.headers['content-type'] || 'audio/mpeg',
      'Content-Length': response.headers['content-length'],
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Range',
    });
    
    // Handle range requests for audio seeking
    if (req.headers.range) {
      const range = req.headers.range;
      res.set('Content-Range', response.headers['content-range']);
      res.status(206); // Partial Content
    }
    
    // Pipe the audio stream
    response.data.pipe(res);
    
  } catch (error) {
    console.error(`Audius stream error for track ${req.params.trackId}:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      url: `https://api.audius.co/v1/tracks/${req.params.trackId}/stream`
    });
    
    const errorResponse = {
      error: 'Audius streaming temporarily unavailable',
      message: 'Audio streaming is being fixed. Please use demo mode.',
      trackId: req.params.trackId,
      timestamp: new Date().toISOString()
    };
    
    if (error.response?.status === 404) {
      errorResponse.error = 'Track not found on Audius';
      return res.status(404).json(errorResponse);
    }
    
    if (error.response?.status === 403) {
      errorResponse.error = 'Audius track access denied';
      return res.status(403).json(errorResponse);
    }
    
    if (error.code === 'ECONNABORTED') {
      errorResponse.error = 'Stream request timeout';
      return res.status(408).json(errorResponse);
    }
    
    res.status(500).json(errorResponse);
  }
});

// @route   GET /api/stream/youtube/:videoId
// @desc    Provide YouTube links (cannot directly stream due to ToS)
// @access  Public
router.get('/youtube/:videoId', (req, res) => {
  const { videoId } = req.params;
  
  // YouTube doesn't allow direct streaming, so redirect to YouTube
  res.json({
    message: 'YouTube streams require opening YouTube directly',
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
  });
});

// @route   GET /api/stream/health
// @desc    Health check for streaming service
// @access  Public
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Audio Streaming Proxy',
    timestamp: new Date().toISOString(),
    supportedSources: ['audius', 'youtube']
  });
});

module.exports = router;