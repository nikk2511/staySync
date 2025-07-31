import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon, StopIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const WorkingAudioPlayer = ({ song, onError, onPlay, onPause, onEnded, className = '' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  // Generate simple audio tones using Web Audio API (most reliable)
  const generateAudioTone = (frequency = 440, duration = 3) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different songs
      const songFreq = 200 + (Math.abs(song.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 800);
      oscillator.frequency.setValueAtTime(songFreq, audioContext.currentTime);
      oscillator.type = 'sine';
      
      // Volume envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + duration - 0.5);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
      
      return { audioContext, oscillator, duration };
    } catch (error) {
      console.error('Web Audio API error:', error);
      return null;
    }
  };

  // Fallback to data URL audio if Web Audio fails
  const getDataAudioUrl = () => {
    // Simple WAV file as data URL (short beep)
    return 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJevrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmYfFR1QquvdolIKC1Kl7u6oVhcMU6nn8bJMCwc7hc/x35EfFBNau+PytmUZFhNauujiuVoqCFyx6tmtZxgXKDOQx+Wxo1cEYqrV8dBwYSYiGy6RvmFMhywicq8qYrbMCPfn6lGcRDKZKvhMdgA7bTlOZjZqXYvGR5ZCHozBT7T5d3yYKYJA+8Bj3yUcKHKh6Kk6V1AqBl6w5KmfRjdqJ3KlZVdGWCCQBqNqJ7/hT4CU8kKLLLWmOG9CXzWS5pBqh3LzNTH4Y1ixaYcLWrxpKOYLSJG+GWtB3g8Ky6mHO2+oLqnSNh8dxlG+5wuKZCe0NYZ9cYtOJSFZN3+ySHT3f6lTzqxdE1zYJnvnX6HWnQXrL1fhNVCLh+rLW3VwKvTKKiMTyElNiC7oZXTXhgGkCqNGLg5H6nHWVVxHZwKVcGhMKKvgpTsAOxaTcO3e4VhUhiTdE2xq3K45YTNuq5pKlcOYI2ZGJLiobADW2/cJ8b5u8qPVPZ4RtzL2U8fCTqJpXLY2iO8MwZhWJnN6fUJUyGLI/9FHJcvVELgGEd42TGqF1lIXNmWMv/4UU2e4Bwsgs1a7xRrfLRbgtPF8WHAVDCJQzGgQD1HfDXLaCMYdOhR2OKP6dQJrEUyU+D5KR9eRzBEYWqoG4vNsOQd57yA7uf';
  };

  useEffect(() => {
    if (!song) return;

    // Skip loading - set ready state immediately for demo mode
    setLoading(false);
    setError(null);
    setDuration(30); // 30 second demo duration
    
    // Don't auto-start - wait for user interaction
    
    return () => {
      // Cleanup any audio contexts
      if (audioRef.current) {
        if (audioRef.current.oscillator) {
          audioRef.current.oscillator.stop();
        }
        if (audioRef.current.audioContext) {
          audioRef.current.audioContext.close();
        }
        if (audioRef.current.progressInterval) {
          clearInterval(audioRef.current.progressInterval);
        }
        if (audioRef.current.audio) {
          audioRef.current.audio.pause();
        }
        audioRef.current = null;
      }
    };
  }, [song]);

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        // Stop current audio
        if (audioRef.current) {
          if (audioRef.current.oscillator) {
            audioRef.current.oscillator.stop();
          }
          if (audioRef.current.audioContext) {
            audioRef.current.audioContext.close();
          }
          audioRef.current = null;
        }
        setIsPlaying(false);
        setCurrentTime(0);
        if (onPause) onPause(song);
      } else {
        // Start Web Audio API tone
        const audioTone = generateAudioTone(440, 30); // 30 second demo
        if (audioTone) {
          audioRef.current = audioTone;
          setIsPlaying(true);
          if (onPlay) onPlay(song);
          
          // Simulate progress
          let elapsed = 0;
          const progressInterval = setInterval(() => {
            elapsed += 0.1;
            setCurrentTime(elapsed);
            if (elapsed >= 30 || !isPlaying) {
              clearInterval(progressInterval);
              setIsPlaying(false);
              setCurrentTime(0);
              if (onEnded) onEnded(song);
            }
          }, 100);
          
          // Store interval for cleanup
          audioRef.current.progressInterval = progressInterval;
          
          toast.success(`🎵 Demo tone playing for "${song.title}"`, {
            duration: 2000
          });
        } else {
          // Fallback to simple data URL audio
          const audio = new Audio(getDataAudioUrl());
          audio.volume = volume / 100;
          audio.loop = true; // Loop the short demo
          
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            await playPromise;
            audioRef.current = { audio };
            setIsPlaying(true);
            if (onPlay) onPlay(song);
          }
        }
      }
    } catch (err) {
      console.error('Play/pause error:', err);
      setError('Demo audio failed');
      toast('Demo audio unavailable. Basic functionality working.', {
        duration: 3000,
        icon: '⚠️',
        style: {
          background: '#f59e0b',
          color: 'white',
        }
      });
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      // Stop Web Audio API
      if (audioRef.current.oscillator) {
        audioRef.current.oscillator.stop();
      }
      if (audioRef.current.audioContext) {
        audioRef.current.audioContext.close();
      }
      if (audioRef.current.progressInterval) {
        clearInterval(audioRef.current.progressInterval);
      }
      // Stop HTML Audio
      if (audioRef.current.audio) {
        audioRef.current.audio.pause();
        audioRef.current.audio.currentTime = 0;
      }
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    if (!duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    // For demo mode, just update the displayed time
    setCurrentTime(newTime);
    
    // If HTML audio is playing, seek it
    if (audioRef.current?.audio) {
      audioRef.current.audio.currentTime = newTime;
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    
    // Volume control for HTML audio
    if (audioRef.current?.audio) {
      audioRef.current.audio.volume = newVolume / 100;
    }
    
    // Volume for Web Audio API would need more complex implementation
    // For demo purposes, we'll just store the value
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className={`text-center p-4 text-red-600 ${className}`}>
        <p className="text-sm">⚠️ Using demo audio while streaming is being fixed</p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-dark-card rounded-lg p-4 space-y-3 ${className}`}>
      {/* Song Info */}
      <div className="text-center">
        <p className="font-medium text-gray-900 dark:text-dark-text truncate">
          {song.title}
        </p>
        <p className="text-sm text-gray-600 dark:text-dark-muted truncate">
          {song.artist}
        </p>
        <p className="text-xs text-orange-600 dark:text-orange-400">
          🔧 Demo audio - Real streaming coming soon!
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-3">
        <button
          onClick={handlePlayPause}
          disabled={loading}
          className={`p-3 rounded-full text-white transition-colors ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : isPlaying 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <PauseIcon className="w-5 h-5" />
          ) : (
            <PlayIcon className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={handleStop}
          className="p-2 rounded-full bg-gray-500 hover:bg-gray-600 text-white transition-colors"
        >
          <StopIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      {duration > 0 && (
        <div className="space-y-2">
          <div 
            className="w-full bg-gray-200 dark:bg-dark-bg rounded-full h-2 cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 dark:text-dark-muted">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Volume Control */}
      <div className="flex items-center space-x-2">
        <SpeakerXMarkIcon className="w-4 h-4 text-gray-600" />
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={handleVolumeChange}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        />
        <SpeakerWaveIcon className="w-4 h-4 text-gray-600" />
        <span className="text-xs text-gray-600 w-8">{volume}%</span>
      </div>
    </div>
  );
};

export default WorkingAudioPlayer;