import React, { useState, useRef } from 'react';
import { PlayIcon, PauseIcon, StopIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ManualAudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  // Test URLs - we'll test these one by one
  const testUrls = [
    {
      name: 'Test Bell Sound',
      url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      type: 'external'
    },
    {
      name: 'Test MP3',
      url: 'https://file-examples.com/storage/fe05bc4b8de73c03a8b94ce/2017/11/file_example_MP3_700KB.mp3',
      type: 'external'
    },
    {
      name: 'Audius Stream (via proxy)',
      url: 'http://localhost:5000/api/stream/audius/jaKgV',
      type: 'proxy'
    }
  ];

  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const currentTest = testUrls[currentUrlIndex];

  const loadAudio = async (url) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setLoading(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    try {
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
        setLoading(false);
        toast.success(`Audio loaded: ${currentTest.name}`, { duration: 2000 });
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.onerror = (e) => {
        setLoading(false);
        setIsPlaying(false);
        toast.error(`Failed to load: ${currentTest.name}`, { duration: 3000 });
        console.error('Audio load error:', e);
      };

      // Try to load metadata
      audio.load();

    } catch (error) {
      setLoading(false);
      toast.error(`Error: ${error.message}`, { duration: 3000 });
    }
  };

  const handlePlay = async () => {
    if (!audioRef.current) {
      await loadAudio(currentTest.url);
      return;
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
        }
      }
    } catch (error) {
      toast.error(`Playback error: ${error.message}`, { duration: 3000 });
      console.error('Playback error:', error);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const nextUrl = () => {
    handleStop();
    const nextIndex = (currentUrlIndex + 1) % testUrls.length;
    setCurrentUrlIndex(nextIndex);
    setTimeout(() => loadAudio(testUrls[nextIndex].url), 100);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-50 dark:bg-dark-card p-4 rounded-lg border space-y-3">
      <div className="text-sm font-medium text-gray-900 dark:text-dark-text">
        Manual Audio Test: {currentTest.name}
      </div>
      
      <div className="text-xs text-gray-500 dark:text-dark-muted">
        Type: {currentTest.type} • URL: {currentTest.url.substring(0, 50)}...
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={handlePlay}
          disabled={loading}
          className={`p-2 rounded-full ${
            loading ? 'bg-gray-300' : isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          } text-white transition-colors`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <PauseIcon className="w-4 h-4" />
          ) : (
            <PlayIcon className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={handleStop}
          className="p-2 rounded-full bg-gray-500 hover:bg-gray-600 text-white transition-colors"
        >
          <StopIcon className="w-4 h-4" />
        </button>

        <button
          onClick={nextUrl}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
        >
          Next URL ({currentUrlIndex + 1}/{testUrls.length})
        </button>
      </div>

      {duration > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600 dark:text-dark-muted">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-dark-bg rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-dark-muted">
        This tests different audio sources manually. Try each URL to see which ones work.
      </div>
    </div>
  );
};

export default ManualAudioPlayer;