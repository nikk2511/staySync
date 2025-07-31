import React, { useState } from 'react';
import { SpeakerWaveIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import axios from 'axios';

const AudioTestButtonDynamic = () => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const testAudio = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // First, get a working track from our search API
      console.log('Fetching working audio track...');
      const searchResponse = await axios.get('/api/search/external?q=lofi&limit=1');
      
      if (!searchResponse.data.success || !searchResponse.data.songs?.length) {
        throw new Error('No songs found from search API');
      }

      const workingTrack = searchResponse.data.songs[0];
      console.log('Using track:', workingTrack.title, 'by', workingTrack.artist);

      // Test audio sources in priority order
      const testSources = [
        'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', // Reliable external source
        workingTrack.sourceURL, // Our Audius proxy with known working track
        'https://file-examples.com/storage/fe05bc4b8de73c03a8b94ce/2017/11/file_example_MP3_700KB.mp3'
      ];

      let audioWorked = false;
      let workingSource = null;
      
      for (const testUrl of testSources) {
        try {
          console.log(`Testing audio source: ${testUrl}`);
          
          const audio = new Audio();
          audio.volume = 0.3;
          audio.crossOrigin = 'anonymous';
          
          // Wait for audio to load
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Load timeout')), 5000);
            
            audio.onloadedmetadata = () => {
              clearTimeout(timeout);
              resolve();
            };
            
            audio.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('Load failed'));
            };
            
            audio.src = testUrl;
          });

          // Try to play
          const playPromise = audio.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            
            // Stop after 2 seconds
            setTimeout(() => {
              audio.pause();
              audio.currentTime = 0;
            }, 2000);
            
            audioWorked = true;
            workingSource = testUrl;
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

      setTestResult('success');
      toast.success(`🎵 Audio working! Source: ${workingSource.includes('soundjay') ? 'External' : workingSource.includes('audius') ? 'Audius Stream' : 'Test MP3'}`, {
        duration: 4000
      });
      
    } catch (error) {
      console.error('Audio test failed:', error);
      setTestResult('error');
      
      if (error.message.includes('interaction')) {
        toast.error('🔊 Click this button first to enable audio!', {
          duration: 5000
        });
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        toast.error('🌐 Network error - check your connection', {
          duration: 4000
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

export default AudioTestButtonDynamic;