import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import SongSearchBar from '../components/music/SongSearchBar';
import { useMusicSearch } from '../hooks/useMusicSearch';
import SimpleAudioTest from '../components/ui/SimpleAudioTest';
import ManualAudioPlayer from '../components/ui/ManualAudioPlayer';
import CreateRoomModal from '../components/modals/CreateRoomModal';
import RealAudioPlayer from '../components/music/RealAudioPlayer';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { 
  MusicalNoteIcon, 
  PlusIcon, 
  PlayIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UserGroupIcon,
  TrashIcon,
  ArrowRightIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const { searchResults } = useMusicSearch(); // loading temporarily unused
  const { 
    rooms, 
    fetchRooms, 
    loading: roomsLoading,
    createRoom,
    joinRoom,
    leaveRoom
  } = useRoom();
  const [showMusicDiscovery, setShowMusicDiscovery] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [currentlyPlayingSong, setCurrentlyPlayingSong] = useState(null);
  const [showMyRooms, setShowMyRooms] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token && isAuthenticated === false) {
      console.log('🔐 No authentication token found, redirecting to login');
      window.location.href = '/login';
      return;
    }
  }, [isAuthenticated]);

  // Fetch user's rooms on component mount
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchRooms('my');
    }
  }, [isAuthenticated, user, fetchRooms]);

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

  const handleJoinRoom = async (roomId) => {
    try {
      console.log('🎵 Attempting to join room:', roomId);
      const result = await joinRoom(roomId);
      console.log('🎵 Join room result:', result);
      
      if (result.success) {
        toast.success('Joined room successfully!');
        // Navigate to the room
        window.location.href = `/room/${roomId}`;
      } else {
        toast.error(result.error || 'Failed to join room');
      }
    } catch (error) {
      console.error('Join room error:', error);
      toast.error('Failed to join room');
    }
  };

  const handleJoinRoomById = async () => {
    if (!joinRoomId.trim()) {
      toast.error('Please enter a room ID');
      return;
    }

    try {
      console.log('🎵 Attempting to join room by ID:', joinRoomId.trim());
      const result = await joinRoom(joinRoomId.trim());
      console.log('🎵 Join room by ID result:', result);
      
      if (result.success) {
        toast.success('Joined room successfully!');
        setJoinRoomId('');
        setShowJoinRoomModal(false);
        // Navigate to the room
        window.location.href = `/room/${joinRoomId.trim()}`;
      } else {
        toast.error(result.error || 'Failed to join room');
      }
    } catch (error) {
      console.error('Join room by ID error:', error);
      toast.error('Failed to join room');
    }
  };

  const handleDeleteRoomClick = (roomId) => {
    console.log('🗑️ Attempting to delete room:', roomId);
    setRoomToDelete(roomId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;

    try {
      console.log('🗑️ === STARTING ROOM DELETE TEST ===');
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      console.log('🗑️ Deleting room:', roomToDelete);
      console.log('🗑️ Using token:', token.substring(0, 20) + '...');

      // Step 1: Verify authentication
      console.log('🗑️ Step 1 - Verifying authentication');
      try {
        const authResponse = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!authResponse.ok) {
          console.error('🗑️ ❌ Authentication failed');
          toast.error('Authentication failed. Please log in again.');
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
        
        const authData = await authResponse.json();
        console.log('🗑️ ✅ Authentication verified:', authData.user.name);
      } catch (authError) {
        console.error('🗑️ ❌ Auth verification error:', authError);
        toast.error('Authentication verification failed');
        return;
      }

      // Step 2: Delete the room
      console.log('🗑️ Step 2 - Deleting room');
      const response = await fetch(`/api/rooms/${roomToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('🗑️ Delete response status:', response.status);
      console.log('🗑️ Delete response headers:', response.headers);

      if (response.ok) {
        const responseData = await response.json();
        console.log('🗑️ ✅ Delete response data:', responseData);
        toast.success('Room deleted successfully!');
        console.log('🗑️ === ROOM DELETE SUCCESSFUL ===');
        // Refresh the rooms list
        fetchRooms('my');
      } else {
        const errorData = await response.json();
        console.error('🗑️ ❌ Delete room error response:', errorData);
        
        let errorMessage = 'Failed to delete room';
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
          localStorage.removeItem('token');
          window.location.href = '/login';
        } else if (response.status === 403) {
          errorMessage = 'Access denied. Only room host can delete rooms.';
        } else if (response.status === 404) {
          errorMessage = 'Room not found.';
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        toast.error(errorMessage);
        console.log('🗑️ === ROOM DELETE FAILED ===');
      }
    } catch (error) {
      console.error('🗑️ ❌ Delete room error:', error);
      toast.error('Failed to delete room');
      console.log('🗑️ === ROOM DELETE ERROR ===');
    } finally {
      setShowDeleteConfirm(false);
      setRoomToDelete(null);
    }
  };

  // Test function to debug API calls
  const testAPICall = async () => {
    try {
      console.log('🔍 === STARTING COMPREHENSIVE API TEST ===');
      
      // Step 1: Check authentication
      const token = localStorage.getItem('token');
      console.log('🔍 Step 1 - Token check:', token ? 'Present' : 'Missing');
      console.log('🔍 Token preview:', token ? token.substring(0, 50) + '...' : 'No token');
      
      if (!token) {
        toast.error('No authentication token found. Please log in first.');
        console.log('🔍 ❌ Test failed: No token found');
        return;
      }

      // Step 2: Test authentication endpoint
      console.log('🔍 Step 2 - Testing /api/auth/me');
      try {
        const authResponse = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log('🔍 Auth response status:', authResponse.status);
        
        if (authResponse.ok) {
          const authData = await authResponse.json();
          console.log('🔍 ✅ Auth successful:', authData.user.name);
        } else {
          const authError = await authResponse.json();
          console.error('🔍 ❌ Auth failed:', authError);
          toast.error('Authentication failed. Please log in again.');
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
      } catch (authError) {
        console.error('🔍 ❌ Auth test error:', authError);
        toast.error('Authentication test failed');
        return;
      }

      // Step 3: Test getting user's rooms
      console.log('🔍 Step 3 - Testing /api/rooms?type=my');
      const response = await fetch('/api/rooms?type=my', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('🔍 Rooms response status:', response.status);
      console.log('🔍 Rooms response headers:', response.headers);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 ✅ Rooms test successful:', data);
        console.log('🔍 Found rooms:', data.rooms.length);
        toast.success(`✅ API Test Successful! Found ${data.rooms.length} rooms`);
        
        // Step 4: Test room operations if rooms exist
        if (data.rooms.length > 0) {
          console.log('🔍 Step 4 - Testing room operations');
          const testRoom = data.rooms[0];
          console.log('🔍 Test room:', testRoom._id, testRoom.name);
          
          // Test join room
          console.log('🔍 Testing join room...');
          try {
            const joinResponse = await fetch(`/api/rooms/${testRoom._id}/join`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
            });
            
            console.log('🔍 Join response status:', joinResponse.status);
            if (joinResponse.ok) {
              console.log('🔍 ✅ Join room test successful');
            } else {
              const joinError = await joinResponse.json();
              console.log('🔍 ⚠️ Join room test:', joinError);
            }
          } catch (joinError) {
            console.error('🔍 ❌ Join room test error:', joinError);
          }
        }
      } else {
        const errorData = await response.json();
        console.error('🔍 ❌ Rooms test failed:', errorData);
        toast.error(errorData.error || 'API test failed');
      }
      
      console.log('🔍 === API TEST COMPLETED ===');
    } catch (error) {
      console.error('🔍 ❌ Test error:', error);
      toast.error('API test failed');
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
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

        {/* My Rooms Section - Only show for authenticated users */}
        {isAuthenticated && (
          <div className="mb-8">
            <div className="card dark:card-dark p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
                  My Rooms ({rooms.length}/5)
                </h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowMyRooms(!showMyRooms)}
                    className="btn-outline flex items-center"
                  >
                    <UserGroupIcon className="w-4 h-4 mr-2" />
                    {showMyRooms ? 'Hide Rooms' : 'Show My Rooms'}
                  </button>
                  <button 
                    onClick={handleCreateRoom}
                    className="btn-primary flex items-center"
                    disabled={rooms.length >= 5}
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Create Room
                  </button>
                </div>
              </div>

              {rooms.length >= 5 && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    ⚠️ <strong>Room Limit Reached:</strong> You have created the maximum of 5 rooms. 
                    Delete some rooms below to create new ones.
                  </p>
                </div>
              )}

              {showMyRooms && (
                <div className="space-y-4">
                  {roomsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner size="md" />
                    </div>
                  ) : rooms.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {rooms.map((room) => (
                        <div key={room._id} className="bg-gray-50 dark:bg-dark-border rounded-lg p-4 border border-gray-200 dark:border-dark-border">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 dark:text-dark-text truncate">
                              {room.name}
                            </h3>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleJoinRoom(room._id)}
                                className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                title="Join Room"
                              >
                                <ArrowRightIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRoomClick(room._id)}
                                className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                title="Delete Room"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-sm text-gray-600 dark:text-dark-muted">
                            <div className="flex items-center justify-between">
                              <span>Members:</span>
                              <span className="font-medium">{room.memberCount || 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Queue:</span>
                              <span className="font-medium">{room.queue?.length || 0} songs</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Created:</span>
                              <span className="font-medium">{formatDate(room.createdAt)}</span>
                            </div>
                            {room.isPrivate && (
                              <div className="flex items-center justify-between">
                                <span>Type:</span>
                                <span className="font-medium text-orange-600 dark:text-orange-400">Private</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-dark-border">
                            <button
                              onClick={() => handleJoinRoom(room._id)}
                              className="w-full btn-primary text-sm"
                            >
                              Join Room
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <UserGroupIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-dark-muted mb-4">
                        You haven't created any rooms yet.
                      </p>
                      <button
                        onClick={handleCreateRoom}
                        className="btn-primary"
                      >
                        Create Your First Room
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                  disabled={isAuthenticated && rooms.length >= 5}
                >
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create Room
                </button>
                <button 
                  onClick={() => setShowJoinRoomModal(true)}
                  className="btn-outline w-full flex items-center justify-center"
                >
                  <ArrowRightIcon className="w-4 h-4 mr-2" />
                  Join Room
                </button>
                <button 
                  onClick={testAPICall}
                  className="btn-outline w-full flex items-center justify-center text-sm"
                >
                  <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
                  Test API
                </button>
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

      {/* Join Room Modal */}
      {showJoinRoomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                Join Room
              </h3>
              <button
                onClick={() => {
                  setShowJoinRoomModal(false);
                  setJoinRoomId('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-dark-muted dark:hover:text-dark-text"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-2">
                  Room ID
                </label>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="Enter room ID (e.g., 688f3bbd5c1355eeea402b36)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-bg dark:text-dark-text"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleJoinRoomById}
                  className="flex-1 btn-primary"
                >
                  Join Room
                </button>
                <button
                  onClick={() => {
                    setShowJoinRoomModal(false);
                    setJoinRoomId('');
                  }}
                  className="flex-1 btn-outline"
                >
                  Cancel
                </button>
              </div>
              
              <div className="text-xs text-gray-500 dark:text-dark-muted">
                <p>💡 <strong>Tip:</strong> You can find room IDs in the URL when you're in a room, or ask the room host for the ID.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Room Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                Confirm Deletion
              </h3>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setRoomToDelete(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-dark-muted dark:hover:text-dark-text"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-700 dark:text-dark-text mb-4">
              Are you sure you want to delete room "{rooms.find(room => room._id === roomToDelete)?.name}"? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteRoom}
                className="flex-1 btn-danger"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setRoomToDelete(null);
                }}
                className="flex-1 btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;