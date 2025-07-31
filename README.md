# 🎵 MusicApp - Real-time Social Music Platform

A full-stack, production-ready MERN application that enables users to listen to music together in synchronized rooms, chat in real-time, and get AI-powered suggestions using Google's Gemini API.

## ✨ Features

### 🔐 Authentication & Security
- **Email/Password Authentication** with JWT and bcrypt
- **Google OAuth** integration using Passport.js
- **Secure Session Management** with HTTP-only cookies
- **Rate limiting** and security headers with Helmet
- **Input validation** and sanitization

### 🎧 Music Room Features
- **Create/Join Rooms** with unique IDs or names
- **Public/Private Rooms** with passcode protection
- **Real-time Music Synchronization** using Socket.io
- **Host Controls** - only room host can control playback
- **Music Queue Management** - add, remove, reorder songs
- **Multiple Music Sources** - file upload, Audius, YouTube, Spotify URLs
- **External Music Search** - search and stream from Audius API
- **Audio Player** with play/pause/skip/shuffle/repeat controls

### 💬 Real-time Chat System
- **Live Chat** in each music room using Socket.io
- **Message Types** - text, emoji, system notifications
- **Message Features** - reactions, replies, mentions, pin messages
- **Chat History** with pagination and search
- **Typing Indicators** and online status

### 🎵 Search & Play Feature (NEW!)
- **External Music Search** - search millions of songs from Audius and YouTube
- **Real-time Preview** - preview songs before adding to queue
- **Instant Streaming** - stream songs directly from external sources
- **Smart Integration** - seamlessly integrates with room queue system
- **Multiple Sources** - Audius (primary), YouTube (fallback)
- **Song Discovery** - discover new music on Dashboard

### 🤖 AI-Powered Features (Gemini API)
- **Smart Chat Suggestions** - AI suggests contextual replies
- **Music Recommendations** - AI recommends songs based on room context
- **Content Moderation** - AI helps moderate inappropriate content
- **Room Descriptions** - AI generates engaging room descriptions

### 📱 Modern Frontend
- **React 18** with modern hooks and context
- **Responsive Design** with Tailwind CSS
- **Dark/Light Theme** with system preference detection
- **Real-time Updates** with Socket.io client
- **Toast Notifications** for user feedback
- **Loading States** and error handling

### 🛠️ Backend Architecture
- **Express.js** REST API with modular routing
- **MongoDB** with Mongoose ODM and optimized schemas
- **Socket.io** for real-time communication
- **File Upload** support with Multer
- **Comprehensive Error Handling** and logging
- **API Documentation** and health checks

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- MongoDB (local or MongoDB Atlas)
- Google Cloud Console account (for OAuth and Gemini API)

### 1. Clone and Install
```bash
git clone <repository-url>
cd MusicApp

# Install all dependencies
npm run install-deps
```

### 2. Environment Setup

#### Backend Configuration
```bash
cd backend
cp ../env.example .env
```

Edit `.env` with your configuration:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/musicapp

# JWT Secrets (generate strong secrets)
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Gemini AI API (from Google AI Studio)
GEMINI_API_KEY=your-gemini-api-key

# URLs
CLIENT_URL=http://localhost:3000
```

#### Frontend Configuration  
```bash
cd frontend
cp ../env.example .env
```

Edit `.env`:
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id
```

### 3. Google Services Setup

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized origins: `http://localhost:3000`, `http://localhost:5000`
6. Add redirect URIs: `http://localhost:5000/api/auth/google/callback`

#### Gemini AI API Setup
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key to your environment variables

### 4. Database Setup

#### Option A: Local MongoDB
```bash
# Install and start MongoDB locally
mongod --dbpath /path/to/your/db
```

#### Option B: MongoDB Atlas
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a cluster and get connection string
3. Update `MONGODB_URI` in your `.env`

### 5. Run the Application

#### Development Mode
```bash
# Run both frontend and backend concurrently
npm run dev

# Or run separately
npm run server  # Backend only
npm run client  # Frontend only
```

#### Production Mode
```bash
# Build frontend
cd frontend && npm run build

# Start backend
cd backend && npm start
```

### 6. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/api/health

## 🐳 Docker Deployment

### Development with Docker
```bash
# Run with development configuration
docker-compose -f docker-compose.dev.yml up --build

# Run in background
docker-compose -f docker-compose.dev.yml up -d --build
```

### Production with Docker
```bash
# Copy environment variables
cp env.example .env
# Edit .env with production values

# Run production stack
docker-compose up --build -d

# View logs
docker-compose logs -f
```

### Docker Services
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000  
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

## 🌐 Cloud Deployment

### Frontend Deployment (Vercel)
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   ```
   REACT_APP_API_URL=https://your-backend-domain.com
   REACT_APP_SOCKET_URL=https://your-backend-domain.com
   REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id
   ```
3. Deploy automatically on push to main branch

### Backend Deployment (Railway/Render)

#### Railway
1. Connect GitHub repository to Railway
2. Add environment variables in Railway dashboard
3. Deploy with automatic builds

#### Render
1. Create new Web Service on Render
2. Connect GitHub repository
3. Set build command: `cd backend && npm install`
4. Set start command: `cd backend && npm start`
5. Add environment variables

### Database (MongoDB Atlas)
1. Create cluster in MongoDB Atlas
2. Get connection string
3. Update `MONGODB_URI` in production environment

## 📁 Project Structure

```
MusicApp/
├── backend/                 # Node.js/Express backend
│   ├── config/             # Configuration files
│   ├── middleware/         # Custom middleware
│   ├── models/             # Mongoose models
│   ├── routes/             # API routes
│   ├── socket/             # Socket.io handlers
│   └── server.js           # Entry point
├── frontend/               # React frontend
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   └── App.js          # Main app component
│   └── package.json
├── docker-compose.yml      # Production Docker setup
├── docker-compose.dev.yml  # Development Docker setup
├── Dockerfile.backend      # Backend container
├── Dockerfile.frontend     # Frontend container
├── nginx.conf              # Nginx configuration
├── mongo-init.js           # MongoDB initialization
├── vercel.json             # Vercel deployment config
└── README.md
```

## 🔧 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/google` - Google OAuth login
- `POST /api/auth/refresh` - Refresh token

### Room Endpoints
- `GET /api/rooms` - Get rooms (public/user rooms)
- `POST /api/rooms` - Create new room
- `GET /api/rooms/:id` - Get room details
- `POST /api/rooms/:id/join` - Join room
- `POST /api/rooms/:id/leave` - Leave room
- `PUT /api/rooms/:id` - Update room (host only)
- `DELETE /api/rooms/:id` - Delete room (host only)

### Music Endpoints
- `GET /api/music/search` - Search songs
- `GET /api/music/popular` - Get popular songs
- `POST /api/music/upload` - Upload music file
- `POST /api/music/add-url` - Add song from URL
- `POST /api/music/rooms/:roomId/queue` - Add to queue
- `DELETE /api/music/rooms/:roomId/queue/:songId` - Remove from queue

### Chat Endpoints
- `GET /api/chat/:roomId/messages` - Get room messages
- `POST /api/chat/:roomId/messages` - Send message
- `PUT /api/chat/messages/:id` - Edit message
- `DELETE /api/chat/messages/:id` - Delete message
- `POST /api/chat/messages/:id/react` - Add reaction

### AI Endpoints
- `POST /api/ai/suggest-reply/:roomId` - Get chat suggestions
- `POST /api/ai/music-recommendation/:roomId` - Get music recommendations
- `GET /api/ai/status` - Check AI service status

## 🔐 Security Features

### Backend Security
- **JWT Authentication** with refresh tokens
- **Password Hashing** with bcrypt (12 rounds)
- **Rate Limiting** on all routes
- **CORS Configuration** for cross-origin requests
- **Helmet** for security headers
- **Input Validation** with express-validator
- **SQL Injection Protection** with Mongoose
- **File Upload Security** with type and size limits

### Frontend Security
- **XSS Protection** with React's built-in escaping
- **CSRF Protection** with SameSite cookies
- **Secure Token Storage** in HTTP-only cookies
- **Environment Variable Protection**
- **Content Security Policy** headers

## 🎵 Music Features

### Supported Formats
- **Audio Upload**: MP3, WAV, OGG, M4A (10MB limit)
- **External Sources**: Audius streams, YouTube URLs, Spotify URLs, Direct audio URLs
- **Search Integration**: Millions of songs from Audius API with YouTube fallback

### Playback Features
- **Synchronized Playback** across all room members
- **Queue Management** with drag-and-drop reordering
- **Playback Controls**: play, pause, skip, seek, volume
- **Repeat Modes**: off, one song, all songs
- **Shuffle Mode** for random playback
- **Auto-play** next song in queue

### Room Controls
- **Host Privileges**: full playback control
- **Member Permissions**: configurable (can add songs, can skip)
- **Volume Synchronization** across all members
- **Queue Visibility** for all room members

## 💬 Chat Features

### Message Types
- **Text Messages** with emoji support
- **System Messages** (user join/leave, song changes)
- **Song Notifications** when tracks are added/played
- **Reactions** with emoji picker

### Advanced Features
- **Message Threading** with reply functionality
- **User Mentions** with @ syntax
- **Message Pinning** by moderators/hosts
- **Message Search** within rooms
- **Chat History** with infinite scroll
- **Typing Indicators** for real-time feedback

## 🤖 AI Integration

### Gemini API Features
- **Context-Aware Suggestions** based on recent chat
- **Music Recommendations** based on current room vibe
- **Smart Reply Generation** with conversation context
- **Content Moderation** for inappropriate messages
- **Room Description Generation** for new rooms

### AI Configuration
```javascript
// Example Gemini API usage
const response = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
  {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 150
    }
  }
);
```

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

### Test External Music Search
```bash
# Test Audius API integration
cd backend
node test/testAudiusAPI.js
```

### E2E Testing
```bash
# Run Cypress tests
npm run test:e2e
```

### Manual Testing the Search Feature
1. **Test Audius API directly**:
   ```
   https://api.audius.co/v1/tracks/search?query=arijit%20singh
   ```

2. **Test in the app**:
   - Go to Dashboard and click "Search Music"
   - Search for any artist or song name
   - Preview songs by clicking the play button
   - Add songs to room queue in music rooms

3. **Test different sources**:
   - Use the source dropdown to test Audius vs YouTube
   - Try different search terms and languages
   - Verify streaming works for different song types

## 📊 Monitoring & Analytics

### Health Checks
- **Backend Health**: `/api/health`
- **Database Connection**: MongoDB ping
- **AI Service Status**: `/api/ai/status`
- **Socket.io Status**: Connection monitoring

### Logging
- **Request Logging** with Morgan
- **Error Logging** with Winston
- **Socket Event Logging**
- **Performance Monitoring**

## 🛠️ Development

### Code Style
- **ESLint** for JavaScript linting
- **Prettier** for code formatting
- **Husky** for git hooks
- **Conventional Commits** for commit messages

### Development Tools
```bash
# Linting
npm run lint

# Formatting
npm run format

# Type checking (if using TypeScript)
npm run type-check
```

## 🐛 Troubleshooting

### Common Issues

#### MongoDB Connection Failed
```bash
# Check MongoDB status
mongod --version
# Start MongoDB service
sudo systemctl start mongod
```

#### Socket.io Connection Issues
- Check CORS configuration
- Verify CLIENT_URL in backend .env
- Check firewall/proxy settings

#### Google OAuth Not Working
- Verify redirect URIs in Google Console
- Check CLIENT_ID matches frontend and backend
- Ensure OAuth consent screen is configured

#### Gemini AI API Errors
- Verify API key is valid
- Check API quotas and billing
- Review rate limits

### Debug Mode
```bash
# Backend debugging
cd backend
npm run dev:debug

# Frontend debugging
cd frontend
REACT_APP_DEBUG=true npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Team** for the amazing frontend framework
- **Express.js** for the robust backend framework
- **MongoDB** for the flexible database
- **Socket.io** for real-time communication
- **Google** for OAuth and Gemini AI services
- **Tailwind CSS** for the utility-first CSS framework

## 📞 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Open GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions

---

**Made with ❤️ for music lovers everywhere! 🎵**

Start your musical journey today and connect with friends through the power of synchronized music listening!