import React, { useState } from 'react';
import { SpeakerWaveIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AudioTestButton = () => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const testAudio = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Try multiple audio sources for testing
      const testSources = [
        'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        'http://localhost:5000/api/stream/audius/jaKgV', // Working Audius track from search
        'https://file-examples.com/storage/fe05bc4b8de73c03a8b94ce/2017/11/file_example_MP3_700KB.mp3'
      ];

      let audioWorked = false;
      
      for (const testUrl of testSources) {
        try {
          console.log(`Testing audio source: ${testUrl}`);
          
          const audio = new Audio(testUrl);
          audio.volume = 0.3;
          audio.preload = 'metadata';
          audio.crossOrigin = 'anonymous';

          const playPromise = audio.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            
            // Stop after 2 seconds
            setTimeout(() => {
              audio.pause();
              audio.currentTime = 0;
            }, 2000);
            
            audioWorked = true;
            setTestResult('success');
            toast.success('🎵 Audio is working! You can now play songs.', {
              duration: 3000
            });
            break; // Success, exit loop
          }
        } catch (sourceError) {
          console.warn(`Failed to play ${testUrl}:`, sourceError.message);
          continue; // Try next source
        }
      }

      if (!audioWorked) {
        throw new Error('All audio sources failed to load');
      }
      
    } catch (error) {
      console.error('Audio test failed:', error);
      setTestResult('error');
      
      if (error.name === 'NotAllowedError') {
        toast.error('🔊 Browser blocked audio. Please click this button to enable!', {
          duration: 5000
        });
      } else {
        toast.error(`Audio test failed: ${error.message}`, {
          duration: 4000
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const getButtonColor = () => {
    if (testing) return 'bg-yellow-500 hover:bg-yellow-600';
    if (testResult === 'success') return 'bg-green-500 hover:bg-green-600';
    if (testResult === 'error') return 'bg-red-500 hover:bg-red-600';
    return 'bg-blue-500 hover:bg-blue-600';
  };

  const getButtonText = () => {
    if (testing) return 'Testing Audio...';
    if (testResult === 'success') return 'Audio Working!';
    if (testResult === 'error') return 'Test Failed - Retry';
    return 'Test Audio';
  };

  const getIcon = () => {
    if (testing) {
      return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
    }
    if (testResult === 'success') return <CheckCircleIcon className="w-4 h-4" />;
    if (testResult === 'error') return <XCircleIcon className="w-4 h-4" />;
    return <SpeakerWaveIcon className="w-4 h-4" />;
  };

  return (
    <button
      onClick={testAudio}
      disabled={testing}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${getButtonColor()} ${
        testing ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      {getIcon()}
      <span>{getButtonText()}</span>
    </button>
  );
};

export default AudioTestButton;