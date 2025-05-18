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

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- Firebase Admin init ---
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../credentials/service-account.json'), 'utf8')
);
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

// --- API routes first ---

// After health check endpoint, add lightweight aliases declared first
// -------------------------------------------------------------------
// Simple aliases declared early so they take precedence
app.post('/api/text-search', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'query required' });
    }
    const rawListings = await scrapeEbay(query.trim());
    const listings = rawListings.map(l => ({ ...l, imageUrl: l.imageUrl || l.image || '' }));
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

// Other API routes (e.g., market analysis, Stripe webhooks) go here...

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
