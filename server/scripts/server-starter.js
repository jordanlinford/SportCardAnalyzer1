import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get current file directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set development variables if needed
if (process.env.NODE_ENV !== 'production') {
  process.env.STRIPE_DEV_MODE = 'true';
  
  // Define default price IDs if not set in .env
  if (!process.env.STRIPE_DEV_STAR_MONTHLY) {
    process.env.STRIPE_DEV_STAR_MONTHLY = 'price_1RDB4fGCix0pRkbmlNdsyo7s';
  }
  if (!process.env.STRIPE_DEV_STAR_ANNUAL) {
    process.env.STRIPE_DEV_STAR_ANNUAL = 'price_1RN5uOGCix0pRkbmK2kCjqw4';
  }
  if (!process.env.STRIPE_DEV_VETERAN_MONTHLY) {
    process.env.STRIPE_DEV_VETERAN_MONTHLY = 'price_1RDB4fGCix0pRkbmmPrBX8FE';
  }
  if (!process.env.STRIPE_DEV_VETERAN_ANNUAL) {
    process.env.STRIPE_DEV_VETERAN_ANNUAL = 'price_1RN5vwGCix0pRkbmT65EllS1';
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