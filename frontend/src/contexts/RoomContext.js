import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const RoomContext = createContext();

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};

export const RoomProvider = ({ children }) => {
  const { socket, isConnected, addEventListener } = useSocket();
  const { user } = useAuth();
  
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Prevent multiple join attempts
  const joiningRef = useRef(false);
  const leavingRef = useRef(false);

  // Fetch user's rooms
  const fetchRooms = useCallback(async (type = 'my') => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/rooms?type=${type}`);
      setRooms(response.data.rooms);
      return response.data.rooms;
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      toast.error('Failed to load rooms');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new room
  const createRoom = async (roomData) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/rooms', roomData);
      
      const newRoom = response.data.room;
      setRooms(prev => [newRoom, ...prev]);
      
      // Set as current room immediately after creation
      setCurrentRoom(newRoom);
      
      // Join via socket immediately after creation
      if (socket && isConnected) {
        console.log(`🔌 Joining newly created room via socket: ${newRoom._id}`);
        socket.emit('join-room', { roomId: newRoom._id });
      }
      
      toast.success('Room created successfully!');
      return { success: true, room: newRoom };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create room';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Join a room
  const joinRoom = async (roomId, passcode = null) => {
    if (joiningRef.current) {
      console.log('🎵 Already attempting to join room, skipping...');
      return { success: false, error: 'Already joining room' };
    }
    
    if (currentRoom && currentRoom._id === roomId) {
      console.log('🎵 Already in this room, skipping join...');
      return { success: true, room: currentRoom };
    }
    
    try {
      joiningRef.current = true;
      setLoading(true);
      console.log(`🎵 Attempting to join room: ${roomId}`);
      
      // Check authentication first
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ No authentication token found');
        toast.error('Please log in to join rooms');
        return { success: false, error: 'Authentication required' };
      }
      
      console.log(`🎵 Token found: ${token.substring(0, 20)}...`);
      
      // Verify authentication before joining
      try {
        const authResponse = await axios.get('/api/auth/me');
        console.log('🎵 Authentication verified:', authResponse.data.user.name);
      } catch (authError) {
        console.error('❌ Authentication failed:', authError);
        toast.error('Authentication failed. Please log in again.');
        localStorage.removeItem('token');
        window.location.href = '/login';
        return { success: false, error: 'Authentication failed' };
      }
      
      // First, join via API
      console.log(`🎵 Making API call to join room: ${roomId}`);
      const response = await axios.post(`/api/rooms/${roomId}/join`, { passcode });
      console.log(`✅ API join successful for room: ${roomId}`, response.data);
      
      const room = response.data.room;
      setCurrentRoom(room);
      
      // Then join via socket for real-time features
      if (socket && isConnected) {
        console.log(`🔌 Joining room via socket: ${roomId}`);
        socket.emit('join-room', { roomId, passcode });
      } else {
        console.warn('🔌 Socket not connected, skipping socket join');
        if (!socket) console.warn('🔌 Socket is null');
        if (!isConnected) console.warn('🔌 Socket not connected');
      }
      
      // Initialize room state
      if (room.currentTrack?.songId) {
        setCurrentTrack(room.currentTrack);
        setIsPlaying(room.currentTrack.isPlaying || false);
        setCurrentTime(room.currentTrack.currentTime || 0);
      }
      
      if (room.queue) {
        setQueue(room.queue);
      }
      
      if (room.volume !== undefined) {
        setVolume(room.volume);
      }
      
      console.log(`✅ Successfully joined room: ${roomId}`);
      return { success: true, room };
      
    } catch (error) {
      console.error('❌ Failed to join room:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error message:', error.message);
      
      let message = 'Failed to join room';
      if (error.response?.status === 401) {
        message = 'Authentication failed. Please log in again.';
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else if (error.response?.status === 403) {
        message = 'Access denied. You may not have permission to join this room.';
      } else if (error.response?.status === 404) {
        message = 'Room not found.';
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      }
      
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
      joiningRef.current = false;
    }
  };

  // Leave current room
  const leaveRoom = async () => {
    if (!currentRoom || leavingRef.current) {
      console.log('🎵 No room to leave or already leaving, skipping...');
      return { success: true };
    }
    
    try {
      leavingRef.current = true;
      console.log(`🎵 Leaving room: ${currentRoom._id}`);
      
      // Leave via API
      await axios.post(`/api/rooms/${currentRoom._id}/leave`);
      
      // Leave via socket
      if (socket && isConnected) {
        socket.emit('leave-room', { roomId: currentRoom._id });
      }
      
      // Clear room state
      setCurrentRoom(null);
      setMessages([]);
      setCurrentTrack(null);
      setQueue([]);
      setIsPlaying(false);
      setCurrentTime(0);
      
      console.log(`✅ Successfully left room: ${currentRoom._id}`);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to leave room';
      console.error('❌ Failed to leave room:', error);
      toast.error(message);
      return { success: false, error: message };
    } finally {
      leavingRef.current = false;
    }
  };

  // Fetch messages for current room
  const fetchMessages = useCallback(async (roomId, page = 1, limit = 50) => {
    try {
      const response = await axios.get(`/api/chat/${roomId}/messages`, {
        params: { page, limit }
      });
      
      if (page === 1) {
        setMessages(response.data.messages);
      } else {
        setMessages(prev => [...response.data.messages, ...prev]);
      }
      
      return response.data;
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      toast.error('Failed to load messages');
      return null;
    }
  }, []);

  // Add song to queue
  const addToQueue = async (songId) => {
    if (!currentRoom) return;
    
    try {
      const response = await axios.post(`/api/music/rooms/${currentRoom._id}/queue`, {
        songId
      });
      
      setQueue(response.data.queue);
      toast.success('Song added to queue');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to add song to queue';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Remove song from queue
  const removeFromQueue = async (songId) => {
    if (!currentRoom) return;
    
    try {
      await axios.delete(`/api/music/rooms/${currentRoom._id}/queue/${songId}`);
      
      setQueue(prev => prev.filter(item => item.songId._id !== songId));
      toast.success('Song removed from queue');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to remove song from queue';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Get room by ID
  const getRoomById = async (roomId) => {
    try {
      const response = await axios.get(`/api/rooms/${roomId}`);
      return response.data.room;
    } catch (error) {
      console.error('Failed to get room:', error);
      return null;
    }
  };

  // Update room settings
  const updateRoomSettings = async (roomId, settings) => {
    try {
      const response = await axios.put(`/api/rooms/${roomId}`, settings);
      
      if (currentRoom && currentRoom._id === roomId) {
        setCurrentRoom(response.data.room);
      }
      
      toast.success('Room settings updated');
      return { success: true, room: response.data.room };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to update room settings';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Check if user is room host
  const isRoomHost = (room = currentRoom) => {
    return room && user && room.hostId._id === user._id;
  };

  // Check if user is room moderator or host
  const isRoomModerator = (room = currentRoom) => {
    if (!room || !user) return false;
    
    const member = room.members.find(m => m.userId._id === user._id);
    return member && ['host', 'moderator'].includes(member.role);
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const listeners = [
      // Room events
      addEventListener('room-joined', (data) => {
        setCurrentRoom(data.room);
        
        if (data.room.currentTrack?.songId) {
          setCurrentTrack(data.room.currentTrack);
          setIsPlaying(data.room.currentTrack.isPlaying);
          setCurrentTime(data.room.currentTrack.currentTime);
        }
        
        if (data.room.queue) {
          setQueue(data.room.queue);
        }
      }),

      addEventListener('room-left', () => {
        setCurrentRoom(null);
        setMessages([]);
        setCurrentTrack(null);
        setQueue([]);
        setIsPlaying(false);
        setCurrentTime(0);
      }),

      // Chat events
      addEventListener('new-message', (data) => {
        setMessages(prev => [...prev, data.message]);
      }),

      addEventListener('reaction-updated', (data) => {
        setMessages(prev => 
          prev.map(msg => 
            msg._id === data.messageId 
              ? { ...msg, reactions: data.reactions }
              : msg
          )
        );
      }),

      // Music events
      addEventListener('music-update', (data) => {
        switch (data.action) {
          case 'play':
            setIsPlaying(true);
            setCurrentTime(data.currentTime || 0);
            if (data.currentTrack) {
              setCurrentTrack(data.currentTrack);
            }
            break;
            
          case 'pause':
            setIsPlaying(false);
            setCurrentTime(data.currentTime || 0);
            break;
            
          case 'seek':
            setCurrentTime(data.currentTime);
            break;
            
          case 'next':
            setCurrentTrack(data.currentTrack);
            setQueue(data.queue || []);
            setIsPlaying(true);
            setCurrentTime(0);
            break;
            
          case 'stop':
            setCurrentTrack(null);
            setIsPlaying(false);
            setCurrentTime(0);
            break;
            
          case 'volume':
            setVolume(data.volume);
            break;
            
          default:
            break;
        }
      }),

      addEventListener('music-control-success', (data) => {
        // Handle successful music control from current user
        switch (data.action) {
          case 'play':
            setIsPlaying(true);
            break;
          case 'pause':
            setIsPlaying(false);
            break;
          default:
            break;
        }
      }),
    ];

    return () => {
      listeners.forEach(cleanup => cleanup());
    };
  }, [socket, isConnected, addEventListener]);

  const value = {
    // State
    rooms,
    currentRoom,
    currentTrack,
    queue,
    isPlaying,
    volume,
    currentTime,
    loading,
    
    // Room management
    fetchRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    getRoomById,
    updateRoomSettings,
    
    // Chat
    messages,
    fetchMessages,
    
    // Music queue
    addToQueue,
    removeFromQueue,
    
    // Permissions
    isRoomHost,
    isRoomModerator,
    
    // State setters (for local updates)
    setMessages,
    setCurrentTime,
    setVolume,
  };

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
};