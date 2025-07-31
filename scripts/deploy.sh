#!/bin/bash

# MusicApp Deployment Script
# This script helps deploy the application to various platforms

set -e

echo "🚀 MusicApp Deployment Helper"
echo ""

# Function to deploy to Vercel (Frontend)
deploy_frontend() {
    echo "📦 Building and deploying frontend to Vercel..."
    
    cd frontend
    
    # Install Vercel CLI if not present
    if ! command -v vercel &> /dev/null; then
        echo "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Build the application
    echo "Building React application..."
    npm run build
    
    # Deploy to Vercel
    echo "Deploying to Vercel..."
    vercel --prod
    
    cd ..
    echo "✅ Frontend deployed successfully!"
}

# Function to deploy backend to Railway
deploy_backend_railway() {
    echo "🚂 Deploying backend to Railway..."
    
    cd backend
    
    # Install Railway CLI if not present
    if ! command -v railway &> /dev/null; then
        echo "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    # Login and deploy
    echo "Deploying to Railway..."
    railway login
    railway up
    
    cd ..
    echo "✅ Backend deployed to Railway successfully!"
}

# Function to deploy using Docker
deploy_docker() {
    echo "🐳 Deploying with Docker..."
    
    # Build and start containers
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    
    echo "✅ Docker deployment completed!"
    echo "Frontend: http://localhost:3000"
    echo "Backend: http://localhost:5000"
}

# Function to deploy to Render
deploy_backend_render() {
    echo "🎨 Instructions for Render deployment:"
    echo ""
    echo "1. Go to https://render.com and create a new Web Service"
    echo "2. Connect your GitHub repository"
    echo "3. Use these settings:"
    echo "   - Build Command: cd backend && npm install"
    echo "   - Start Command: cd backend && npm start"
    echo "   - Environment: Node"
    echo "4. Add your environment variables in Render dashboard"
    echo "5. Deploy!"
    echo ""
    echo "For detailed instructions, see README.md"
}

# Main menu
echo "Select deployment option:"
echo "1) Deploy Frontend to Vercel"
echo "2) Deploy Backend to Railway"
echo "3) Deploy Backend to Render (instructions)"
echo "4) Deploy with Docker (local)"
echo "5) Exit"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        deploy_frontend
        ;;
    2)
        deploy_backend_railway
        ;;
    3)
        deploy_backend_render
        ;;
    4)
        deploy_docker
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment process completed!"
echo "Don't forget to update your environment variables with production URLs."