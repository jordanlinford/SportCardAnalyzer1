const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set development variables if needed
if (process.env.NODE_ENV !== 'production') {
  process.env.STRIPE_DEV_MODE = 'true';
  
  // Define default price IDs if not set in .env
  if (!process.env.STRIPE_DEV_STAR_MONTHLY) {
    process.env.STRIPE_DEV_STAR_MONTHLY = 'price_1PBnIKJVDpvtEXYsMPKQZYkP';
  }
  if (!process.env.STRIPE_DEV_STAR_ANNUAL) {
    process.env.STRIPE_DEV_STAR_ANNUAL = 'price_1PBnILJVDpvtEXYsvwvKxoGS';
  }
  if (!process.env.STRIPE_DEV_VETERAN_MONTHLY) {
    process.env.STRIPE_DEV_VETERAN_MONTHLY = 'price_1PBnIMJVDpvtEXYsWLDjIxOA';
  }
  if (!process.env.STRIPE_DEV_VETERAN_ANNUAL) {
    process.env.STRIPE_DEV_VETERAN_ANNUAL = 'price_1PBnINJVDpvtEXYssRVPq82m';
  }
  
  // Set frontend URL if not defined
  if (!process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL = 'http://localhost:5173';
  }
}

// Select which server file to run
const serverFile = process.env.NODE_ENV === 'production'
  ? '../index.js'
  : '../index.js';

// Start the server
const server = spawn('node', [serverFile], {
  env: process.env,
  stdio: 'inherit',
  shell: true
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

server.on('error', (err) => {
  console.error('Failed to start server process:', err);
});

// Handle termination signals
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down server...');
  server.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down server...');
  server.kill('SIGTERM');
  process.exit(0);
}); 