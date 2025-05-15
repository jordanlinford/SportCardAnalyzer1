import dotenv from 'dotenv';
import Stripe from 'stripe';
import firebaseAdmin, { db } from './firebase-admin.js';
import { buffer } from 'micro';

dotenv.config();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

export const config = {
  api: {
    bodyParser: false, // Don't parse the body, we need the raw body for the Stripe webhook
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const body = await buffer(req);

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const subscriptionId = session.subscription;

        if (userId) {
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
            createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          });
          
          // Also update the main user document with subscription tier info
          let tierName = 'rookie'; // Default tier
          
          // Determine tier name from price ID
          if (priceId === 'price_1RDB4fGCix0pRkbmlNdsyo7s' || priceId === 'price_1RN5uOGCix0pRkbmK2kCjqw4') {
            tierName = 'star';
          } else if (priceId === 'price_1RDB4fGCix0pRkbmmPrBX8FE' || priceId === 'price_1RN5vwGCix0pRkbmT65EllS1') {
            tierName = 'veteran';
          }
          
          // Update the main user document
          await db.collection('users').doc(userId).update({
            subscriptionTier: tierName,
            subscriptionPriceId: priceId,
            subscriptionUpdatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          });
          
          console.log(`Updated user ${userId} subscription tier to ${tierName}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Find the user with this customerId
        const usersRef = db.collection('users');
        const userSubscriptionsSnapshot = await db.collectionGroup('subscriptions')
          .where('customerId', '==', customerId)
          .get();
          
        if (!userSubscriptionsSnapshot.empty) {
          // Get the first matching document
          const userSubDoc = userSubscriptionsSnapshot.docs[0];
          // Get the parent path and extract the user ID
          const userIdPath = userSubDoc.ref.parent.parent.path;
          const userId = userIdPath.split('/').pop();
          
          if (userId) {
            // Update the user's subscription status in Firestore
            await db.collection('users').doc(userId).collection('subscriptions').doc('active').set({
              status: 'canceled',
              canceledAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            
            // Reset the main user document subscription tier to 'rookie'
            await db.collection('users').doc(userId).update({
              subscriptionTier: 'rookie',
              subscriptionStatus: 'canceled',
              subscriptionUpdatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
            });
            
            console.log(`Reset user ${userId} subscription tier to rookie (canceled)`);
          }
        } else {
          console.log(`No user found with customerId: ${customerId}`);
        }
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper to get raw body for Stripe webhook signature validation
async function buffer(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
} 