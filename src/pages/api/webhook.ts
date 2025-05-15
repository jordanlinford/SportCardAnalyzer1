import { buffer } from 'micro';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { NextApiRequest, NextApiResponse } from 'next';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
});

// Set this secret in your Stripe dashboard
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event: Stripe.Event;
  try {
    if (!sig) {
      throw new Error('No signature found');
    }
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        const email = customer.email;

        // Find user by email (you could also use metadata if set)
        const userSnap = await db.collection('users').where('email', '==', email).get();
        if (userSnap.empty) {
          console.warn('No user found with email', email);
          break;
        }

        const userRef = userSnap.docs[0].ref;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
        const planId = subscription.items.data[0].price.id;

        let tier = 'rookie';
        if (planId.includes('star')) tier = 'star';
        if (planId.includes('veteran')) tier = 'veteran';

        await userRef.update({
          subscription: {
            tier,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: 'active',
            interval: subscription.items.data[0].price.recurring?.interval,
            currentPeriodEnd: subscription && 'current_period_end' in subscription
              ? new Date((subscription as any).current_period_end * 1000).getTime()
              : null,
          },
        });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
          const customerId = subscription.customer as string;

          const userSnap = await db.collection('users')
            .where('subscription.stripeCustomerId', '==', customerId)
            .get();

          if (!userSnap.empty) {
            await userSnap.docs[0].ref.update({
              'subscription.status': 'past_due',
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const userSnap = await db.collection('users')
          .where('subscription.stripeCustomerId', '==', customerId)
          .get();

        if (!userSnap.empty) {
          await userSnap.docs[0].ref.update({
            'subscription.status': 'canceled',
            'subscription.tier': 'rookie',
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Error processing webhook' });
  }
} 