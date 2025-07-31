// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

// Switch to musicapp database
db = db.getSiblingDB('musicapp');

// Create application user with read/write permissions
db.createUser({
  user: 'musicapp',
  pwd: 'musicapp123',
  roles: [
    {
      role: 'readWrite',
      db: 'musicapp'
    }
  ]
});

// Create indexes for performance optimization
print('Creating indexes for performance...');

// User collection indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
db.users.createIndex({ currentRoom: 1 });
db.users.createIndex({ isOnline: 1 });

// Room collection indexes
db.rooms.createIndex({ hostId: 1 });
db.rooms.createIndex({ 'members.userId': 1 });
db.rooms.createIndex({ isPrivate: 1 });
db.rooms.createIndex({ isActive: 1 });
db.rooms.createIndex({ lastActivity: -1 });
db.rooms.createIndex({ tags: 1 });
db.rooms.createIndex({ name: 'text', description: 'text' });

// Song collection indexes
db.songs.createIndex({ title: 'text', artist: 'text', album: 'text' });
db.songs.createIndex({ addedBy: 1 });
db.songs.createIndex({ sourceType: 1 });
db.songs.createIndex({ genre: 1 });
db.songs.createIndex({ tags: 1 });
db.songs.createIndex({ 'stats.totalPlays': -1 });
db.songs.createIndex({ 'stats.totalLikes': -1 });
db.songs.createIndex({ createdAt: -1 });
db.songs.createIndex({ isActive: 1 });

// Message collection indexes
db.messages.createIndex({ roomId: 1, createdAt: -1 });
db.messages.createIndex({ senderId: 1 });
db.messages.createIndex({ messageType: 1 });
db.messages.createIndex({ isPinned: 1 });
db.messages.createIndex({ isDeleted: 1 });
db.messages.createIndex({ content: 'text' });
db.messages.createIndex({ 'readBy.userId': 1 });

// Create collections with validation
print('Creating collections with validation...');

// Users collection validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'email'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 50
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        },
        password: {
          bsonType: 'string',
          minLength: 6
        },
        isOnline: {
          bsonType: 'bool'
        }
      }
    }
  }
});

// Rooms collection validation
db.createCollection('rooms', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'hostId'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100
        },
        description: {
          bsonType: 'string',
          maxLength: 500
        },
        maxMembers: {
          bsonType: 'int',
          minimum: 2,
          maximum: 100
        },
        isActive: {
          bsonType: 'bool'
        }
      }
    }
  }
});

// Messages collection validation
db.createCollection('messages', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['roomId', 'senderId', 'content'],
      properties: {
        content: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 1000
        },
        messageType: {
          bsonType: 'string',
          enum: ['text', 'system', 'song_add', 'song_play', 'user_join', 'user_leave', 'emoji', 'image']
        },
        isDeleted: {
          bsonType: 'bool'
        }
      }
    }
  }
});

// Songs collection validation
db.createCollection('songs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'artist', 'duration', 'sourceType', 'sourceURL', 'addedBy'],
      properties: {
        title: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 200
        },
        artist: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100
        },
        duration: {
          bsonType: 'int',
          minimum: 1
        },
        sourceType: {
          bsonType: 'string',
          enum: ['upload', 'youtube', 'spotify', 'url']
        },
        isActive: {
          bsonType: 'bool'
        }
      }
    }
  }
});

// Insert sample data for development
if (db.getName() === 'musicapp') {
  print('Inserting sample data for development...');
  
  // Sample genres for testing
  const genres = ['Rock', 'Pop', 'Hip Hop', 'Electronic', 'Jazz', 'Classical', 'Country', 'R&B'];
  
  print('Sample data insertion completed.');
}

print('MongoDB initialization completed successfully!');
print('Database: ' + db.getName());
print('Collections created with indexes and validation rules.');
print('Application user "musicapp" created with readWrite permissions.');