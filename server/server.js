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

const app = express();
const port = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Create images directory if it doesn't exist
const IMAGES_DIR = path.join(__dirname, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  console.log('Created local image cache dir', IMAGES_DIR);
}

// Set up cache for eBay searches
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hour TTL, check every 10 minutes

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

app.use(express.json());

// Static file middleware for serving cached images
app.use('/images', express.static(path.join(__dirname, 'images')));

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../credentials/service-account.json'), 'utf8')
);
console.log('Using service account:', serviceAccount.client_email);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
console.log('Firebase Admin initialized successfully');

// Initialize Vision API
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credsPath = path.join(__dirname, '../credentials/service-account.json');
  if (fs.existsSync(credsPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
    console.log('GOOGLE_APPLICATION_CREDENTIALS set to', credsPath);
  }
}
const visionClient = new vision.ImageAnnotatorClient();
console.log('Google Vision client initialized');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

// Multer setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// API Routes
app.post('/api/text-search', async (req, res) => {
  try {
    const { query, limit = 60 } = req.body;
    
    if (!query) {
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 