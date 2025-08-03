import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const socketRef = useRef(null);
  const isConnectingRef = useRef(false);

  // Initialize socket connection
  useEffect(() => {
    // Only create socket if authenticated and no existing socket
    if (isAuthenticated && user && !socketRef.current && !isConnectingRef.current) {
      const token = localStorage.getItem('token');
      if (!token) return;

      isConnectingRef.current = true;
      const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
      
      console.log('🔌 Initializing socket connection...');
      
      const newSocket = io(socketUrl, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        forceNew: false, // Changed to false to prevent multiple connections
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Connection events
      newSocket.on('connect', () => {
        console.log('🔌 Connected to server successfully');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        socketRef.current = newSocket;
        isConnectingRef.current = false;
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from server:', reason);
        setIsConnected(false);
        setCurrentRoom(null);
        setOnlineUsers([]);
        setTypingUsers([]);
        isConnectingRef.current = false;
      });

      newSocket.on('connect_error', (error) => {
        console.error('🔌 Connection error:', error);
        setIsConnected(false);
        isConnectingRef.current = false;
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          toast.error(`Connection failed. Retrying... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
        } else {
          toast.error('Unable to connect to server. Please refresh the page.');
        }
      });

      // Error handling
      newSocket.on('error', (error) => {
        console.error('🔌 Socket error:', error);
        toast.error(error.message || 'Socket connection error');
      });

      // Room join error handling
      newSocket.on('room-join-error', (error) => {
        console.error('🔌 Room join error:', error);
        toast.error(error.message || 'Failed to join room via socket');
      });

      // Room events
      newSocket.on('room-joined', (data) => {
        console.log('🔌 Room joined via socket:', data);
        setCurrentRoom(data.room);
        // Don't show toast for every join to avoid spam
      });

      newSocket.on('room-left', (data) => {
        console.log('🔌 Room left via socket:', data);
        setCurrentRoom(null);
        setOnlineUsers([]);
        setTypingUsers([]);
        // Don't show toast for every leave to avoid spam
      });

      newSocket.on('user-joined', (data) => {
        console.log('🔌 User joined room:', data);
        toast.success(`${data.user.name} joined the room`);
        // Update online users list if available
        setOnlineUsers(prev => [...prev.filter(u => u._id !== data.user._id), data.user]);
      });

      newSocket.on('user-left', (data) => {
        console.log('🔌 User left room:', data);
        toast.info(`${data.user.name} left the room`);
        setOnlineUsers(prev => prev.filter(u => u._id !== data.user._id));
      });

      // Music events
      newSocket.on('music-play', (data) => {
        console.log('🔌 Music play event:', data);
        // Handle music play event
      });

      newSocket.on('music-pause', (data) => {
        console.log('🔌 Music pause event:', data);
        // Handle music pause event
      });

      newSocket.on('music-next', (data) => {
        console.log('🔌 Music next event:', data);
        // Handle music next event
      });

      newSocket.on('queue-updated', (data) => {
        console.log('🔌 Queue updated:', data);
        // Handle queue update event
      });

      // Chat events
      newSocket.on('message-received', (data) => {
        console.log('🔌 Message received:', data);
        // Handle new message event
      });

      newSocket.on('typing-start', (data) => {
        console.log('🔌 Typing start:', data);
        setTypingUsers(prev => [...prev.filter(u => u._id !== data.user._id), data.user]);
      });

      newSocket.on('typing-stop', (data) => {
        console.log('🔌 Typing stop:', data);
        setTypingUsers(prev => prev.filter(u => u._id !== data.user._id));
      });

    } else if (!isAuthenticated || !user) {
      // Clean up socket when user logs out
      if (socketRef.current) {
        console.log('🔌 Cleaning up socket connection...');
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setCurrentRoom(null);
        setOnlineUsers([]);
        setTypingUsers([]);
        isConnectingRef.current = false;
      }
    }

    // Cleanup function - only run on unmount
    return () => {
      if (socketRef.current) {
        console.log('🔌 Cleaning up socket on unmount...');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, user?._id]); // Only depend on authentication status and user ID

  // Socket functions
  const joinRoom = (roomId, passcode = null) => {
    if (!socketRef.current || !isConnected) {
      console.warn('🔌 Cannot join room: socket not connected');
      return;
    }
    console.log(`🔌 Joining room via socket: ${roomId}`);
    socketRef.current.emit('join-room', { roomId, passcode });
  };

  const leaveRoom = (roomId) => {
    if (!socketRef.current || !isConnected) {
      console.warn('🔌 Cannot leave room: socket not connected');
      return;
    }
    console.log(`🔌 Leaving room via socket: ${roomId}`);
    socketRef.current.emit('leave-room', { roomId });
  };

  const sendMessage = (roomId, content, options = {}) => {
    if (!socketRef.current || !isConnected) {
      console.warn('🔌 Cannot send message: socket not connected');
      return;
    }
    socketRef.current.emit('send-message', { roomId, content, ...options });
  };

  const startTyping = (roomId) => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('typing-start', { roomId });
  };

  const stopTyping = (roomId) => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('typing-stop', { roomId });
  };

  const playMusic = (roomId, songId, currentTime = 0) => {
    if (!socketRef.current || !isConnected) {
      console.warn('🔌 Cannot play music: socket not connected');
      return;
    }
    console.log(`🔌 Playing music: ${songId} at time ${currentTime}`);
    socketRef.current.emit('play-music', { roomId, songId, currentTime });
  };

  const pauseMusic = (roomId, currentTime = 0) => {
    if (!socketRef.current || !isConnected) {
      console.warn('🔌 Cannot pause music: socket not connected');
      return;
    }
    console.log(`🔌 Pausing music at time ${currentTime}`);
    socketRef.current.emit('pause-music', { roomId, currentTime });
  };

  const seekMusic = (roomId, currentTime) => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('seek-music', { roomId, currentTime });
  };

  const nextMusic = (roomId) => {
    if (!socketRef.current || !isConnected) {
      console.warn('🔌 Cannot skip music: socket not connected');
      return;
    }
    console.log(`🔌 Skipping to next song`);
    socketRef.current.emit('next-music', { roomId });
  };

  const changeVolume = (roomId, volume) => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('change-volume', { roomId, volume });
  };

  const addReaction = (messageId, emoji) => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.emit('add-reaction', { messageId, emoji });
  };

  const addEventListener = (event, callback) => {
    if (!socketRef.current) return;
    socketRef.current.on(event, callback);
  };

  const removeEventListener = (event, callback) => {
    if (!socketRef.current) return;
    socketRef.current.off(event, callback);
  };

  const value = {
    socket: socketRef.current,
    isConnected,
    currentRoom,
    onlineUsers,
    typingUsers,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    playMusic,
    pauseMusic,
    seekMusic,
    nextMusic,
    changeVolume,
    addReaction,
    addEventListener,
    removeEventListener,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};