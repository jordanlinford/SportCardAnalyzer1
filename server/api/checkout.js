import dotenv from 'dotenv';
import Stripe from 'stripe';
import admin from 'firebase-admin';
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

let db;
try {
  // Check if Firebase Admin is already initialized
  if (!admin.apps.length) {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // Use path relative to this file for serverless function
    const serviceAccountPath = `${__dirname}/../serviceAccountKey.json`;
    
    // Check if the file exists
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin initialized successfully in checkout.js');
    } else {
      console.error('Service account file not found:', serviceAccountPath);
      // Initialize with application default credentials for Vercel
      admin.initializeApp();
      console.log('Firebase Admin initialized with default credentials');
    }
  }
  db = admin.firestore();
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
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