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
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Initialize socket connection
  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('token');
      if (!token) return;

      const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
      
      const newSocket = io(socketUrl, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        forceNew: true,
      });

      // Connection events
      newSocket.on('connect', () => {
        console.log('🔌 Connected to server');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        setSocket(newSocket);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from server:', reason);
        setIsConnected(false);
        setCurrentRoom(null);
        setOnlineUsers([]);
        setTypingUsers([]);
      });

      newSocket.on('connect_error', (error) => {
        console.error('🔌 Connection error:', error);
        setIsConnected(false);
        
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
        toast.error(error.message || 'An error occurred');
      });

      // Room events
      newSocket.on('room-joined', (data) => {
        setCurrentRoom(data.room);
        toast.success(data.message || 'Joined room successfully');
      });

      newSocket.on('room-left', (data) => {
        setCurrentRoom(null);
        setOnlineUsers([]);
        setTypingUsers([]);
        toast.success(data.message || 'Left room successfully');
      });

      newSocket.on('user-joined', (data) => {
        toast.success(`${data.user.name} joined the room`);
        // Update online users list if available
        setOnlineUsers(prev => [...prev.filter(u => u._id !== data.user._id), data.user]);
      });

      newSocket.on('user-left', (data) => {
        toast(`${data.user.name} left the room`);
        setOnlineUsers(prev => prev.filter(u => u._id !== data.user._id));
      });

      // Typing indicators
      newSocket.on('user-typing', (data) => {
        setTypingUsers(prev => {
          if (data.isTyping) {
            return [...prev.filter(u => u.userId !== data.userId), {
              userId: data.userId,
              userName: data.userName,
              timestamp: Date.now()
            }];
          } else {
            return prev.filter(u => u.userId !== data.userId);
          }
        });
      });

      return () => {
        newSocket.close();
      };
    } else {
      // Clean up when not authenticated
      if (socket) {
        socket.close();
        setSocket(null);
      }
      setIsConnected(false);
      setCurrentRoom(null);
      setOnlineUsers([]);
      setTypingUsers([]);
    }
  }, [isAuthenticated, user, socket]);

  // Clean up typing indicators after timeout
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(user => now - user.timestamp < 3000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Socket helper functions
  const joinRoom = (roomId, passcode = null) => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    socket.emit('join-room', { roomId, passcode });
  };

  const leaveRoom = (roomId) => {
    if (!socket) return;
    
    socket.emit('leave-room', { roomId });
  };

  const sendMessage = (roomId, content, options = {}) => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    socket.emit('send-message', {
      roomId,
      content,
      messageType: options.messageType || 'text',
      replyTo: options.replyTo,
      mentions: options.mentions,
    });
  };

  const startTyping = (roomId) => {
    if (!socket) return;
    
    socket.emit('typing-start', { roomId });
  };

  const stopTyping = (roomId) => {
    if (!socket) return;
    
    socket.emit('typing-stop', { roomId });
  };

  const playMusic = (roomId, songId, currentTime = 0) => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    socket.emit('music-play', { roomId, songId, currentTime });
  };

  const pauseMusic = (roomId, currentTime = 0) => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    socket.emit('music-pause', { roomId, currentTime });
  };

  const seekMusic = (roomId, currentTime) => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    socket.emit('music-seek', { roomId, currentTime });
  };

  const nextMusic = (roomId) => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    socket.emit('music-next', { roomId });
  };

  const changeVolume = (roomId, volume) => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    socket.emit('music-volume', { roomId, volume });
  };

  const addReaction = (messageId, emoji) => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    socket.emit('add-reaction', { messageId, emoji });
  };

  // Event listeners manager
  const addEventListener = (event, callback) => {
    if (!socket) return () => {};
    
    socket.on(event, callback);
    
    return () => {
      socket.off(event, callback);
    };
  };

  const removeEventListener = (event, callback) => {
    if (!socket) return;
    
    socket.off(event, callback);
  };

  const value = {
    socket,
    isConnected,
    currentRoom,
    onlineUsers,
    typingUsers,
    
    // Room functions
    joinRoom,
    leaveRoom,
    
    // Chat functions
    sendMessage,
    startTyping,
    stopTyping,
    addReaction,
    
    // Music functions
    playMusic,
    pauseMusic,
    seekMusic,
    nextMusic,
    changeVolume,
    
    // Event management
    addEventListener,
    removeEventListener,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};