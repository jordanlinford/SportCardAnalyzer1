import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { firefox } from '@playwright/firefox';
import { scrapeEbay } from './ebayScraperService.js';
import { fetchEbayImages } from './ebayImageScraper.js';
import NodeCache from 'node-cache';
import multer from 'multer';
import admin from 'firebase-admin';
import vision from '@google-cloud/vision';
import Stripe from 'stripe';

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
});

try {
  console.log('Starting server initialization...');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Current directory: ${process.cwd()}`);

  const app = express();
  const port = process.env.PORT || 10000;
  const __dirname = dirname(fileURLToPath(import.meta.url));
  console.log(`Server directory: ${__dirname}`);

  // Create images directory if it doesn't exist
  const IMAGES_DIR = path.join(__dirname, 'images');
  try {
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
      console.log('Created local image cache dir:', IMAGES_DIR);
    } else {
      console.log('Using existing image cache dir:', IMAGES_DIR);
    }
  } catch (error) {
    console.warn('Warning: Failed to create/access images directory:', error.message);
  }

  // Set up cache for eBay searches
  const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hour TTL, check every 10 minutes
  console.log('Cache initialized');

  // Middleware
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow mobile apps / curl

      const allowedPatterns = [
        /^https?:\/\/localhost(:\d+)?$/,
        /netlify\.app$/,
        /render\.com$/,
        /sportscardanalyzer\.com$/
      ];

      if (allowedPatterns.some((re) => re.test(origin))) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked for origin ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  console.log('CORS middleware configured');

  app.use(express.json());
  console.log('JSON middleware configured');

  // Static file middleware for serving cached images
  app.use('/images', express.static(path.join(__dirname, 'images')));
  console.log('Static file middleware configured');

  // Root path handler
  app.get('/', (req, res) => {
    console.log('Received request at root path');
    res.json({
      status: 'ok',
      message: 'Sports Card Analyzer API is running',
      version: '1.0.0',
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      uptime: process.uptime()
    });
  });
  console.log('Root path handler configured');

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    console.log('Received health check request');
    res.json({ 
      status: 'ok',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV
    });
  });
  console.log('Health check endpoint configured');

  // Initialize Firebase Admin (if credentials are available)
  try {
    const credentialsPath = path.join(__dirname, '../credentials/service-account.json');
    if (fs.existsSync(credentialsPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin initialized successfully');
    } else {
      console.log('Firebase credentials not found, skipping initialization');
    }
  } catch (error) {
    console.warn('Failed to initialize Firebase:', error.message);
  }

  // Initialize Vision API (if credentials are available)
  let visionClient;
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credsPath = path.join(__dirname, '../credentials/service-account.json');
      if (fs.existsSync(credsPath)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
        console.log('GOOGLE_APPLICATION_CREDENTIALS set to', credsPath);
        visionClient = new vision.ImageAnnotatorClient();
        console.log('Google Vision client initialized');
      } else {
        console.log('Vision API credentials not found, skipping initialization');
      }
    }
  } catch (error) {
    console.warn('Failed to initialize Vision API:', error.message);
  }

  // Initialize Stripe (if key is available)
  let stripe;
  try {
    if (process.env.STRIPE_SECRET_KEY) {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
      console.log('Stripe initialized successfully');
    } else {
      console.log('Stripe secret key not found, skipping initialization');
    }
  } catch (error) {
    console.warn('Failed to initialize Stripe:', error.message);
  }

  // Multer setup for file uploads
  const upload = multer({ storage: multer.memoryStorage() });
  console.log('File upload middleware configured');

  // API Routes
  app.post('/api/text-search', async (req, res) => {
    try {
      console.log('Received text search request:', req.body);
      const { query, limit = 60 } = req.body;
      
      if (!query) {
        console.warn('Missing search query');
        return res.status(400).json({ success: false, message: 'search query required' });
      }
      
      console.log(`➡️  Searching eBay for: ${query}`);
      const listings = await scrapeEbay(query, limit);
      console.log(`  ↳ Found ${listings.length} listings`);
      
      res.json({
        success: true,
        listings,
        count: listings.length
      });
    } catch (error) {
      console.error('Error in text-search:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        listings: []
      });
    }
  });
  console.log('API routes configured');

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });
  console.log('Error handling middleware configured');

  // Start server
  console.log('Starting server on port', port);

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    console.log('Server initialization complete');
    
    // Log server details
    const address = server.address();
    console.log('Server details:', {
      port: address.port,
      address: address.address,
      family: address.family,
      protocol: server.protocol || 'http'
    });
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use`);
    }
  });

  // Handle process termination
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

} catch (error) {
  console.error('Fatal error during server initialization:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
} 