#!/bin/bash

# Start the backend server in background
cd backend
python run_local.py &
BACKEND_PID=$!
cd ..

# Start the frontend
echo "Starting frontend..."
npm run dev

# When frontend process ends, kill backend
kill $BACKEND_PID 