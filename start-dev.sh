#!/bin/bash

# Kill any existing processes on ports 3001 and 5135
echo "Cleaning up existing processes..."
pkill -f "node server/index.js" || true
pkill -f "vite" || true

# Start the backend server
echo "Starting backend server..."
cd server && node index.js &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start the frontend development server
echo "Starting frontend server..."
cd .. && npm run dev &
FRONTEND_PID=$!

# Function to handle script termination
cleanup() {
    echo "Shutting down servers..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit 0
}

# Set up trap to catch termination signals
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

echo "Development environment running!"
echo "Test server: http://localhost:9876"
echo "Frontend: Check the URL in the console output above"
echo "Press Ctrl+C to stop all servers" 