const axios = require('axios');

class MusicSearchService {
  constructor() {
    this.audiusBaseUrl = 'https://api.audius.co/v1';
    this.youtubeApiKey = process.env.YOUTUBE_API_KEY;
    this.youtubeBaseUrl = 'https://www.googleapis.com/youtube/v3';
    
    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests
  }

  // Rate limiting helper
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  // Sanitize search query
  sanitizeQuery(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid search query');
    }
    
    // Remove special characters and limit length
    const sanitized = query
      .trim()
      .replace(/[^\w\s-]/g, '')
      .substring(0, 100);
    
    if (sanitized.length < 2) {
      throw new Error('Search query must be at least 2 characters');
    }
    
    return sanitized;
  }

  // Search songs using Audius API
  async searchAudius(query, limit = 20) {
    try {
      await this.rateLimit();
      
      const sanitizedQuery = this.sanitizeQuery(query);
      
      const response = await axios.get(`${this.audiusBaseUrl}/tracks/search`, {
        params: {
          query: sanitizedQuery,
          limit: Math.min(limit, 50), // Cap at 50
          offset: 0
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'MusicApp/1.0'
        }
      });

      if (!response.data || !response.data.data) {
        return [];
      }

      return response.data.data.map(track => this.formatAudiusTrack(track));
    } catch (error) {
      console.error('Audius API error:', error.message);
      
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('Search request timed out. Please try again.');
      }
      
      throw new Error('Failed to search songs. Please try again.');
    }
  }

  // Format Audius track data
  formatAudiusTrack(track) {
    const streamUrl = this.getAudiusStreamUrl(track.id);
    
    return {
      id: `audius_${track.id}`,
      title: track.title || 'Unknown Title',
      artist: track.user?.name || 'Unknown Artist',
      duration: track.duration || 0,
      sourceType: 'audius',
      sourceURL: streamUrl,
      thumbnailURL: track.artwork?.['480x480'] || track.artwork?.['150x150'] || null,
      externalId: track.id.toString(),
      metadata: {
        genre: track.genre,
        playCount: track.play_count,
        favoriteCount: track.favorite_count,
        repostCount: track.repost_count,
        releaseDate: track.release_date,
        isStreamable: true
      },
      previewable: true
    };
  }

  // Generate Audius stream URL (via our proxy)
  getAudiusStreamUrl(trackId) {
    // Use our backend proxy to bypass CORS issues
    return `http://localhost:5000/api/stream/audius/${trackId}`;
  }

  // Search songs using YouTube Data API (fallback)
  async searchYouTube(query, limit = 20) {
    if (!this.youtubeApiKey) {
      throw new Error('YouTube API key not configured');
    }

    try {
      await this.rateLimit();
      
      const sanitizedQuery = this.sanitizeQuery(query);
      
      const response = await axios.get(`${this.youtubeBaseUrl}/search`, {
        params: {
          part: 'snippet',
          q: `${sanitizedQuery} audio`,
          type: 'video',
          maxResults: Math.min(limit, 25),
          key: this.youtubeApiKey,
          videoCategoryId: '10', // Music category
          safeSearch: 'moderate'
        },
        timeout: 10000
      });

      if (!response.data || !response.data.items) {
        return [];
      }

      // Get video details for duration
      const videoIds = response.data.items.map(item => item.id.videoId);
      const detailsResponse = await axios.get(`${this.youtubeBaseUrl}/videos`, {
        params: {
          part: 'contentDetails,statistics',
          id: videoIds.join(','),
          key: this.youtubeApiKey
        },
        timeout: 10000
      });

      const videoDetails = detailsResponse.data.items || [];
      
      return response.data.items.map((item, index) => {
        const details = videoDetails.find(d => d.id === item.id.videoId);
        const duration = details ? this.parseYouTubeDuration(details.contentDetails.duration) : 0;
        
        return this.formatYouTubeTrack(item, duration);
      });
    } catch (error) {
      console.error('YouTube API error:', error.message);
      
      if (error.response?.status === 403) {
        throw new Error('YouTube API quota exceeded.');
      }
      
      throw new Error('Failed to search YouTube. Please try again.');
    }
  }

  // Format YouTube track data
  formatYouTubeTrack(item, duration) {
    const videoId = item.id.videoId;
    
    return {
      id: `youtube_${videoId}`,
      title: item.snippet.title.replace(/\s*\[.*?\]\s*|\s*\(.*?\)\s*/g, '').trim(),
      artist: item.snippet.channelTitle.replace(/\s*-?\s*Topic\s*$/i, '').trim(),
      duration: duration,
      sourceType: 'youtube',
      sourceURL: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailURL: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      externalId: videoId,
      metadata: {
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt,
        description: item.snippet.description,
        isStreamable: false // YouTube requires special handling
      },
      previewable: false,
      warning: 'YouTube videos cannot be directly streamed. This will open YouTube.'
    };
  }

  // Parse YouTube duration format (PT4M13S -> 253 seconds)
  parseYouTubeDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Main search function with Audius primary, YouTube fallback
  async searchSongs(query, limit = 20, includeYouTube = true) {
    const results = {
      audius: [],
      youtube: [],
      total: 0,
      query: query
    };

    try {
      // Try Audius first
      results.audius = await this.searchAudius(query, limit);
      results.total += results.audius.length;
      
      // If we have enough results from Audius, return those
      if (results.audius.length >= 10 || !includeYouTube) {
        return {
          songs: results.audius,
          sources: ['audius'],
          total: results.audius.length,
          query: query
        };
      }
    } catch (error) {
      console.warn('Audius search failed:', error.message);
    }

    try {
      // Try YouTube as fallback or supplement
      if (includeYouTube && this.youtubeApiKey) {
        const remainingLimit = Math.max(limit - results.audius.length, 5);
        results.youtube = await this.searchYouTube(query, remainingLimit);
        results.total += results.youtube.length;
      }
    } catch (error) {
      console.warn('YouTube search failed:', error.message);
    }

    // Combine results (Audius first, then YouTube)
    const combinedSongs = [...results.audius, ...results.youtube];
    const sources = [];
    if (results.audius.length > 0) sources.push('audius');
    if (results.youtube.length > 0) sources.push('youtube');

    return {
      songs: combinedSongs.slice(0, limit),
      sources: sources,
      total: combinedSongs.length,
      query: query
    };
  }

  // Get track details by ID and source
  async getTrackDetails(trackId, source) {
    if (source === 'audius') {
      const audiusId = trackId.replace('audius_', '');
      
      try {
        await this.rateLimit();
        
        const response = await axios.get(`${this.audiusBaseUrl}/tracks/${audiusId}`, {
          timeout: 10000
        });
        
        if (response.data && response.data.data) {
          return this.formatAudiusTrack(response.data.data);
        }
      } catch (error) {
        console.error('Failed to get Audius track details:', error.message);
      }
    }
    
    return null;
  }

  // Validate if a stream URL is accessible
  async validateStreamUrl(url) {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        validateStatus: (status) => status < 400
      });
      
      const contentType = response.headers['content-type'];
      return contentType && contentType.startsWith('audio/');
    } catch (error) {
      console.warn('Stream URL validation failed:', error.message);
      return false;
    }
  }
}

module.exports = new MusicSearchService();