import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SongSearchBar from '../components/music/SongSearchBar';
import { useMusicSearch } from '../hooks/useMusicSearch';
import SimpleAudioTest from '../components/ui/SimpleAudioTest';
import ManualAudioPlayer from '../components/ui/ManualAudioPlayer';
import CreateRoomModal from '../components/modals/CreateRoomModal';
import RealAudioPlayer from '../components/music/RealAudioPlayer';
import { 
  MusicalNoteIcon, 
  PlusIcon, 
  PlayIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const { searchResults } = useMusicSearch(); // loading temporarily unused
  const [showMusicDiscovery, setShowMusicDiscovery] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [currentlyPlayingSong, setCurrentlyPlayingSong] = useState(null);

  const handleSongSelect = (song) => {
    // Actually play the song instead of just showing a toast
    setCurrentlyPlayingSong(song);
    toast.success(`🎵 Now playing: "${song.title}" by ${song.artist}`, {
      duration: 3000
    });
  };

  const handleCreateRoom = () => {
    if (!isAuthenticated) {
      toast.error('Please sign up or login to create rooms');
      return;
    }
    setShowCreateRoomModal(true);
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text mb-8">
          {isAuthenticated ? `Welcome back, ${user?.name}!` : 'Discover Music 🎵'}
        </h1>
        
        {/* Audio Status Banner */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            🎵 <strong>Real Audio Mode:</strong> Now attempting to stream actual songs from Audius! 
            <strong className="text-blue-900 dark:text-blue-100">Player will try multiple sources to find working audio.</strong>
            If streaming fails, fallback audio will be used as backup.
          </p>
        </div>

        {!isAuthenticated && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              🎵 <strong>Guest Mode:</strong> You can discover and listen to millions of songs! 
              <strong className="text-blue-900 dark:text-blue-100">Click "Enable Audio" first to test playback.</strong>
              <a href="/signup" className="ml-2 text-blue-600 dark:text-blue-400 hover:underline font-medium">
                Sign up
              </a> to create rooms and listen with friends.
            </p>
          </div>
        )}
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Music Discovery */}
            <div className="card dark:card-dark p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
                  Discover Music
                </h2>
                <div className="flex items-center space-x-3">
                  <SimpleAudioTest />
                  <button
                    onClick={() => setShowMusicDiscovery(!showMusicDiscovery)}
                    className="btn-outline flex items-center"
                  >
                    <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
                    {showMusicDiscovery ? 'Hide Search' : 'Search Music'}
                  </button>
                </div>
              </div>
              
              {showMusicDiscovery && (
                <div className="space-y-4">
                  <SongSearchBar 
                    placeholder="Search for any song from Audius or YouTube..."
                    showAddToQueue={false}
                    onSongSelect={handleSongSelect}
                  />
                  
                  {searchResults.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">
                        Search Results
                      </h3>
                      <div className="grid gap-3">
                        {searchResults.slice(0, 6).map((song) => (
                          <div
                            key={song.id}
                            className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-dark-border rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border/80 transition-colors"
                          >
                            {song.thumbnailURL && (
                              <img
                                src={song.thumbnailURL}
                                alt={song.title}
                                className="w-12 h-12 rounded object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                                {song.title}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-dark-muted truncate">
                                {song.artist}
                              </p>
                              <div className="flex items-center mt-1 space-x-2 text-xs text-gray-500">
                                <ClockIcon className="w-3 h-3" />
                                <span>{formatDuration(song.duration)}</span>
                                <span className="px-2 py-1 bg-gray-200 dark:bg-dark-bg rounded">
                                  {song.sourceType}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleSongSelect(song)}
                              className="p-2 text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-full transition-colors"
                            >
                              <PlayIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {!showMusicDiscovery && (
                <div className="space-y-4">
                  <p className="text-gray-600 dark:text-dark-muted">
                    Discover millions of songs from Audius and YouTube. Search to get started!
                  </p>
                  
                  {/* Audio Debugging Section */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-3">
                      🔧 Audio Debugging (for troubleshooting)
                    </h3>
                    <ManualAudioPlayer />
                  </div>
                </div>
              )}
            </div>
            
            {/* Room List */}
            <div className="card dark:card-dark p-6">
              <h2 className="text-xl font-semibold mb-4">
                {isAuthenticated ? 'Your Rooms' : 'Music Rooms'}
              </h2>
              <div className="text-center py-8">
                <MusicalNoteIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                {isAuthenticated ? (
                  <>
                    <p className="text-gray-600 dark:text-dark-muted mb-4">
                      No rooms yet. Create your first room to start listening with friends!
                    </p>
                    <button 
                      onClick={handleCreateRoom}
                      className="btn-primary flex items-center mx-auto"
                    >
                      <PlusIcon className="w-5 h-5 mr-2" />
                      Create Your First Room
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600 dark:text-dark-muted mb-4">
                      Join music rooms to listen with friends in perfect sync!
                    </p>
                    <div className="space-y-3">
                      <a 
                        href="/signup" 
                        className="btn-primary flex items-center justify-center mx-auto max-w-xs"
                      >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Sign Up to Create Rooms
                      </a>
                      <a 
                        href="/login" 
                        className="btn-outline flex items-center justify-center mx-auto max-w-xs"
                      >
                        Login to Join Rooms
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card dark:card-dark p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button 
                  onClick={handleCreateRoom}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create Room
                </button>
                <button className="btn-outline w-full">Join Room</button>
              </div>
            </div>
            
            <div className="card dark:card-dark p-6">
              <h3 className="text-lg font-semibold mb-4">Music Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-dark-muted">Rooms Created</span>
                  <span className="font-medium">{user?.stats?.roomsCreated || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-dark-muted">Rooms Joined</span>
                  <span className="font-medium">{user?.stats?.roomsJoined || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-dark-muted">Songs Played</span>
                  <span className="font-medium">{user?.stats?.songsPlayed || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-dark-muted">Chat Messages</span>
                  <span className="font-medium">{user?.stats?.chatMessages || 0}</span>
                </div>
              </div>
            </div>
            
            <div className="card dark:card-dark p-6">
              <h3 className="text-lg font-semibold mb-4">How It Works</h3>
              <div className="space-y-3 text-sm text-gray-600 dark:text-dark-muted">
                <div className="flex items-start space-x-2">
                  <span className="bg-primary-100 dark:bg-primary-900 text-primary-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">1</span>
                  <span>Create or join a music room</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="bg-primary-100 dark:bg-primary-900 text-primary-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">2</span>
                  <span>Search and add songs from Audius or YouTube</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="bg-primary-100 dark:bg-primary-900 text-primary-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">3</span>
                  <span>Listen together in perfect sync with friends</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="bg-primary-100 dark:bg-primary-900 text-primary-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">4</span>
                  <span>Chat and get AI-powered suggestions</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Currently Playing Song */}
        {currentlyPlayingSong && (
          <div className="fixed bottom-6 right-6 bg-white dark:bg-dark-card shadow-lg rounded-lg p-4 border border-gray-200 dark:border-dark-border max-w-sm">
            <div className="flex items-center space-x-3 mb-3">
              {currentlyPlayingSong.thumbnailURL && (
                <img
                  src={currentlyPlayingSong.thumbnailURL}
                  alt={currentlyPlayingSong.title}
                  className="w-12 h-12 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                  {currentlyPlayingSong.title}
                </p>
                <p className="text-xs text-gray-600 dark:text-dark-muted truncate">
                  {currentlyPlayingSong.artist}
                </p>
              </div>
              <button
                onClick={() => setCurrentlyPlayingSong(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-dark-border rounded-full"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <RealAudioPlayer
              song={currentlyPlayingSong}
              onError={(error) => {
                toast(error, { 
                  duration: 5000,
                  icon: '⚠️',
                  style: {
                    background: '#f59e0b',
                    color: 'white',
                  }
                });
              }}
              onEnded={() => {
                toast.success('🎵 Song finished!');
              }}
            />
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={showCreateRoomModal}
        onClose={() => setShowCreateRoomModal(false)}
      />
    </div>
  );
};

export default Dashboard;