#!/bin/bash

echo "Starting MusicApp..."
echo ""
echo "This will start both backend and frontend servers"
echo "Backend will run on: http://localhost:5000"
echo "Frontend will run on: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Change to the project directory
cd "$(dirname "$0")"

# Start both servers
npm start 