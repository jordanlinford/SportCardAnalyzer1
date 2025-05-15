import Stripe from 'stripe';
import firebaseAdmin, { db } from './firebase-admin.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { priceId, userId, planName, interval } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'Missing price ID', message: 'No price ID provided in request' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'Missing user ID', message: 'No user ID provided in request' });
  }

  try {
    // Define the correct price IDs for your environment
    const mapPriceId = (originalId) => {
      // List of known valid Stripe price IDs for direct pass-through
      const knownValidPriceIds = [
        'price_1RN5t3GCix0pRkbmBX32A7AG',  // Rookie Plan
        'price_1RDB4fGCix0pRkbmlNdsyo7s',  // Star Plan Monthly
        'price_1RN5uOGCix0pRkbmK2kCjqw4',  // Star Plan Annual
        'price_1RDB4fGCix0pRkbmmPrBX8FE',  // Veteran Plan Monthly
        'price_1RN5vwGCix0pRkbmT65EllS1'   // Veteran Plan Annual
      ];
      
      // If it's a known Stripe price ID, use it directly
      if (knownValidPriceIds.includes(originalId)) {
        console.log(`Using known valid price ID: ${originalId}`);
        return originalId;
      }
      
      // If the submitted ID starts with 'price_1', it's probably a Stripe price ID
      if (originalId && originalId.startsWith('price_1')) {
        console.log(`Using ID that appears to be a Stripe price ID: ${originalId}`);
        return originalId;
      }
      
      // Otherwise, try to map it to a known price ID
      const priceMap = {
        // Map generic price IDs to your actual Stripe price IDs
        'price_star_monthly': 'price_1RDB4fGCix0pRkbmlNdsyo7s',
        'price_star_annual': 'price_1RN5uOGCix0pRkbmK2kCjqw4',
        'price_veteran_monthly': 'price_1RDB4fGCix0pRkbmmPrBX8FE',
        'price_veteran_annual': 'price_1RN5vwGCix0pRkbmT65EllS1',
        'rookie_plan': 'price_1RN5t3GCix0pRkbmBX32A7AG',
        'free': 'price_1RN5t3GCix0pRkbmBX32A7AG'
      };
      
      const mappedId = priceMap[originalId];
      
      if (!mappedId) {
        console.error(`No mapping found for price ID: ${originalId}`);
        throw new Error(`Invalid price ID: ${originalId}. No mapping found.`);
      }
      
      console.log(`Mapped price ID: ${originalId} → ${mappedId}`);
      return mappedId;
    };

    // Get the mapped price ID for Stripe
    let finalPriceId;
    try {
      finalPriceId = mapPriceId(priceId);
      console.log(`Using Stripe price ID: ${finalPriceId}`);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid price ID', 
        message: error.message,
        validOptions: {
          'price_star_monthly': 'Star Plan (Monthly)',
          'price_star_annual': 'Star Plan (Annual)',
          'price_veteran_monthly': 'Veteran Plan (Monthly)',
          'price_veteran_annual': 'Veteran Plan (Annual)',
          'rookie_plan': 'Rookie Plan (Free)'
        }
      });
    }

    // Get the frontend URL, defaulting to localhost
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: finalPriceId, quantity: 1 }],
      success_url: `${frontendUrl}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/profile`,
      metadata: { 
        userId,
        planName: planName || 'Unknown plan', 
        interval: interval || 'monthly' 
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
} 