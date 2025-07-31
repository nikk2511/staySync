import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  MagnifyingGlassIcon, 
  PlayIcon, 
  PlusIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MusicalNoteIcon
} from '@heroicons/react/24/outline';
import { useRoom } from '../../contexts/RoomContext';
import toast from 'react-hot-toast';
import LoadingSpinner from '../ui/LoadingSpinner';
import AudioPlayer from './AudioPlayer';

const SongSearchBar = ({ onSongSelect, showAddToQueue = true, placeholder = "Search for songs..." }) => {
  const { currentRoom, addToQueue } = useRoom();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchSource, setSearchSource] = useState('all');
  const [playingPreview, setPlayingPreview] = useState(null);
  
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounced search function
  const debouncedSearch = useCallback(async (searchQuery) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    
    try {
      const response = await axios.get('/api/search/external', {
        params: {
          q: searchQuery,
          limit: 15,
          source: searchSource
        }
      });

      if (response.data.success) {
        setResults(response.data.songs || []);
        setShowDropdown(true);
        setSelectedIndex(-1);
      }
    } catch (error) {
      console.error('Search error:', error);
      
      if (error.response?.status === 429) {
        toast.error('Search rate limit exceeded. Please try again later.');
      } else {
        toast.error('Failed to search songs. Please try again.');
      }
      
      setResults([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, [searchSource]);

  // Handle input change with debouncing
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (query.trim()) {
        debouncedSearch(query.trim());
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debouncedSearch]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSongSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
      default:
        // Handle other keys
        break;
    }
  };

  // Handle song selection
  const handleSongSelect = async (song) => {
    setShowDropdown(false);
    setQuery('');
    setSelectedIndex(-1);
    
    if (onSongSelect) {
      onSongSelect(song);
      return;
    }

    if (showAddToQueue && currentRoom) {
      await handleAddToQueue(song);
    }
  };

  // Add song to room queue
  const handleAddToQueue = async (song) => {
    try {
      // For external songs, we need to create a song record first
      const songData = {
        title: song.title,
        artist: song.artist,
        duration: song.duration,
        sourceType: song.sourceType,
        sourceURL: song.sourceURL,
        thumbnailURL: song.thumbnailURL,
        metadata: {
          externalId: song.externalId,
          isStreamable: song.metadata?.isStreamable ?? true,
          playCount: song.metadata?.playCount,
          favoriteCount: song.metadata?.favoriteCount,
          description: song.metadata?.description
        },
        previewable: song.previewable,
        warnings: song.warning ? [song.warning] : []
      };

      // Create the song in our database
      const createResponse = await axios.post('/api/music/add-url', songData);
      
      if (createResponse.data.success) {
        const createdSong = createResponse.data.song;
        
        // Add to room queue
        const result = await addToQueue(createdSong._id);
        
        if (result.success) {
          toast.success(`Added "${song.title}" to queue`);
        }
      }
    } catch (error) {
      console.error('Add to queue error:', error);
      
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to add song to queue');
      }
    }
  };

  // Preview audio playback
  const handlePreview = (song, e) => {
    e.stopPropagation();
    
    if (!song.previewable || !song.sourceURL) {
      toast.error('Preview not available for this song');
      return;
    }

    // Toggle preview
    if (playingPreview === song.id) {
      setPlayingPreview(null);
    } else {
      setPlayingPreview(song.id);
    }
  };

  const handlePreviewEnd = () => {
    setPlayingPreview(null);
  };

  const handlePreviewError = (error, song) => {
    console.error('Preview error:', error);
    setPlayingPreview(null);
    toast.error(`Failed to play preview: ${error}`);
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setPlayingPreview(null);
    };
  }, []);

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <LoadingSpinner size="sm" className="text-gray-400" />
          ) : (
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
        
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          className="block w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text placeholder-gray-500 dark:placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />

        {/* Source selector */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <select
            value={searchSource}
            onChange={(e) => setSearchSource(e.target.value)}
            className="text-sm border-none bg-transparent text-gray-500 dark:text-dark-muted focus:outline-none"
          >
            <option value="all">All</option>
            <option value="audius">Audius</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.length === 0 && !loading && (
            <div className="px-4 py-3 text-gray-500 dark:text-dark-muted text-center">
              No songs found
            </div>
          )}
          
          {results.map((song, index) => (
            <div
              key={song.id}
              onClick={() => handleSongSelect(song)}
              className={`px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-dark-border last:border-b-0 ${
                index === selectedIndex
                  ? 'bg-primary-50 dark:bg-primary-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-dark-border/20'
              }`}
            >
              <div className="flex items-center space-x-3">
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-12 h-12">
                  {song.thumbnailURL ? (
                    <img
                      src={song.thumbnailURL}
                      alt={song.title}
                      className="w-full h-full object-cover rounded"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-full h-full bg-gray-200 dark:bg-dark-border rounded flex items-center justify-center">
                    <MusicalNoteIcon className="w-6 h-6 text-gray-400" />
                  </div>
                </div>

                {/* Song Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                      {song.title}
                    </p>
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-border rounded text-gray-600 dark:text-dark-muted">
                      {song.sourceType}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-dark-muted truncate">
                    {song.artist}
                  </p>
                  <div className="flex items-center mt-1 space-x-2">
                    <ClockIcon className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-dark-muted">
                      {formatDuration(song.duration)}
                    </span>
                    {song.metadata?.playCount && (
                      <span className="text-xs text-gray-500 dark:text-dark-muted">
                        • {song.metadata.playCount.toLocaleString()} plays
                      </span>
                    )}
                  </div>
                  {song.warning && (
                    <div className="flex items-center mt-1 space-x-1">
                      <ExclamationTriangleIcon className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs text-yellow-600 dark:text-yellow-400">
                        {song.warning}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  {song.previewable && (
                    <div className="flex items-center">
                      {playingPreview === song.id ? (
                        <AudioPlayer
                          song={song}
                          previewMode={true}
                          autoPlay={true}
                          onEnded={handlePreviewEnd}
                          onError={handlePreviewError}
                          showControls={true}
                          className="w-24"
                        />
                      ) : (
                        <button
                          onClick={(e) => handlePreview(song, e)}
                          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-border text-gray-600 dark:text-dark-muted transition-colors"
                        >
                          <PlayIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                  
                  {showAddToQueue && currentRoom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToQueue(song);
                      }}
                      className="p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SongSearchBar;