#!/bin/bash

# MusicApp Setup Script
# This script helps set up the development environment

set -e

echo "🎵 Setting up MusicApp Development Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is not supported. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION detected"

# Check if MongoDB is installed (optional for local development)
if command -v mongod &> /dev/null; then
    echo "✅ MongoDB detected locally"
else
    echo "⚠️  MongoDB not detected locally. You'll need MongoDB Atlas or Docker."
fi

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Create environment files if they don't exist
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating backend environment file..."
    cp env.example backend/.env
    echo "⚠️  Please edit backend/.env with your configuration"
fi

if [ ! -f "frontend/.env" ]; then
    echo "📝 Creating frontend environment file..."
    cp frontend/env.example frontend/.env
    echo "⚠️  Please edit frontend/.env with your configuration"
fi

# Create uploads directory
mkdir -p backend/uploads/music
mkdir -p backend/logs

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your MongoDB URI, JWT secrets, and API keys"
echo "2. Edit frontend/.env with your API URLs"
echo "3. Set up Google OAuth and Gemini API credentials"
echo "4. Start development: npm run dev"
echo ""
echo "For detailed setup instructions, see README.md"