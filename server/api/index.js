import express from 'express';
import ebayRoutes from './routes/ebay.js';
import { scrapeEbay } from '../ebayScraperService.js';
import Stripe from 'stripe';

const router = express.Router();

// Mount routes
router.use('/ebay', ebayRoutes);

// Text search endpoint
router.post('/text-search', async (req, res) => {
  try {
    const { query, limit, negKeywords, grade } = req.body;
    const maxResults = limit || 60; // Default to 60 results

    console.log(`➡️  Text search for: ${query}`);
    const listings = await scrapeEbay(query, maxResults, negKeywords, grade);
    console.log(`  ↳ Found ${listings.length} sold listings`);
    
    res.json({
      success: true,
      listings,
      message: `Found ${listings.length} sold listings`
    });
  } catch (error) {
    console.error('Error scraping eBay:', error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message}`,
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