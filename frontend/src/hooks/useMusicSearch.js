import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export const useMusicSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  
  const abortControllerRef = useRef(null);
  const cacheRef = useRef(new Map());

  // Search songs from external APIs
  const searchSongs = useCallback(async (query, options = {}) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return { success: false, error: 'Query too short' };
    }

    const searchKey = `${query.trim()}_${options.source || 'all'}_${options.limit || 20}`;
    
    // Check cache first
    if (cacheRef.current.has(searchKey)) {
      const cachedResult = cacheRef.current.get(searchKey);
      setSearchResults(cachedResult.songs);
      return { success: true, ...cachedResult, cached: true };
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('/api/search/external', {
        params: {
          q: query.trim(),
          limit: options.limit || 20,
          source: options.source || 'all'
        },
        signal: abortControllerRef.current.signal
      });

      if (response.data.success) {
        const result = {
          songs: response.data.songs || [],
          sources: response.data.sources || [],
          total: response.data.total || 0,
          query: response.data.query
        };

        setSearchResults(result.songs);
        
        // Cache the result for 5 minutes
        cacheRef.current.set(searchKey, result);
        setTimeout(() => {
          cacheRef.current.delete(searchKey);
        }, 5 * 60 * 1000);

        // Add to search history
        setSearchHistory(prev => {
          const newHistory = [query.trim(), ...prev.filter(q => q !== query.trim())];
          return newHistory.slice(0, 10); // Keep last 10 searches
        });

        return { success: true, ...result, cached: false };
      } else {
        throw new Error('Search failed');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Search cancelled' };
      }

      console.error('Music search error:', error);
      
      let errorMessage = 'Failed to search songs';
      
      if (error.response?.status === 429) {
        errorMessage = 'Search rate limit exceeded. Please try again later.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      setError(errorMessage);
      setSearchResults([]);
      
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  // Get track details
  const getTrackDetails = useCallback(async (trackId, source) => {
    try {
      const response = await axios.get(`/api/music/track-details/${source}/${trackId}`);
      
      if (response.data.success) {
        return { success: true, track: response.data.track };
      } else {
        throw new Error('Failed to get track details');
      }
    } catch (error) {
      console.error('Track details error:', error);
      
      const errorMessage = error.response?.data?.error || 'Failed to get track details';
      return { success: false, error: errorMessage };
    }
  }, []);

  // Validate stream URL
  const validateStreamUrl = useCallback(async (url) => {
    try {
      const response = await axios.post('/api/music/validate-stream', { url });
      
      if (response.data.success) {
        return { success: true, isValid: response.data.isValid };
      } else {
        throw new Error('Validation failed');
      }
    } catch (error) {
      console.error('Stream validation error:', error);
      return { success: false, error: error.response?.data?.error || 'Validation failed' };
    }
  }, []);

  // Add external song to database
  const addExternalSong = useCallback(async (songData) => {
    try {
      const response = await axios.post('/api/music/add-url', songData);
      
      if (response.data.success) {
        toast.success('Song added successfully');
        return { success: true, song: response.data.song };
      } else {
        throw new Error('Failed to add song');
      }
    } catch (error) {
      console.error('Add external song error:', error);
      
      const errorMessage = error.response?.data?.error || 'Failed to add song';
      toast.error(errorMessage);
      
      return { success: false, error: errorMessage };
    }
  }, []);

  // Clear search results
  const clearResults = useCallback(() => {
    setSearchResults([]);
    setError(null);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    // State
    searchResults,
    loading,
    error,
    searchHistory,
    
    // Actions
    searchSongs,
    getTrackDetails,
    validateStreamUrl,
    addExternalSong,
    clearResults,
    clearHistory,
    clearCache
  };
};