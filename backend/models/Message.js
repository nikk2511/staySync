const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'system', 'song_add', 'song_play', 'user_join', 'user_leave', 'emoji', 'image'],
    default: 'text'
  },
  replyTo: {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    content: String,
    senderName: String
  },
  mentions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    startIndex: Number,
    endIndex: Number
  }],
  attachments: [{
    type: String,
    url: String,
    filename: String,
    size: Number,
    mimeType: String
  }],
  reactions: [{
    emoji: {
      type: String,
      required: true
    },
    users: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reactedAt: {
        type: Date,
        default: Date.now
      }
    }],
    count: {
      type: Number,
      default: 0
    }
  }],
  metadata: {
    songInfo: {
      songId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song'
      },
      title: String,
      artist: String,
      duration: Number
    },
    systemAction: {
      action: String,
      target: String,
      details: mongoose.Schema.Types.Mixed
    },
    editHistory: [{
      content: String,
      editedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  pinnedAt: Date,
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for reaction count
messageSchema.virtual('totalReactions').get(function() {
  return this.reactions.reduce((total, reaction) => total + reaction.count, 0);
});

// Virtual for formatted timestamp
messageSchema.virtual('formattedTime').get(function() {
  return this.createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for is system message
messageSchema.virtual('isSystemMessage').get(function() {
  return ['system', 'song_add', 'song_play', 'user_join', 'user_leave'].includes(this.messageType);
});

// Method to add reaction
messageSchema.methods.addReaction = function(emoji, userId) {
  let reaction = this.reactions.find(r => r.emoji === emoji);
  
  if (!reaction) {
    reaction = {
      emoji,
      users: [],
      count: 0
    };
    this.reactions.push(reaction);
  }
  
  const existingUserReaction = reaction.users.find(u => 
    u.userId.toString() === userId.toString()
  );
  
  if (!existingUserReaction) {
    reaction.users.push({
      userId,
      reactedAt: new Date()
    });
    reaction.count += 1;
  }
  
  return this;
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(emoji, userId) {
  const reaction = this.reactions.find(r => r.emoji === emoji);
  
  if (reaction) {
    const userIndex = reaction.users.findIndex(u => 
      u.userId.toString() === userId.toString()
    );
    
    if (userIndex > -1) {
      reaction.users.splice(userIndex, 1);
      reaction.count = Math.max(0, reaction.count - 1);
      
      // Remove reaction if no users left
      if (reaction.count === 0) {
        this.reactions = this.reactions.filter(r => r.emoji !== emoji);
      }
    }
  }
  
  return this;
};

// Method to edit message
messageSchema.methods.editContent = function(newContent) {
  if (!this.metadata.editHistory) {
    this.metadata.editHistory = [];
  }
  
  this.metadata.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });
  
  this.content = newContent;
  this.isEdited = true;
  
  return this;
};

// Method to mark as read by user
messageSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(read => 
    read.userId.toString() === userId.toString()
  );
  
  if (!existingRead) {
    this.readBy.push({
      userId,
      readAt: new Date()
    });
  }
  
  return this;
};

// Method to check if read by user
messageSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(read => 
    read.userId.toString() === userId.toString()
  );
};

// Method to soft delete
messageSchema.methods.softDelete = function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.content = '[This message was deleted]';
  
  return this;
};

// Method to pin message
messageSchema.methods.pin = function(pinnedBy) {
  this.isPinned = true;
  this.pinnedBy = pinnedBy;
  this.pinnedAt = new Date();
  
  return this;
};

// Method to unpin message
messageSchema.methods.unpin = function() {
  this.isPinned = false;
  this.pinnedBy = undefined;
  this.pinnedAt = undefined;
  
  return this;
};

// Static method to get recent messages for room
messageSchema.statics.getRecentForRoom = function(roomId, limit = 50, before = null) {
  const query = {
    roomId,
    isDeleted: false
  };
  
  if (before) {
    query.createdAt = { $lt: before };
  }
  
  return this.find(query)
    .populate('senderId', 'name avatar')
    .populate('replyTo.messageId', 'content senderId')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get pinned messages for room
messageSchema.statics.getPinnedForRoom = function(roomId) {
  return this.find({
    roomId,
    isPinned: true,
    isDeleted: false
  })
    .populate('senderId', 'name avatar')
    .populate('pinnedBy', 'name')
    .sort({ pinnedAt: -1 });
};

// Static method to search messages in room
messageSchema.statics.searchInRoom = function(roomId, query, options = {}) {
  const searchRegex = new RegExp(query, 'i');
  
  return this.find({
    roomId,
    content: searchRegex,
    isDeleted: false,
    messageType: 'text'
  })
    .populate('senderId', 'name avatar')
    .sort({ createdAt: options.sort || -1 })
    .limit(options.limit || 20);
};

// Static method to get message stats for room
messageSchema.statics.getStatsForRoom = function(roomId) {
  return this.aggregate([
    { $match: { roomId: new mongoose.Types.ObjectId(roomId), isDeleted: false } },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        totalReactions: { $sum: { $size: '$reactions' } },
        messagesByType: {
          $push: {
            type: '$messageType',
            count: 1
          }
        },
        messagesByUser: {
          $push: {
            userId: '$senderId',
            count: 1
          }
        }
      }
    }
  ]);
};

// Indexes for performance
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ messageType: 1 });
messageSchema.index({ isPinned: 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ content: 'text' });
messageSchema.index({ 'readBy.userId': 1 });

module.exports = mongoose.model('Message', messageSchema);