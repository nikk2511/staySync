import React, { useState } from 'react';
import { SpeakerWaveIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const SimpleAudioTest = () => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const generateTestTone = () => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create oscillator for beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configure sound
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 800Hz beep
      oscillator.type = 'sine';
      
      // Volume envelope (fade in/out)
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
      
      // Play for 0.5 seconds
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      return Promise.resolve(true);
    } catch (error) {
      console.error('Web Audio API failed:', error);
      throw error;
    }
  };

  const testSimpleAudio = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Method 1: Web Audio API (most reliable)
      console.log('Testing Web Audio API...');
      await generateTestTone();
      
      setTestResult('success');
      toast.success('🎵 Audio working! Web Audio API test passed.', {
        duration: 3000
      });
      
    } catch (webAudioError) {
      console.warn('Web Audio API failed, trying HTML5 audio...', webAudioError);
      
      try {
        // Method 2: Data URL audio (no network required)
        const audioData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJevrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmYfFR1QquvdolIKC1Kl7u6oVhcMU6nn8bJMCwc7hc/x35EfFBNau+PytmUZFhNauujiuVoqCFyx6tmtZxgXKDOQx+Wxo1cEYqrV8dBwYSYiGy6RvmFMhywicq8qYrbMCPfn6lGcRDKZKvhMdgA7bTlOZjZqXYvGR5ZCHozBT7T5d3yYKYJA+8Bj3yUcKHKh6Kk6V1AqBl6w5KmfRjdqJ3KlZVdGWCCQBqNqJ7/hT4CU8kKLLLWmOG9CXzWS5pBqh3LzNTH4Y1ixaYcLWrxpKOYLSJG+GWtB3g8Ky6mHO2+oLqnSNh8dxlG+5wuKZCe0NYZ9cYtOJSFZN3+ySHT3f6lTzqxdE1zYJnvnX6HWnQXrL1fhNVCLh+rLW3VwKvTKKiMTyElNiC7oZXTXhgGkCqNGLg5H6nHWVVxHZwKVcGhMKKvgpTsAOxaTcO3e4VhUhiTdE2xq3K45YTNuq5pKlcOYI2ZGJLiobADW2/cJ8b5u8qPVPZ4RtzL2U8fCTqJpXLY2iO8MwZhWJnN6fUJUyGLI/9FHJcvVELgGEd42TGqF1lIXNmWMv/4UU2e4Bwsgs1a7xRrfLRbgtPF8WHAVDCJQzGgclQD1HfDXLaCMYdOhR2OKP6dQJrEUyU+D5KR9eRzBEYWqoG4vNsOQd57yA7uf';
        
        const audio = new Audio(audioData);
        audio.volume = 0.3;
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          setTimeout(() => audio.pause(), 500);
        }
        
        setTestResult('success');
        toast.success('🎵 Audio working! HTML5 test passed.', {
          duration: 3000
        });
        
      } catch (htmlAudioError) {
        console.error('All audio methods failed:', htmlAudioError);
        setTestResult('error');
        
        if (htmlAudioError.name === 'NotAllowedError') {
          toast.error('🔊 Browser blocked audio. Please allow autoplay for this site!', {
            duration: 5000,
            style: {
              background: '#f59e0b',
              color: 'white',
            }
          });
        } else {
          toast.error('Audio test failed. Try clicking the button again or check browser audio settings.', {
            duration: 5000
          });
        }
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
    if (testing) return 'Testing...';
    if (testResult === 'success') return 'Audio Works!';
    if (testResult === 'error') return 'Try Again';
    return 'Enable Audio';
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
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={testSimpleAudio}
        disabled={testing}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${getButtonColor()} ${
          testing ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {getIcon()}
        <span>{getButtonText()}</span>
      </button>
      
      {testResult === 'success' && (
        <p className="text-xs text-green-600 dark:text-green-400 text-center">
          ✅ Browser audio enabled! You can now play music.
        </p>
      )}
      
      {testResult === 'error' && (
        <p className="text-xs text-red-600 dark:text-red-400 text-center">
          ❌ Audio blocked. Check browser settings or try again.
        </p>
      )}
    </div>
  );
};

export default SimpleAudioTest;