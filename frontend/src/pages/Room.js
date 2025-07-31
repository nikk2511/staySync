import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '../contexts/RoomContext';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import SongSearchBar from '../components/music/SongSearchBar';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { 
  PlayIcon, 
  PauseIcon, 
  ForwardIcon, 
  SpeakerWaveIcon,
  ClockIcon,
  MusicalNoteIcon,
  UserGroupIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
// import toast from 'react-hot-toast'; // Temporarily unused

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    currentRoom, 
    currentTrack, 
    queue, 
    isPlaying, 
    volume,
    currentTime,
    joinRoom, 
    leaveRoom,
    removeFromQueue,
    isRoomHost,
    isRoomModerator,
    loading 
  } = useRoom();
  const { 
    // socket, // Temporarily unused
    isConnected, 
    playMusic, 
    pauseMusic, 
    nextMusic, 
    changeVolume 
  } = useSocket();
  
  const [showSearch, setShowSearch] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);

  // Join room on component mount
  useEffect(() => {
    if (roomId && user && !currentRoom) {
      joinRoom(roomId);
    }
  }, [roomId, user, currentRoom, joinRoom]);

  // Leave room on unmount
  useEffect(() => {
    return () => {
      if (currentRoom) {
        leaveRoom();
      }
    };
  }, [currentRoom, leaveRoom]);

  // Update local volume when room volume changes
  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle music controls
  const handlePlayPause = () => {
    if (!currentRoom || !isConnected) return;
    
    if (isPlaying) {
      pauseMusic(currentRoom._id, currentTime);
    } else if (currentTrack?.songId) {
      playMusic(currentRoom._id, currentTrack.songId._id, currentTime);
    } else if (queue.length > 0) {
      playMusic(currentRoom._id, queue[0].songId._id, 0);
    }
  };

  const handleNext = () => {
    if (!currentRoom || !isConnected) return;
    nextMusic(currentRoom._id);
  };

  const handleVolumeChange = (newVolume) => {
    setLocalVolume(newVolume);
    if (currentRoom && isConnected) {
      changeVolume(currentRoom._id, newVolume);
    }
  };

  const handleRemoveFromQueue = (songId) => {
    removeFromQueue(songId);
  };

  // Check permissions
  const canControlMusic = isRoomHost(currentRoom) || isRoomModerator(currentRoom);
  const canAddSongs = currentRoom?.settings?.allowMembersToAddSongs || canControlMusic;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-4">
            Room not found
          </h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container mx-auto px-4 sm:px-6 py-6">
        {/* Room Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-dark-text">
                {currentRoom.name}
              </h1>
              <div className="flex items-center mt-2 space-x-4 text-sm text-gray-600 dark:text-dark-muted">
                <div className="flex items-center">
                  <UserGroupIcon className="w-4 h-4 mr-1" />
                  {currentRoom.onlineMemberCount || currentRoom.memberCount} members
                </div>
                <div className="flex items-center">
                  <MusicalNoteIcon className="w-4 h-4 mr-1" />
                  {queue.length} in queue
                </div>
              </div>
            </div>
            
            {canAddSongs && (
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="btn-primary flex items-center"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Add Song
              </button>
            )}
          </div>
          
          {/* Search Bar */}
          {showSearch && canAddSongs && (
            <div className="mt-4 p-4 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                  Search & Add Songs
                </h3>
                <button
                  onClick={() => setShowSearch(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-dark-muted dark:hover:text-dark-text"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <SongSearchBar 
                placeholder="Search Audius, YouTube, or upload..."
                showAddToQueue={true}
              />
            </div>
          )}
        </div>
        
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Music Player & Queue */}
          <div className="lg:col-span-3 space-y-6">
            {/* Now Playing */}
            <div className="card dark:card-dark p-6">
              <h2 className="text-xl font-semibold mb-4">Now Playing</h2>
              
              {currentTrack?.songId ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    {currentTrack.songId.thumbnailURL && (
                      <img
                        src={currentTrack.songId.thumbnailURL}
                        alt={currentTrack.songId.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                        {currentTrack.songId.title}
                      </h3>
                      <p className="text-gray-600 dark:text-dark-muted">
                        {currentTrack.songId.artist}
                      </p>
                      <div className="flex items-center mt-1 space-x-2 text-sm text-gray-500 dark:text-dark-muted">
                        <ClockIcon className="w-4 h-4" />
                        <span>{formatDuration(currentTime)} / {formatDuration(currentTrack.songId.duration)}</span>
                        {currentTrack.songId.sourceType && (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-dark-border rounded text-xs">
                            {currentTrack.songId.sourceType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Controls */}
                  {canControlMusic && (
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handlePlayPause}
                        className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full transition-colors"
                      >
                        {isPlaying ? (
                          <PauseIcon className="w-6 h-6" />
                        ) : (
                          <PlayIcon className="w-6 h-6" />
                        )}
                      </button>
                      
                      <button
                        onClick={handleNext}
                        className="p-2 text-gray-600 hover:text-gray-900 dark:text-dark-muted dark:hover:text-dark-text"
                      >
                        <ForwardIcon className="w-5 h-5" />
                      </button>
                      
                      <div className="flex items-center space-x-2">
                        <SpeakerWaveIcon className="w-5 h-5 text-gray-500" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={localVolume}
                          onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                          className="w-20"
                        />
                        <span className="text-sm text-gray-500 w-8">{localVolume}%</span>
                      </div>
                    </div>
                  )}
                  
                  {!canControlMusic && (
                    <p className="text-sm text-gray-500 dark:text-dark-muted">
                      Only the host can control music playback
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MusicalNoteIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-dark-muted">
                    No song currently playing
                  </p>
                  {queue.length > 0 && canControlMusic && (
                    <button
                      onClick={() => playMusic(currentRoom._id, queue[0].songId._id, 0)}
                      className="btn-primary mt-4"
                    >
                      Play First Song in Queue
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Queue */}
            <div className="card dark:card-dark p-6">
              <h2 className="text-xl font-semibold mb-4">
                Queue ({queue.length} songs)
              </h2>
              
              {queue.length > 0 ? (
                <div className="space-y-3">
                  {queue.map((item, index) => (
                    <div
                      key={item._id || index}
                      className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-dark-border rounded-lg"
                    >
                      <span className="text-sm text-gray-500 dark:text-dark-muted w-6">
                        {index + 1}
                      </span>
                      
                      {item.songId?.thumbnailURL && (
                        <img
                          src={item.songId.thumbnailURL}
                          alt={item.songId.title}
                          className="w-10 h-10 rounded object-cover"
                        />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                          {item.songId?.title}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-dark-muted truncate">
                          {item.songId?.artist}
                        </p>
                      </div>
                      
                      <span className="text-sm text-gray-500 dark:text-dark-muted">
                        {formatDuration(item.songId?.duration || 0)}
                      </span>
                      
                      {(canControlMusic || item.addedBy === user?._id) && (
                        <button
                          onClick={() => handleRemoveFromQueue(item.songId._id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MusicalNoteIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-dark-muted">
                    No songs in queue
                  </p>
                  {canAddSongs && (
                    <button
                      onClick={() => setShowSearch(true)}
                      className="btn-outline mt-4"
                    >
                      Add Songs
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Chat Sidebar */}
          <div className="lg:col-span-1">
            <div className="card dark:card-dark p-6 h-96">
              <h3 className="text-lg font-semibold mb-4">Chat</h3>
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-dark-muted text-sm">
                  Real-time chat coming soon!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;