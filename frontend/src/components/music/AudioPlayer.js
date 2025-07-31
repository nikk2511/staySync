import React, { useState, useRef, useEffect } from 'react';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AudioPlayer = ({ 
  song, 
  autoPlay = false, 
  onPlay, 
  onPause, 
  onError,
  onEnded,
  className = "",
  showControls = true,
  previewMode = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(previewMode ? 0.3 : 0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState(null);
  
  const audioRef = useRef(null);
  const intervalRef = useRef(null);

  // Initialize audio element
  useEffect(() => {
    if (!song?.sourceURL) return;

    const audio = new Audio();
    audioRef.current = audio;
    
    audio.preload = 'metadata'; // Changed from 'none' to 'metadata'
    audio.volume = volume;
    
    // Event listeners
    const handleLoadStartLocal = () => {
      setIsLoading(true);
      setError(null);
    };

    const handleLoadedMetadataLocal = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration);
      }
    };

    const handleCanPlayLocal = () => {
      setIsLoading(false);
    };

    const handlePlayLocal = () => {
      setIsPlaying(true);
      if (onPlay) onPlay(song);
      
      // Start progress tracking
      intervalRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 1000);
    };

    const handlePauseLocal = () => {
      setIsPlaying(false);
      if (onPause) onPause(song);
      
      // Stop progress tracking
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleEndedLocal = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onEnded) onEnded(song);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleErrorLocal = (e) => {
      console.error('Audio playback error:', e);
      setIsLoading(false);
      setIsPlaying(false);
      
      let errorMessage = 'Failed to play audio';
      
      if (e.target?.error) {
        switch (e.target.error.code) {
          case e.target.error.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error - check your internet connection';
            break;
          case e.target.error.MEDIA_ERR_DECODE:
            errorMessage = 'Audio format not supported';
            break;
          case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio source not supported';
            break;
          default:
            errorMessage = 'Audio playback failed';
        }
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      
      if (onError) onError(errorMessage, song);
    };

    const handleTimeUpdateLocal = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };
    
    audio.addEventListener('loadstart', handleLoadStartLocal);
    audio.addEventListener('loadedmetadata', handleLoadedMetadataLocal);
    audio.addEventListener('canplay', handleCanPlayLocal);
    audio.addEventListener('play', handlePlayLocal);
    audio.addEventListener('pause', handlePauseLocal);
    audio.addEventListener('ended', handleEndedLocal);
    audio.addEventListener('error', handleErrorLocal);
    audio.addEventListener('timeupdate', handleTimeUpdateLocal);
    
    return () => {
      audio.removeEventListener('loadstart', handleLoadStartLocal);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadataLocal);
      audio.removeEventListener('canplay', handleCanPlayLocal);
      audio.removeEventListener('play', handlePlayLocal);
      audio.removeEventListener('pause', handlePauseLocal);
      audio.removeEventListener('ended', handleEndedLocal);
      audio.removeEventListener('error', handleErrorLocal);
      audio.removeEventListener('timeupdate', handleTimeUpdateLocal);
      
      audio.pause();
      audio.src = '';
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [song?.sourceURL, volume, onPlay, onPause, onEnded, onError]);

  // Handle auto play
  useEffect(() => {
    if (autoPlay && audioRef.current && song?.sourceURL) {
      // Small delay to ensure audio is ready
      setTimeout(() => {
        handlePlayPause();
      }, 100);
    }
  }, [autoPlay, song?.sourceURL]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Event handlers are now defined within useEffect

  const handlePlayPause = async () => {
    if (!audioRef.current || !song?.sourceURL) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // Set source if not already set
        if (!audioRef.current.src || audioRef.current.src !== song.sourceURL) {
          audioRef.current.src = song.sourceURL;
        }
        
        // Play audio
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          await playPromise;
        }
        
        // For preview mode, auto-stop after 30 seconds
        if (previewMode) {
          setTimeout(() => {
            if (audioRef.current && isPlaying) {
              audioRef.current.pause();
            }
          }, 30000);
        }
      }
    } catch (error) {
      console.error('Play/pause error:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('🔊 Click here first to enable audio playback!', {
          duration: 5000,
          style: {
            background: '#f59e0b',
            color: 'white',
          }
        });
      } else if (error.name === 'NotSupportedError') {
        toast.error('Audio format not supported by your browser');
      } else if (error.name === 'AbortError') {
        // User paused before audio started, don't show error
        return;
      } else {
        toast.error(`Failed to play audio: ${error.message}`);
      }
      
      setError(error.message);
      if (onError) onError(error.message, song);
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  if (!song) return null;

  return (
    <div className={`audio-player ${className}`}>
      {error && (
        <div className="mb-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      
      {showControls && (
        <div className="flex items-center space-x-3">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            disabled={isLoading}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              isLoading 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <PauseIcon className="w-4 h-4" />
            ) : (
              <PlayIcon className="w-4 h-4 ml-0.5" />
            )}
          </button>

          {/* Progress Bar */}
          <div className="flex-1 flex items-center space-x-2">
            <span className="text-xs text-gray-500 w-10">
              {formatTime(currentTime)}
            </span>
            
            <div 
              className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded cursor-pointer"
              onClick={handleSeek}
            >
              <div 
                className="h-full bg-primary-600 rounded transition-all"
                style={{ 
                  width: duration ? `${(currentTime / duration) * 100}%` : '0%' 
                }}
              />
            </div>
            
            <span className="text-xs text-gray-500 w-10">
              {formatTime(duration)}
            </span>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-1">
            <button
              onClick={toggleMute}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {isMuted ? (
                <SpeakerXMarkIcon className="w-4 h-4" />
              ) : (
                <SpeakerWaveIcon className="w-4 h-4" />
              )}
            </button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const newVolume = parseFloat(e.target.value);
                setVolume(newVolume);
                if (newVolume > 0) setIsMuted(false);
              }}
              className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}
      
      {previewMode && isPlaying && (
        <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
          🎵 Preview playing (30s max)
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;