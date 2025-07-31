const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  artist: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  album: {
    type: String,
    trim: true,
    maxlength: 100,
    default: ''
  },
  duration: {
    type: Number,
    required: true,
    min: 1 // in seconds
  },
  sourceType: {
    type: String,
    enum: ['upload', 'youtube', 'spotify', 'url', 'audius'],
    required: true
  },
  sourceURL: {
    type: String,
    required: true,
    trim: true
  },
  thumbnailURL: {
    type: String,
    trim: true,
    default: function() {
      // Generate a default thumbnail based on title and artist
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.title)}&background=6366f1&color=fff&size=300`;
    }
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  genre: {
    type: String,
    trim: true,
    maxlength: 50,
    default: ''
  },
  year: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  metadata: {
    bitrate: Number,
    fileSize: Number, // in bytes
    format: String,
    sampleRate: Number,
    // External source metadata
    externalId: String, // Original ID from external service
    isStreamable: Boolean, // Whether the track can be streamed directly
    playCount: Number, // Play count from external service
    favoriteCount: Number, // Favorite count from external service
    repostCount: Number, // Repost/share count
    channelId: String, // YouTube channel ID or similar
    publishedAt: Date, // Original publish date
    description: String // Track description from external service
  },
  lyrics: {
    type: String,
    default: ''
  },
  tags: [String],
  isExplicit: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isExternal: {
    type: Boolean,
    default: function() {
      return ['audius', 'youtube', 'spotify'].includes(this.sourceType);
    }
  },
  previewable: {
    type: Boolean,
    default: true
  },
  warnings: [String], // Warnings about playback limitations
  stats: {
    totalPlays: {
      type: Number,
      default: 0
    },
    totalLikes: {
      type: Number,
      default: 0
    },
    totalShares: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    playCount: {
      type: Number,
      default: 0
    }
  },
  rooms: [{
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    playCount: {
      type: Number,
      default: 0
    }
  }],
  likes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reports: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['inappropriate', 'copyright', 'spam', 'other'],
      required: true
    },
    description: String,
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted duration
songSchema.virtual('formattedDuration').get(function() {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual for like count
songSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for report count
songSchema.virtual('reportCount').get(function() {
  return this.reports.length;
});

// Virtual for display name
songSchema.virtual('displayName').get(function() {
  return `${this.title} - ${this.artist}`;
});

// Method to increment play count
songSchema.methods.incrementPlayCount = function(roomId = null) {
  this.stats.totalPlays += 1;
  this.stats.playCount += 1;
  
  if (roomId) {
    const roomStat = this.rooms.find(room => 
      room.roomId.toString() === roomId.toString()
    );
    
    if (roomStat) {
      roomStat.playCount += 1;
    } else {
      this.rooms.push({
        roomId,
        playCount: 1,
        addedAt: new Date()
      });
    }
  }
  
  return this.save();
};

// Method to add like
songSchema.methods.addLike = function(userId) {
  const existingLike = this.likes.find(like => 
    like.userId.toString() === userId.toString()
  );
  
  if (!existingLike) {
    this.likes.push({ userId, likedAt: new Date() });
    this.stats.totalLikes += 1;
  }
  
  return this;
};

// Method to remove like
songSchema.methods.removeLike = function(userId) {
  const likeIndex = this.likes.findIndex(like => 
    like.userId.toString() === userId.toString()
  );
  
  if (likeIndex > -1) {
    this.likes.splice(likeIndex, 1);
    this.stats.totalLikes = Math.max(0, this.stats.totalLikes - 1);
  }
  
  return this;
};

// Method to check if user has liked
songSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => 
    like.userId.toString() === userId.toString()
  );
};

// Method to add report
songSchema.methods.addReport = function(userId, reason, description = '') {
  const existingReport = this.reports.find(report => 
    report.userId.toString() === userId.toString()
  );
  
  if (!existingReport) {
    this.reports.push({
      userId,
      reason,
      description,
      reportedAt: new Date()
    });
  }
  
  return this;
};

// Static method to search songs
songSchema.statics.search = function(query, options = {}) {
  const searchRegex = new RegExp(query, 'i');
  const searchQuery = {
    $and: [
      { isActive: true },
      {
        $or: [
          { title: searchRegex },
          { artist: searchRegex },
          { album: searchRegex },
          { genre: searchRegex },
          { tags: { $in: [searchRegex] } }
        ]
      }
    ]
  };
  
  return this.find(searchQuery)
    .populate('addedBy', 'name avatar')
    .sort(options.sort || { 'stats.totalPlays': -1 })
    .limit(options.limit || 50);
};

// Static method to get popular songs
songSchema.statics.getPopular = function(limit = 20) {
  return this.find({ isActive: true })
    .populate('addedBy', 'name avatar')
    .sort({ 'stats.totalPlays': -1, 'stats.totalLikes': -1 })
    .limit(limit);
};

// Static method to get recent songs
songSchema.statics.getRecent = function(limit = 20) {
  return this.find({ isActive: true })
    .populate('addedBy', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Indexes for performance
songSchema.index({ title: 'text', artist: 'text', album: 'text' });
songSchema.index({ addedBy: 1 });
songSchema.index({ sourceType: 1 });
songSchema.index({ genre: 1 });
songSchema.index({ tags: 1 });
songSchema.index({ 'stats.totalPlays': -1 });
songSchema.index({ 'stats.totalLikes': -1 });
songSchema.index({ createdAt: -1 });
songSchema.index({ isActive: 1 });

module.exports = mongoose.model('Song', songSchema);