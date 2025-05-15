#!/usr/bin/env node

/**
 * Script to properly start the server in different environments.
 * 
 * In development: Runs the server as a standalone process on port 3001
 * In production/Vercel: Routes are handled by serverless functions
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, '..');

// Check if we're running in Vercel
const isVercel = process.env.VERCEL === '1';

// Check if port 3001 is already in use
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net.createServer()
      .once('error', () => {
        // Port is in use
        resolve(true);
      })
      .once('listening', () => {
        // Port is free, close the server
        tester.close();
        resolve(false);
      })
      .listen(port);
  });
}

async function startServer() {
  // Skip in Vercel environment
  if (isVercel) {
    console.log('Running in Vercel environment, using serverless functions');
    return;
  }
  
  // Check if port is in use
  const portInUse = await isPortInUse(3001);
  
  if (portInUse) {
    console.log('Port 3001 is already in use. The server might already be running.');
    return;
  }
  
  // Start the server in development mode
  console.log('Starting server on port 3001...');
  
  const serverProcess = spawn('node', ['index.js'], {
    cwd: serverDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: 3001
    }
  });
  
  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
}

// Run the server starter
startServer().catch(console.error); 