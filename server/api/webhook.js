import dotenv from 'dotenv';
import Stripe from 'stripe';
import admin from 'firebase-admin';
import { buffer } from 'micro';

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

export const config = {
  api: {
    bodyParser: false, // Disable the default body parser
  },
};

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

  let stripeEvent;
  try {
    // Get the raw request body
    const rawBody = await buffer(req);
    const sig = req.headers['stripe-signature'];

    // Validate the webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const userId = session.metadata.userId;
        const subscriptionId = session.subscription;

        if (userId && db) {
          // Get the subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0].price.id;

          // Update the user's subscription in Firestore
          await db.collection('users').doc(userId).collection('subscriptions').doc('active').set({
            subscriptionId,
            priceId,
            customerId: subscription.customer,
            status: 'active',
            currentPeriodEnd: subscription.current_period_end,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const userId = subscription.metadata.userId;

        if (userId && db) {
          // Update the user's subscription status in Firestore
          await db.collection('users').doc(userId).collection('subscriptions').doc('active').set({
            status: 'canceled',
            canceledAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        break;
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).json({ error: 'Error processing webhook' });
  }
} 