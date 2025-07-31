const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  passcode: {
    type: String,
    required: function() {
      return this.isPrivate;
    },
    minlength: 4,
    maxlength: 20
  },
  maxMembers: {
    type: Number,
    default: 50,
    min: 2,
    max: 100
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['host', 'moderator', 'member'],
      default: 'member'
    },
    isOnline: {
      type: Boolean,
      default: true
    }
  }],
  queue: [{
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song'
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    order: {
      type: Number,
      required: true
    }
  }],
  currentTrack: {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      default: null
    },
    startedAt: {
      type: Date,
      default: null
    },
    currentTime: {
      type: Number,
      default: 0 // in seconds
    },
    isPlaying: {
      type: Boolean,
      default: false
    },
    playedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  settings: {
    allowMembersToAddSongs: {
      type: Boolean,
      default: true
    },
    allowMembersToSkip: {
      type: Boolean,
      default: false
    },
    autoPlay: {
      type: Boolean,
      default: true
    },
    shuffleMode: {
      type: Boolean,
      default: false
    },
    repeatMode: {
      type: String,
      enum: ['off', 'one', 'all'],
      default: 'off'
    },
    volume: {
      type: Number,
      min: 0,
      max: 100,
      default: 80
    }
  },
  stats: {
    totalPlays: {
      type: Number,
      default: 0
    },
    totalMessages: {
      type: Number,
      default: 0
    },
    peakMembers: {
      type: Number,
      default: 0
    },
    totalSongsPlayed: {
      type: Number,
      default: 0
    }
  },
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for member count
roomSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for online member count
roomSchema.virtual('onlineMemberCount').get(function() {
  return this.members.filter(member => member.isOnline).length;
});

// Virtual for queue length
roomSchema.virtual('queueLength').get(function() {
  return this.queue.length;
});

// Virtual for room code (first 8 characters of _id)
roomSchema.virtual('roomCode').get(function() {
  return this._id.toString().substring(0, 8).toUpperCase();
});

// Pre-save middleware to update peak members
roomSchema.pre('save', function(next) {
  if (this.memberCount > this.stats.peakMembers) {
    this.stats.peakMembers = this.memberCount;
  }
  this.lastActivity = new Date();
  next();
});

// Method to add member to room
roomSchema.methods.addMember = function(userId, role = 'member') {
  const existingMember = this.members.find(member => 
    member.userId.toString() === userId.toString()
  );
  
  if (existingMember) {
    existingMember.isOnline = true;
    existingMember.joinedAt = new Date();
    return this;
  }
  
  this.members.push({
    userId,
    role,
    joinedAt: new Date(),
    isOnline: true
  });
  
  return this;
};

// Method to remove member from room
roomSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(member => 
    member.userId.toString() !== userId.toString()
  );
  return this;
};

// Method to update member online status
roomSchema.methods.updateMemberStatus = function(userId, isOnline) {
  const member = this.members.find(member => 
    member.userId.toString() === userId.toString()
  );
  
  if (member) {
    member.isOnline = isOnline;
  }
  
  return this;
};

// Method to add song to queue
roomSchema.methods.addToQueue = function(songId, addedBy) {
  const nextOrder = this.queue.length > 0 
    ? Math.max(...this.queue.map(item => item.order)) + 1 
    : 1;
  
  this.queue.push({
    songId,
    addedBy,
    addedAt: new Date(),
    order: nextOrder
  });
  
  return this;
};

// Method to remove song from queue
roomSchema.methods.removeFromQueue = function(songId) {
  this.queue = this.queue.filter(item => 
    item.songId.toString() !== songId.toString()
  );
  return this;
};

// Method to reorder queue
roomSchema.methods.reorderQueue = function(newOrder) {
  newOrder.forEach((item, index) => {
    const queueItem = this.queue.find(q => 
      q.songId.toString() === item.songId.toString()
    );
    if (queueItem) {
      queueItem.order = index + 1;
    }
  });
  
  this.queue.sort((a, b) => a.order - b.order);
  return this;
};

// Method to get next song in queue
roomSchema.methods.getNextSong = function() {
  if (this.queue.length === 0) return null;
  
  if (this.settings.shuffleMode) {
    const randomIndex = Math.floor(Math.random() * this.queue.length);
    return this.queue[randomIndex];
  }
  
  return this.queue.sort((a, b) => a.order - b.order)[0];
};

// Static method to find rooms by user
roomSchema.statics.findByUser = function(userId) {
  return this.find({
    'members.userId': userId,
    isActive: true
  }).populate('hostId', 'name email avatar')
    .populate('members.userId', 'name email avatar');
};

// Index for performance
roomSchema.index({ hostId: 1 });
roomSchema.index({ 'members.userId': 1 });
roomSchema.index({ isPrivate: 1 });
roomSchema.index({ isActive: 1 });
roomSchema.index({ lastActivity: -1 });
roomSchema.index({ tags: 1 });

module.exports = mongoose.model('Room', roomSchema);