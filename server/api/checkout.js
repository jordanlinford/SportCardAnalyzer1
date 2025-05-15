import dotenv from 'dotenv';
import Stripe from 'stripe';
import admin from 'firebase-admin';

dotenv.config();

let db;
try {
  // Check if Firebase Admin is already initialized
  if (!admin.apps.length) {
    // For Vercel environment, use environment variable with JSON credentials
    if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin initialized successfully with credentials from environment');
      } catch (parseError) {
        console.error('Error parsing Firebase Admin credentials:', parseError);
        // Initialize with application default credentials as fallback
        admin.initializeApp();
        console.log('Firebase Admin initialized with default credentials (fallback)');
      }
    } else {
      // For local development, attempt to use local file
      try {
        // This approach works for local development but not in Vercel
        const serviceAccount = require('../../firebase-adminsdk.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin initialized successfully with local file');
      } catch (fileError) {
        console.error('Error loading local credentials file:', fileError);
        // Initialize with application default credentials as fallback
        admin.initializeApp();
        console.log('Firebase Admin initialized with default credentials (no credentials found)');
      }
    }
  } else {
    console.log('Using existing Firebase Admin app');
  }
  
  db = admin.firestore();
} catch (error) {
  console.error('Critical error in Firebase Admin initialization:', error);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { priceId, userId } = req.body;

  if (!priceId || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile`,
      metadata: { userId },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
} 