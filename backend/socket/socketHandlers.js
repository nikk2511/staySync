const Room = require('../models/Room');
const User = require('../models/User');
const Message = require('../models/Message');
const Song = require('../models/Song');

// Store active connections
const activeConnections = new Map();

const socketHandlers = (io, socket) => {
  console.log(`🔌 User ${socket.userId} connected via socket`);
  
  // Store connection
  activeConnections.set(socket.userId, {
    socketId: socket.id,
    userId: socket.userId,
    currentRoom: null,
    joinedAt: new Date()
  });

  // Join user room on connection
  socket.on('join-room', async (data) => {
    try {
      const { roomId } = data;
      
      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Get room and check if user is a member
      const room = await Room.findById(roomId)
        .populate('hostId', 'name avatar')
        .populate('members.userId', 'name avatar')
        .populate('queue.songId')
        .populate('queue.addedBy', 'name avatar')
        .populate('currentTrack.songId')
        .populate('currentTrack.playedBy', 'name avatar');

      if (!room || !room.isActive) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const isMember = room.members.some(member => 
        member.userId.toString() === socket.userId.toString()
      );

      if (!isMember) {
        socket.emit('error', { message: 'Access denied. You are not a room member.' });
        return;
      }

      // Leave previous room if any
      if (activeConnections.get(socket.userId)?.currentRoom) {
        socket.leave(activeConnections.get(socket.userId).currentRoom);
      }

      // Join new room
      socket.join(roomId);
      activeConnections.get(socket.userId).currentRoom = roomId;

      // Update user's online status in room
      room.updateMemberStatus(socket.userId, true);
      await room.save();

      // Update user's current room
      await User.findByIdAndUpdate(socket.userId, {
        currentRoom: roomId,
        isOnline: true,
        lastSeen: new Date()
      });

      // Send room data to user
      socket.emit('room-joined', {
        room: room.toObject(),
        message: 'Successfully joined room'
      });

      // Notify other room members
      socket.to(roomId).emit('user-joined', {
        user: {
          _id: socket.userId,
          name: socket.user.name,
          avatar: socket.user.avatar
        },
        message: `${socket.user.name} joined the room`
      });

      console.log(`👥 User ${socket.userId} joined room ${roomId}`);

    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave room
  socket.on('leave-room', async (data) => {
    try {
      const { roomId } = data;
      const connection = activeConnections.get(socket.userId);

      if (!connection?.currentRoom || connection.currentRoom !== roomId) {
        return;
      }

      // Update room member status
      const room = await Room.findById(roomId);
      if (room) {
        room.updateMemberStatus(socket.userId, false);
        await room.save();
      }

      // Update user status
      await User.findByIdAndUpdate(socket.userId, {
        currentRoom: null
      });

      // Leave socket room
      socket.leave(roomId);
      connection.currentRoom = null;

      // Notify other room members
      socket.to(roomId).emit('user-left', {
        user: {
          _id: socket.userId,
          name: socket.user.name,
          avatar: socket.user.avatar
        },
        message: `${socket.user.name} left the room`
      });

      socket.emit('room-left', { message: 'Successfully left room' });

      console.log(`👥 User ${socket.userId} left room ${roomId}`);

    } catch (error) {
      console.error('Leave room error:', error);
      socket.emit('error', { message: 'Failed to leave room' });
    }
  });

  // Send chat message
  socket.on('send-message', async (data) => {
    try {
      const { roomId, content, messageType = 'text', replyTo, mentions } = data;
      const connection = activeConnections.get(socket.userId);

      if (!connection?.currentRoom || connection.currentRoom !== roomId) {
        socket.emit('error', { message: 'You must be in the room to send messages' });
        return;
      }

      if (!content || content.trim().length === 0) {
        socket.emit('error', { message: 'Message content cannot be empty' });
        return;
      }

      if (content.length > 1000) {
        socket.emit('error', { message: 'Message too long' });
        return;
      }

      // Create message
      let replyData = null;
      if (replyTo) {
        const replyMessage = await Message.findById(replyTo)
          .populate('senderId', 'name');
        
        if (replyMessage && replyMessage.roomId.toString() === roomId) {
          replyData = {
            messageId: replyMessage._id,
            content: replyMessage.content.substring(0, 100) + (replyMessage.content.length > 100 ? '...' : ''),
            senderName: replyMessage.senderId.name
          };
        }
      }

      const message = new Message({
        roomId,
        senderId: socket.userId,
        content: content.trim(),
        messageType,
        replyTo: replyData,
        mentions: mentions || []
      });

      await message.save();
      await message.populate('senderId', 'name avatar');

      // Update room stats
      await Room.findByIdAndUpdate(roomId, {
        $inc: { 'stats.totalMessages': 1 },
        lastActivity: new Date()
      });

      // Update user stats
      await User.findByIdAndUpdate(socket.userId, {
        $inc: { 'stats.chatMessages': 1 }
      });

      // Broadcast message to room
      io.to(roomId).emit('new-message', {
        message: message.toObject()
      });

      console.log(`💬 Message sent in room ${roomId} by user ${socket.userId}`);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Music control events
  socket.on('music-play', async (data) => {
    try {
      const { roomId, songId, currentTime = 0 } = data;
      
      await handleMusicControl(socket, roomId, 'play', { songId, currentTime });
    } catch (error) {
      console.error('Music play error:', error);
      socket.emit('error', { message: 'Failed to play music' });
    }
  });

  socket.on('music-pause', async (data) => {
    try {
      const { roomId, currentTime = 0 } = data;
      
      await handleMusicControl(socket, roomId, 'pause', { currentTime });
    } catch (error) {
      console.error('Music pause error:', error);
      socket.emit('error', { message: 'Failed to pause music' });
    }
  });

  socket.on('music-seek', async (data) => {
    try {
      const { roomId, currentTime } = data;
      
      await handleMusicControl(socket, roomId, 'seek', { currentTime });
    } catch (error) {
      console.error('Music seek error:', error);
      socket.emit('error', { message: 'Failed to seek music' });
    }
  });

  socket.on('music-next', async (data) => {
    try {
      const { roomId } = data;
      
      await handleMusicControl(socket, roomId, 'next');
    } catch (error) {
      console.error('Music next error:', error);
      socket.emit('error', { message: 'Failed to skip to next song' });
    }
  });

  socket.on('music-volume', async (data) => {
    try {
      const { roomId, volume } = data;
      
      await handleMusicControl(socket, roomId, 'volume', { volume });
    } catch (error) {
      console.error('Music volume error:', error);
      socket.emit('error', { message: 'Failed to change volume' });
    }
  });

  // Typing indicators
  socket.on('typing-start', (data) => {
    const { roomId } = data;
    const connection = activeConnections.get(socket.userId);

    if (connection?.currentRoom === roomId) {
      socket.to(roomId).emit('user-typing', {
        userId: socket.userId,
        userName: socket.user.name,
        isTyping: true
      });
    }
  });

  socket.on('typing-stop', (data) => {
    const { roomId } = data;
    const connection = activeConnections.get(socket.userId);

    if (connection?.currentRoom === roomId) {
      socket.to(roomId).emit('user-typing', {
        userId: socket.userId,
        userName: socket.user.name,
        isTyping: false
      });
    }
  });

  // Message reactions
  socket.on('add-reaction', async (data) => {
    try {
      const { messageId, emoji } = data;
      
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      const connection = activeConnections.get(socket.userId);
      if (connection?.currentRoom !== message.roomId.toString()) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      message.addReaction(emoji, socket.userId);
      await message.save();

      // Broadcast reaction update
      io.to(message.roomId.toString()).emit('reaction-updated', {
        messageId,
        reactions: message.reactions
      });

    } catch (error) {
      console.error('Add reaction error:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  });

  // Disconnect handler
  socket.on('disconnect', async () => {
    try {
      const connection = activeConnections.get(socket.userId);
      
      if (connection?.currentRoom) {
        // Update room member status
        const room = await Room.findById(connection.currentRoom);
        if (room) {
          room.updateMemberStatus(socket.userId, false);
          await room.save();
        }

        // Notify room members
        socket.to(connection.currentRoom).emit('user-left', {
          user: {
            _id: socket.userId,
            name: socket.user.name,
            avatar: socket.user.avatar
          },
          message: `${socket.user.name} disconnected`
        });
      }

      // Update user status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
        currentRoom: null
      });

      // Remove connection
      activeConnections.delete(socket.userId);

      console.log(`🔌 User ${socket.userId} disconnected`);

    } catch (error) {
      console.error('Disconnect error:', error);
    }
  });
};

// Helper function to handle music control
const handleMusicControl = async (socket, roomId, action, data = {}) => {
  const connection = activeConnections.get(socket.userId);

  if (!connection?.currentRoom || connection.currentRoom !== roomId) {
    socket.emit('error', { message: 'You must be in the room' });
    return;
  }

  const room = await Room.findById(roomId)
    .populate('queue.songId')
    .populate('currentTrack.songId');

  if (!room || !room.isActive) {
    socket.emit('error', { message: 'Room not found' });
    return;
  }

  // Check if user has permission to control music
  const member = room.members.find(member => 
    member.userId.toString() === socket.userId.toString()
  );

  if (!member) {
    socket.emit('error', { message: 'Access denied' });
    return;
  }

  // Check if user can control music (host, moderator, or if allowed by settings)
  const canControl = member.role === 'host' || 
                    member.role === 'moderator' ||
                    (room.settings.allowMembersToSkip && action === 'next');

  if (!canControl && action !== 'volume') {
    socket.emit('error', { message: 'Only host and moderators can control music' });
    return;
  }

  let updateData = {};
  let broadcastData = {};

  switch (action) {
    case 'play':
      if (data.songId) {
        // Play specific song
        const song = await Song.findById(data.songId);
        if (!song) {
          socket.emit('error', { message: 'Song not found' });
          return;
        }

        updateData = {
          'currentTrack.songId': data.songId,
          'currentTrack.startedAt': new Date(),
          'currentTrack.currentTime': data.currentTime || 0,
          'currentTrack.isPlaying': true,
          'currentTrack.playedBy': socket.userId
        };

        // Increment song play count
        await song.incrementPlayCount(roomId);

        // Remove from queue if it was there
        room.removeFromQueue(data.songId);
        await room.save();

        // Create system message
        const playMessage = new Message({
          roomId: room._id,
          senderId: socket.userId,
          content: `started playing "${song.title}" by ${song.artist}`,
          messageType: 'song_play',
          metadata: {
            songInfo: {
              songId: song._id,
              title: song.title,
              artist: song.artist,
              duration: song.duration
            }
          }
        });
        await playMessage.save();

      } else {
        // Resume current song
        updateData = {
          'currentTrack.isPlaying': true,
          'currentTrack.startedAt': new Date(),
          'currentTrack.currentTime': data.currentTime || 0
        };
      }

      broadcastData = {
        action: 'play',
        currentTrack: room.currentTrack,
        currentTime: data.currentTime || 0,
        timestamp: new Date()
      };
      break;

    case 'pause':
      updateData = {
        'currentTrack.isPlaying': false,
        'currentTrack.currentTime': data.currentTime || 0
      };

      broadcastData = {
        action: 'pause',
        currentTime: data.currentTime || 0,
        timestamp: new Date()
      };
      break;

    case 'seek':
      updateData = {
        'currentTrack.currentTime': data.currentTime,
        'currentTrack.startedAt': new Date()
      };

      broadcastData = {
        action: 'seek',
        currentTime: data.currentTime,
        timestamp: new Date()
      };
      break;

    case 'next':
      const nextSong = room.getNextSong();
      
      if (nextSong) {
        const song = await Song.findById(nextSong.songId);
        
        updateData = {
          'currentTrack.songId': nextSong.songId,
          'currentTrack.startedAt': new Date(),
          'currentTrack.currentTime': 0,
          'currentTrack.isPlaying': true,
          'currentTrack.playedBy': socket.userId
        };

        // Remove from queue
        room.removeFromQueue(nextSong.songId);
        await room.save();

        // Increment song play count
        await song.incrementPlayCount(roomId);

        broadcastData = {
          action: 'next',
          currentTrack: {
            songId: song,
            startedAt: new Date(),
            currentTime: 0,
            isPlaying: true,
            playedBy: socket.user
          },
          queue: room.queue,
          timestamp: new Date()
        };

        // Create system message
        const nextMessage = new Message({
          roomId: room._id,
          senderId: socket.userId,
          content: `skipped to "${song.title}" by ${song.artist}`,
          messageType: 'song_play',
          metadata: {
            songInfo: {
              songId: song._id,
              title: song.title,
              artist: song.artist,
              duration: song.duration
            }
          }
        });
        await nextMessage.save();

      } else {
        // No more songs in queue
        updateData = {
          'currentTrack.songId': null,
          'currentTrack.isPlaying': false,
          'currentTrack.currentTime': 0
        };

        broadcastData = {
          action: 'stop',
          message: 'Queue is empty',
          timestamp: new Date()
        };
      }
      break;

    case 'volume':
      if (data.volume >= 0 && data.volume <= 100) {
        updateData = {
          'settings.volume': data.volume
        };

        broadcastData = {
          action: 'volume',
          volume: data.volume,
          timestamp: new Date()
        };
      }
      break;
  }

  // Update room
  await Room.findByIdAndUpdate(roomId, updateData);

  // Broadcast to all room members
  socket.to(roomId).emit('music-update', broadcastData);
  
  // Send confirmation to sender
  socket.emit('music-control-success', {
    action,
    ...broadcastData
  });

  console.log(`🎵 Music ${action} in room ${roomId} by user ${socket.userId}`);
};

// Helper function to get online users in room
const getOnlineUsersInRoom = (roomId) => {
  const onlineUsers = [];
  
  for (const [userId, connection] of activeConnections) {
    if (connection.currentRoom === roomId) {
      onlineUsers.push({
        userId,
        socketId: connection.socketId,
        joinedAt: connection.joinedAt
      });
    }
  }
  
  return onlineUsers;
};

// Export handlers and utilities
module.exports = socketHandlers;
module.exports.getOnlineUsersInRoom = getOnlineUsersInRoom;
module.exports.activeConnections = activeConnections;