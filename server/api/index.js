import express from 'express';
import ebayRoutes from './routes/ebay.js';
import { scrapeEbay } from '../ebayScraperService.js';
import Stripe from 'stripe';
import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Mount routes
router.use('/ebay', ebayRoutes);

// Images health check endpoint
router.get('/images-health', (req, res) => {
  try {
    const imagesDir = path.join(__dirname, '..', 'images');
    const stats = {
      exists: fs.existsSync(imagesDir),
      writable: false,
      readable: false,
      files: [],
      path: imagesDir
    };
    
    // Check if directory is writable
    try {
      fs.accessSync(imagesDir, fs.constants.W_OK);
      stats.writable = true;
    } catch (e) {
      console.warn('Images directory not writable:', e.message);
    }
    
    // Check if directory is readable
    try {
      fs.accessSync(imagesDir, fs.constants.R_OK);
      stats.readable = true;
      // List first 5 files if readable
      const files = fs.readdirSync(imagesDir);
      stats.files = files.slice(0, 5);
      stats.totalFiles = files.length;
    } catch (e) {
      console.warn('Images directory not readable:', e.message);
    }
    
    res.json({
      status: 'ok',
      imagesDirectory: stats
    });
  } catch (error) {
    console.error('Error checking images directory:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Text search endpoint
router.post('/text-search', async (req, res) => {
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
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize Stripe if we have a secret key
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
  console.log('Stripe initialized');
} else {
  console.warn('[API] STRIPE_SECRET_KEY not set – /create-checkout-session will return 500');
}

router.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'Stripe not configured' });
    }

    const { priceId, userId, planName, interval } = req.body;

    if (!priceId || !userId) {
      return res.status(400).json({ success: false, message: 'Missing priceId or userId' });
    }

    const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription-success`;
    const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        planName: planName || '',
        interval: interval || '',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router; 