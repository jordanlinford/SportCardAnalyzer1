import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import vision from '@google-cloud/vision';
import { scrapeEbay } from './ebayScraperService.js';
import multer from 'multer';
import axios from 'axios';
import Stripe from 'stripe';

// Load .env in this directory, regardless of where node was started
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- Firebase Admin init ---
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../credentials/service-account.json'), 'utf8')
);
console.log('Using service account:', serviceAccount.client_email);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin initialized successfully with local file');

// Make sure the Vision SDK knows where the key is even when the shell env
// variable wasn't exported correctly *before* we instantiate the client.
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credsPath = path.join(__dirname, 'credentials/service-account.json');
  if (fs.existsSync(credsPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
    console.log('GOOGLE_APPLICATION_CREDENTIALS set to', credsPath);
  } else {
    console.warn('⚠️  Vision credentials file missing at', credsPath);
  }
}

const visionClient = new vision.ImageAnnotatorClient();
console.log('Google Vision client initialised');

// Multer setup for in-memory file storage
const upload = multer({ storage: multer.memoryStorage() });

// ------------------------------------------------------
// Helper: lightly sanitise OCR text before eBay scraping
// ------------------------------------------------------
const sanitizeOcr = (raw = '') => {
  if (!raw) return '';
  // Collapse whitespace / new-lines → single space
  let txt = raw.replace(/\s+/g, ' ').trim();
  // Drop noisy domains / boiler-plate words
  txt = txt.replace(/imgur\.com|shop on ebay|ebay/gi, '').trim();
  // Keep first ~10 words to avoid overly long queries
  return txt.split(' ').slice(0, 10).join(' ').trim();
};

// Normalise incoming query strings
function normalizeQuery(raw = '') {
  return raw
    .toUpperCase()
    // strip explicit grade numbers so we don\'t over-restrict ebay text search
    .replace(/\b(?:PSA|BGS|SGC|CGC)\s*\d{1,2}\b/g, '')
    .replace(/\b(?:GEM\s*MINT|RC|ROOKIE)\b/g, '')
    // keep the # symbol by turning it into a space-separated token instead of deleting it
    .replace(/[()]/g, ' ')
    .replace(/#/g, ' #')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- API routes first ---

// After health check endpoint, add lightweight aliases declared first
// -------------------------------------------------------------------
// Simple aliases declared early so they take precedence
app.post('/api/text-search', async (req, res) => {
  try {
    const { query, limit: limitParam } = req.body || {};
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'query required' });
    }
    const cleaned = normalizeQuery(query);
    const limit = Math.min(parseInt(limitParam, 10) || 60, 100);
    const rawListings = await scrapeEbay(cleaned, limit);
    const listings = rawListings.map(l => ({ 
      ...l, 
      imageUrl: l.imageUrl || l.image || '',
      grade: detectGrade(l.title || '')
    }));
    return res.json({ success: true, listings, count: listings.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/image-search', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || url.trim() === '') {
      return res.status(400).json({ success: false, message: 'url query param required' });
    }

    // Attempt OCR on the provided image URL first
    let ocrQuery = '';
    try {
      const [visionResponse] = await visionClient.textDetection(url);
      ocrQuery = visionResponse.textAnnotations?.[0]?.description || '';
    } catch (e) {
      console.warn('Vision API error:', e.message);
    }

    const cleaned = sanitizeOcr(ocrQuery);

    if (cleaned) {
      // Use sanitised OCR text to get eBay sold listings
      const raw = await scrapeEbay(cleaned);
      const listings = raw.map(l => ({ ...l, imageUrl: l.imageUrl || l.image || '' }));
      return res.json({ success: true, ocrQuery: cleaned, listings });
    }

    // Fallback: OCR produced no text. Just return empty list with fallback flag.
    return res.json({ success: true, fallback: true, listings: [] });
  } catch (err) {
    console.error('/api/image-search error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/image-search/upload – accept file upload
app.post('/api/image-search/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'image file is required' });
    }

    // Vision text detection on raw bytes
    let ocrQuery = '';
    try {
      const [visionResponse] = await visionClient.textDetection({ image: { content: req.file.buffer } });
      ocrQuery = visionResponse.textAnnotations?.[0]?.description || '';
    } catch (e) {
      console.warn('Vision API error (upload):', e.message);
    }

    const cleaned = sanitizeOcr(ocrQuery);

    if (cleaned) {
      const raw = await scrapeEbay(cleaned);
      const listings = raw.map(l => ({ ...l, imageUrl: l.imageUrl || l.image || '' }));
      return res.json({ success: true, ocrQuery: cleaned, listings });
    }

    return res.json({ success: true, fallback: true, listings: [] });
  } catch (err) {
    console.error('/api/image-search/upload error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// Simple health-check endpoint so front-end can verify the server is alive.
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
//  NEW: Trigger full collection value refresh for a user (fire-and-forget)
//        POST /api/update-collection/:uid
// ---------------------------------------------------------------------------

// Heavy worker extracted so it can run independently of the HTTP response
async function updateCollectionWorker(uid) {
  const db = admin.firestore();

  // Fetch cards from both "cards" and legacy "collection" sub-collections
  const cardsSnap      = await db.collection('users').doc(uid).collection('cards').get();
  const collectionSnap = await db.collection('users').doc(uid).collection('collection').get();

  const allDocs = [...cardsSnap.docs, ...collectionSnap.docs];
  if (allDocs.length === 0) {
    console.warn('update-collection: no cards found for', uid);
    return;
  }

  // Helper: average of most-recent 3 sale prices
  const calcAvg = (listings = []) => {
    if (!listings.length) return null;
    listings.sort((a, b) => {
      const da = new Date(a.date || a.dateSold || 0).getTime();
      const dbt = new Date(b.date || b.dateSold || 0).getTime();
      return dbt - da;
    });
    const recent = listings.slice(0, 3);
    const total = recent.reduce((s, l) => s + (l.totalPrice || l.price || 0), 0);
    return total && recent.length ? total / recent.length : null;
  };

  let updated = 0;
  let errors  = 0;

  for (const doc of allDocs) {
    const card = doc.data();
    const id   = doc.id;

    if (!card.playerName || !card.year || !card.cardSet) continue; // skip incomplete docs

    const fullSearchString = `${card.year} ${card.playerName} ${card.cardSet} ${card.variation || ''} ${card.cardNumber || ''} ${card.condition || ''}`.trim();

    try {
      let listings = [];
      try {
        listings = await scrapeEbay(fullSearchString);
      } catch (_) {
        // Fallback to internal endpoint
        const resp = await axios.post('http://localhost:3001/api/text-search', { query: fullSearchString });
        listings = resp.data?.listings || [];
      }

      const avg = calcAvg(listings);
      if (avg && (!card.currentValue || Math.abs(card.currentValue - avg) > (card.currentValue || 0) * 0.05)) {
        const parentColl = doc.ref.parent.id; // "cards" or "collection"
        await db.collection('users').doc(uid).collection(parentColl).doc(id).update({ currentValue: avg });
        updated++;
      }
    } catch (err) {
      console.warn('update-card error', id, err.message);
      errors++;
    }

    // Brief pause to avoid hammering eBay
    await new Promise(r => setTimeout(r, 800));
  }

  // Record total collection value snapshot once the loop is done
  try {
    const freshCards      = await db.collection('users').doc(uid).collection('cards').get();
    const freshCollection = await db.collection('users').doc(uid).collection('collection').get();
    const total = [...freshCards.docs, ...freshCollection.docs].reduce((sum, d) => {
      const data = d.data();
      return sum + (data.currentValue || data.price || 0);
    }, 0);

    await db.collection('users').doc(uid).collection('value_history').add({
      timestamp : admin.firestore.FieldValue.serverTimestamp(),
      totalValue: total,
    });
  } catch (e) {
    console.warn('failed to write value_history', e.message);
  }

  console.log(`update-collection completed for ${uid}: updated ${updated} cards, ${errors} errors`);
}

// Lightweight endpoint – returns immediately, work continues in background
app.post('/api/update-collection/:uid', (req, res) => {
  const { uid } = req.params;
  if (!uid) {
    return res.status(400).json({ success: false, message: 'uid param required' });
  }

  // Fire-and-forget – don't await the promise
  updateCollectionWorker(uid).catch(err => console.error('updateCollectionWorker error:', err.message));

  // 202 Accepted: processing started but not finished
  res.status(202).json({ success: true, message: 'Collection value refresh started' });
});

// Other API routes (e.g., market analysis, Stripe webhooks) go here...

// Stripe setup
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

// Create checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { priceId, userId, planName, interval } = req.body;
    if (!priceId || !userId) {
      return res.status(400).json({ success: false, message: 'priceId and userId required' });
    }

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
      success_url: `${process.env.DOMAIN || 'http://localhost:5173'}/profile?success=true`,
      cancel_url: `${process.env.DOMAIN || 'http://localhost:5173'}/profile?canceled=true`,
    });

    return res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Create customer portal session
app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    // You should store stripeCustomerId on user doc when creating checkout session; minimal fallback:
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const customerId = userDoc.data()?.stripeCustomerId;
    if (!customerId) {
      return res.status(400).json({ success: false, message: 'No Stripe customer found for user' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.DOMAIN || 'http://localhost:5173'}/profile`,
    });

    return res.json({ success: true, url: portalSession.url });
  } catch (err) {
    console.error('Stripe portal error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- static + catch-all afterward ---

const buildPath = path.join(__dirname, '../client/build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));

  // For all other routes, serve the React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// --- Start server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function detectGrade(title = '') {
  if (!title) return 'Raw';
  // Capture patterns like "PSA 10", "PSA GEM MINT 10", "PSA GEM-MT 10", etc.
  const standard = title.match(/\b(PSA|BGS|SGC|CGC|CSG|HGA)\s*(?:GEM\s*(?:MINT|MT|-?MT)?\s*)?(\d{1,2}(?:\.5)?)\b/i);
  if (standard) return `${standard[1].toUpperCase()} ${standard[2]}`;

  // Fallback: look for brand then any non-digit chars then a grade number
  const loose = title.match(/\b(PSA|BGS|SGC|CGC|CSG|HGA)[^0-9]{0,6}(10|9(?:\.5)?|8(?:\.5)?)\b/i);
  if (loose) return `${loose[1].toUpperCase()} ${loose[2]}`;

  if (/RAW|UN ?GRADED/i.test(title)) return 'Raw';
  return 'Raw';
}
