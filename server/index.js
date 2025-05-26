// This file has been renamed to index.backup.js to prevent Vercel from bundling it.
// Restore if needed.

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
import puppeteer from 'puppeteer';
import NodeCache from 'node-cache';
import { fetchEbayImages } from './ebayImageScraper.js';
import morgan from 'morgan';
import firefox from 'puppeteer-firefox';
const cors = require('cors');
app.use(cors({
  origin: '*'  // This allows all origins for now
}));
// Load .env in this directory, regardless of where node was started
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Add the base URL for the API
const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';

// Set up cache for eBay searches
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hour TTL, check every 10 minutes

// Set up image cache directory
const IMAGES_DIR = path.join(__dirname, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  console.log('[ebayScraper] Created local image cache dir', IMAGES_DIR);
}

// Helper function to cache images
async function cacheImage(localPath, remoteUrl) {
  if (!localPath || !remoteUrl) return false;
  if (fs.existsSync(localPath)) return true; // already cached
  
  try {
    const response = await axios.get(remoteUrl, { 
      responseType: 'arraybuffer', 
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });
    
    fs.writeFileSync(localPath, response.data);
    return true;
  } catch(err) {
    console.warn('cacheImage: failed', remoteUrl.substring(0, 120), err.message);
    return false;
  }
}

// Hard-coded images for certain popular cards to ensure we have good images
const CARD_IMAGES = {
  // Justin Jefferson base
  'justin jefferson 2020 prizm base psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson 2020 prizm base psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  'justin jefferson 2020 prizm base': 'https://i.ebayimg.com/images/g/EkoAAOSwasFll1PQ/s-l1600.jpg',
  'justin jefferson 2020 prizm silver': 'https://i.ebayimg.com/images/g/JToAAOSwAiVncY-S/s-l1600.jpg',
  'justin jefferson 2020 prizm red white blue': 'https://i.ebayimg.com/images/g/PQMAAOSwwSRnEP2H/s-l1600.jpg',
  'justin jefferson 2020 prizm psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson 2020 prizm psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  'justin jefferson 2020 prizm #398 psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson 2020 prizm #398 psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  'justin jefferson 2020 prizm 398 psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson 2020 prizm 398 psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  // Additional backups with different variations
  'justin jefferson prizm psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson prizm psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  'justin jefferson psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
  'justin jefferson psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
  'justin jefferson rookie': 'https://i.ebayimg.com/images/g/EkoAAOSwasFll1PQ/s-l1600.jpg',
};

// Helper function to get a known card image if available
function getKnownCardImage(title) {
  if (!title) return null;
  
  const normalizedTitle = title.toLowerCase();
  
  // Check for exact matches
  for (const [key, url] of Object.entries(CARD_IMAGES)) {
    if (normalizedTitle.includes(key)) {
      return url;
    }
  }
  
  // Try to match by components
  if (normalizedTitle.includes('justin jefferson') && 
      normalizedTitle.includes('2020') && 
      normalizedTitle.includes('prizm')) {
    
    // Check for graded versions
    if (normalizedTitle.includes('psa 10')) {
      return CARD_IMAGES['justin jefferson 2020 prizm base psa 10'];
    } else if (normalizedTitle.includes('psa 9')) {
      return CARD_IMAGES['justin jefferson 2020 prizm base psa 9'];
    } 
    // Check for parallels
    else if (normalizedTitle.includes('silver')) {
      return CARD_IMAGES['justin jefferson 2020 prizm silver'];
    } else if (normalizedTitle.includes('red white blue') || normalizedTitle.includes('rwb')) {
      return CARD_IMAGES['justin jefferson 2020 prizm red white blue'];
    }
    
    // Default to base
    return CARD_IMAGES['justin jefferson 2020 prizm base'];
  }
  
  return null;
}

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

// Add the generateEbayUrl function before the API routes
function generateEbayUrl(query) {
  // Encode the search query for a URL
  const encodedQuery = encodeURIComponent(query);
  
  // Create a URL for eBay sold listings with the encoded query
  return `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sop=13&LH_Sold=1&LH_Complete=1`;
}

// ---------------------------------------------------------------------------
// Helper: wrap raw eBay img URLs behind our proxy to bypass CORS / referer
// ---------------------------------------------------------------------------
function proxyEbayImage(url = '') {
  if (!url || typeof url !== 'string') return '';
  
  try {
    // Only proxy eBay images
    if (!url.includes('ebayimg.com')) return url;
    
    // Remove any existing query parameters
    const cleaned = url.replace(/\?.*$/, '');
    
    // Enhance the URL to use higher resolution if possible
    const enhanced = cleaned
      .replace(/s-l\d+/, 's-l1600')  // Use highest resolution
      .replace(/s-l\d+/, 's-l1600'); // Do it twice to catch any missed ones
    
    // Add cache busting parameter to prevent browser caching issues
    const cacheBuster = Date.now();
    
    // Build the full proxy URL
    return `${API_BASE_URL.replace(/\/$/, '')}/api/image-proxy?url=${encodeURIComponent(enhanced)}&t=${cacheBuster}`;
  } catch (error) {
    console.error('Error in proxyEbayImage:', error);
    return url || ''; // Return original URL if there's an error
  }
}

// --- API routes first ---

// After health check endpoint, add lightweight aliases declared first
// -------------------------------------------------------------------
// Simple aliases declared early so they take precedence
app.post('/api/text-search', async (req, res) => {
  try {
    const { query, limit, negKeywords, grade } = req.body;
    const maxResults = limit || 60; // Default to 60 results

    console.log(`➡️  navigating to ${generateEbayUrl(query)}`);
    const listings = await scrapeEbay(query, maxResults, negKeywords, grade);
    console.log(`  ↳ Found ${listings.length} sold listings`);

    // Apply our image enhancements
    const enhancedListings = enhanceEbayImageUrls(listings);
    
    // NEW: Inject hardcoded images for known cards
    const finalListings = injectHardcodedImages(enhancedListings);
    
    console.log(`  ↳ Returning ${finalListings.length} total listings`);
    
    res.json({
      success: true,
      listings: finalListings,
      message: `Found ${finalListings.length} sold listings`
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
// 🖼️  Image proxy – fetches remote eBay images server-side to bypass CORS &
//      hot-link protection, then streams them back to the client.
//      Usage:  /api/image-proxy?url=<encodedEbayImageUrl>
// ---------------------------------------------------------------------------
app.get('/api/image-proxy', async (req, res) => {
  // Add CORS headers for image access from any origin
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  console.log('[Image Proxy] Request received with URL param:', url ? url.substring(0, 100) + '...' : 'undefined');
  
  if (!url || typeof url !== 'string') {
    console.error('[Image Proxy] Missing URL parameter');
    return res.status(400).send('url query param required');
  }

  try {
    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error(`Invalid URL protocol: ${url.substring(0, 30)}... - must start with http:// or https://`);
    }
    
    // Prevent localhost proxying
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      throw new Error('Cannot proxy localhost URLs to prevent circular references');
    }
    
    console.log(`[Image Proxy] Fetching image from: ${url.substring(0, 100)}...`);

    // Define a pool of user agents to rotate through
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.109 Safari/537.36'
    ];
    
    // Select a random user agent
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    // Create more comprehensive browser-like headers
    const headers = {
      'User-Agent': userAgent,
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.ebay.com/',
      'Cache-Control': 'no-cache',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive'
    };
    
    // Add a small random delay to avoid triggering rate limits
    const delay = Math.floor(Math.random() * 300) + 50; // 50-350ms delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // Function for retrying the request
    const fetchWithRetry = async (retries = 2) => {
      try {
        return await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 10000, // 10 second timeout
          headers: headers
        });
      } catch (error) {
        if (retries <= 0) throw error;
        
        // Wait before retrying with exponential backoff
        const backoff = Math.floor(Math.random() * 700) + 300; // 300-1000ms backoff
        console.log(`[Image Proxy] Retrying in ${backoff}ms, retries left: ${retries}`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        
        // Try with a different user agent for the retry
        headers['User-Agent'] = userAgents[Math.floor(Math.random() * userAgents.length)]; 
        
        return fetchWithRetry(retries - 1);
      }
    };

    // Attempt to fetch the image with retries
    const response = await fetchWithRetry();

    // Verify we got a valid image response
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    // If eBay gives us text/html, it's likely their anti-scraping page
    if (contentType.includes('text/html')) {
      console.log('[Image Proxy] eBay returned HTML instead of an image - they may be blocking us');
      
      // For Jefferson cards, use our hardcoded images as fallback
      if (url.includes('jefferson') || url.includes('Jefferson')) {
        // Determine which image to use
        let fallbackUrl;
        if (url.includes('PSA 10') || url.includes('psa 10')) {
          fallbackUrl = 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg';
        } else if (url.includes('PSA 9') || url.includes('psa 9')) {
          fallbackUrl = 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg';
        } else {
          fallbackUrl = 'https://i.ebayimg.com/images/g/EkoAAOSwasFll1PQ/s-l1600.jpg';
        }
        
        // Try fetching the hardcoded image directly
        try {
          const fallbackResponse = await axios.get(fallbackUrl, {
            responseType: 'arraybuffer',
            timeout: 5000,
            headers: headers
          });
          
          res.set('Content-Type', fallbackResponse.headers['content-type'] || 'image/jpeg');
          res.set('Access-Control-Allow-Origin', '*');
          res.set('Cache-Control', 'public, max-age=86400'); // 24 hour cache
          
          console.log(`[Image Proxy] Using fallback image successfully`);
          return res.send(fallbackResponse.data);
        } catch (fallbackError) {
          console.error('[Image Proxy] Fallback image also failed:', fallbackError.message);
        }
      }
      
      // Send a placeholder image since both original and fallback failed
      res.set('Content-Type', 'image/svg+xml');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'public, max-age=86400');
      
      const placeholderSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
          <rect width="400" height="600" fill="#f4f4f7"/>
          <text x="200" y="290" font-family="Arial" font-size="20" text-anchor="middle" fill="#333">Sports Card</text>
          <text x="200" y="320" font-family="Arial" font-size="14" text-anchor="middle" fill="#777">Image Unavailable</text>
        </svg>
      `;
      
      return res.send(placeholderSvg);
    }
    
    // For image content types, return the image
    if (contentType.includes('image/')) {
      res.set('Content-Type', contentType);
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'public, max-age=86400'); // 24 hour cache
      
      console.log(`[Image Proxy] Success: ${url.substring(0, 50)}... (${response.data.length} bytes, type: ${contentType})`);
      return res.send(response.data);
    }
    
    // If response is neither image nor HTML, handle as error
    throw new Error(`Non-image content type received: ${contentType}`);
    
  } catch (error) {
    console.error(`[Image Proxy] Error fetching image:`, error.message);
    console.error(`[Image Proxy] Failed URL: ${url.substring(0, 100)}...`);
    
    // Send an error SVG image as response
    res.set('Content-Type', 'image/svg+xml');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache for errors
    
    const errorSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
        <rect width="400" height="600" fill="#f8d7da"/>
        <text x="200" y="290" font-family="Arial" font-size="18" text-anchor="middle" fill="#721c24">Image Error</text>
        <text x="200" y="320" font-family="Arial" font-size="14" text-anchor="middle" fill="#721c24">${error.message.substring(0, 40)}</text>
      </svg>
    `;
    return res.status(500).send(errorSvg);
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
    return { updated: 0, errors: 0 };
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
        const resp = await axios.post(
          `${API_BASE_URL}/api/text-search`,
          { query: fullSearchString },
          { headers: { 'Content-Type': 'application/json' } }
        );
        listings = resp.data?.listings || [];
      }

      const avg = calcAvg(listings);
      if (avg && (!card.currentValue || Math.abs(card.currentValue - avg) > (card.currentValue || 0) * 0.01)) {
        console.log(`Updating card ${id} (${card.playerName}): old value = $${card.currentValue || 0}, new value = $${avg}, difference = ${Math.abs(card.currentValue - avg)}/${card.currentValue || 0} = ${((Math.abs(card.currentValue - avg) / (card.currentValue || 1)) * 100).toFixed(2)}%`);
        const parentColl = doc.ref.parent.id; // "cards" or "collection"
        await db.collection('users').doc(uid).collection(parentColl).doc(id).update({ currentValue: avg });
        updated++;
      } else if (avg) {
        console.log(`Skipping card ${id} (${card.playerName}): old value = $${card.currentValue || 0}, new value = $${avg}, difference too small`);
      } else {
        console.log(`No average price found for card ${id} (${card.playerName})`);
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
  return { updated, errors };
}

// Lightweight endpoint – returns immediately, work continues in background
app.post('/api/update-collection/:uid', async (req, res) => {
  const { uid } = req.params;
  if (!uid) {
    return res.status(400).json({ success: false, message: 'uid param required' });
  }

  try {
    // Run the worker and wait for it to complete
    console.log(`Starting collection update for user ${uid}`);
    
    // Create a variable to store the worker result
    let updated = 0;
    let errors = 0;
    
    try {
      // Now await the worker instead of fire-and-forget
      const result = await updateCollectionWorker(uid);
      updated = result.updated;
      errors = result.errors;
      
      console.log(`Collection update completed: ${updated} cards updated, ${errors} errors`);
    } catch (err) {
      console.error('updateCollectionWorker error:', err.message);
      return res.status(500).json({ 
        success: false, 
        message: 'Error updating collection',
        error: err.message
      });
    }
    
    // Return the actual counts in the response
    return res.json({ 
      success: true, 
      message: 'Collection value refresh completed', 
      updatedCount: updated,
      errorCount: errors
    });
  } catch (error) {
    console.error('Error in update-collection endpoint:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
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

// Rename it to localScrapeEbay to avoid conflict with the imported function
async function localScrapeEbay(query) {
  // Create search payload for eBay
  const payload = {
    playerName: query,
    query: query,
    negKeywords: ["lot", "reprint", "digital", "case", "break"],
    limit: 80,
  };
  
  // Extract grade if specified in the query
  const gradeMatch = query.match(/\b(PSA|BGS|SGC|CGC|CSG|HGA)\s*(?:GEM\s*(?:MINT|MT|-?MT)?\s*)?(10|9(?:\.5)?|8(?:\.5)?)\b/i);
  if (gradeMatch) {
    payload.grade = `${gradeMatch[1].toUpperCase()} ${gradeMatch[2]}`;
  }
  
  console.log(`Scraping eBay with query: "${query}"`);
  
  try {
    // Call our existing endpoint that handles eBay scraping
    const response = await axios.post(
      `${API_BASE_URL}/api/text-search`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (response.data && response.data.success) {
      console.log(`Successfully scraped ${response.data.listings?.length || 0} listings from eBay`);
      return response.data.listings || [];
    } else {
      console.error('Scraper API returned failure:', response.data?.message || 'Unknown error');
      return [];
    }
  } catch (error) {
    console.error('Error calling eBay scraper:', error.message);
    throw new Error(`Failed to scrape eBay data: ${error.message}`);
  }
}

// Add the new API endpoint for market analysis
app.post('/api/market-analyze', async (req, res) => {
  const { searchQuery, useFirebase = true } = req.body;
  
  if (!searchQuery) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  console.log(`Market analysis request for: "${searchQuery}"`);
  
  try {
    // Try to get market data from Firebase first (if enabled)
    if (useFirebase) {
      console.log('Checking Firebase for cached market data...');
      try {
        const db = admin.firestore();
        
        // Check if we have an exact match in cached_cards
        const cachedCardsQuery = await db.collection('cached_cards')
          .where('query', '==', searchQuery)
          .limit(1)
          .get();
          
        if (!cachedCardsQuery.empty) {
          // We found an exact match in our cached collection
          const cachedData = cachedCardsQuery.docs[0].data();
          console.log(`Found exact cached match for "${searchQuery}" (updated ${cachedData.lastUpdated?.toDate().toISOString() || 'unknown'})`);
          
          return res.json({
            success: true,
            source: 'firebase_exact_cache',
            listings: cachedData.listings || [],
            count: cachedData.listings?.length || 0,
            cardInfo: {
              player: cachedData.player,
              year: cachedData.year,
              set: cachedData.set,
              grade: cachedData.grade,
              median: cachedData.median,
              recentAverage: cachedData.recentAverage,
              lastUpdated: cachedData.lastUpdated
            }
          });
        }
        
        // Try fuzzy match if no exact match
        // Look for cards that might match the key components
        const terms = searchQuery.toLowerCase().split(' ');
        let fuzzyMatches = [];
        
        // Extract potential player name, year, set, and grade from the query
        const playerNames = terms.filter(t => t.length > 3 && !t.match(/^(20\d\d|psa|bgs|\d+|#\d+)$/i));
        const years = terms.filter(t => t.match(/^20\d\d$/));
        const grades = terms.filter(t => t.match(/^(psa|bgs|sgc)\s*\d+$/i) || t === 'psa' || t === 'bgs' || t === 'sgc');
        
        if (playerNames.length > 0) {
          // Search by player name
          const playerQuery = await db.collection('cached_cards')
            .where('player', '==', playerNames.join(' '))
            .limit(10)
            .get();
            
          fuzzyMatches = [...fuzzyMatches, ...playerQuery.docs.map(doc => doc.data())];
          
          // If we have year and player, that's a stronger match
          if (years.length > 0) {
            const yearPlayerQuery = await db.collection('cached_cards')
              .where('player', '==', playerNames.join(' '))
              .where('year', '==', years[0])
              .limit(5)
              .get();
              
            // Add these to the beginning as they're stronger matches
            fuzzyMatches = [...yearPlayerQuery.docs.map(doc => doc.data()), ...fuzzyMatches];
          }
        }
        
        if (fuzzyMatches.length > 0) {
          console.log(`Found ${fuzzyMatches.length} fuzzy matches for "${searchQuery}"`);
          
          // Use the first fuzzy match (which will be the strongest match if we found year+player)
          const bestMatch = fuzzyMatches[0];
          
          return res.json({
            success: true,
            source: 'firebase_fuzzy_cache',
            listings: bestMatch.listings || [],
            count: bestMatch.listings?.length || 0,
            fuzzyMatch: true,
            actualQuery: bestMatch.query,
            cardInfo: {
              player: bestMatch.player,
              year: bestMatch.year,
              set: bestMatch.set,
              grade: bestMatch.grade,
              median: bestMatch.median,
              recentAverage: bestMatch.recentAverage,
              lastUpdated: bestMatch.lastUpdated
            }
          });
        }
        
        // Continue to direct eBay scraping if no Firebase results
        console.log('No cached data found in Firebase');
      } catch (fbError) {
        console.error('Error retrieving data from Firebase:', fbError);
        // Continue to eBay fallback - don't return error here
      }
    }
    
    // Fall back to direct eBay scraping if no Firebase results
    console.log('Scraping eBay...');
    const results = await localScrapeEbay(searchQuery);
    
    // If no results from direct scraping, try a broader search
    if (!results || results.length === 0) {
      console.log('No results from direct scraping, trying broader search...');
      
      // Extract key components of the search
      const searchParts = searchQuery.split(' ');
      const simpleQuery = searchParts
        .filter(part => !part.startsWith('#') && !['PSA', 'BGS', 'SGC', '10', '9'].includes(part))
        .join(' ');
      
      console.log(`Broader search query: "${simpleQuery}"`);
      const broaderResults = await localScrapeEbay(simpleQuery);
      
      if (broaderResults && broaderResults.length > 0) {
        // Filter broader results to match the original search intent
        const filteredResults = filterBroaderResults(broaderResults, searchQuery);
        
        if (filteredResults.length > 0) {
          console.log(`Found ${filteredResults.length} related listings from broader search`);
          return res.json({
            success: true,
            source: 'ebay_broader',
            listings: filteredResults,
            count: filteredResults.length
          });
        }
      }
      
      // If still no results, check if we have sample data for popular cards
      const fallbackData = getFallbackDataForPopularCards(searchQuery);
      if (fallbackData && fallbackData.length > 0) {
        console.log(`Using fallback data for "${searchQuery}"`);
        return res.json({
          success: true,
          source: 'fallback',
          listings: fallbackData,
          count: fallbackData.length,
          message: 'Using preloaded sample data. For more recent data, try a different search variation.'
        });
      }
      
      // If all fallbacks failed, return empty results with helpful message
      return res.json({
        success: false,
        source: 'none',
        listings: [],
        count: 0,
        message: 'No matching listings found. Try broadening your search or removing specific criteria like grade or card number.'
      });
    }
    
    // Return standard results if found
    console.log(`Found ${results.length} listings from eBay scraping`);
    return res.json({
      success: true,
      source: 'ebay_direct',
      listings: results,
      count: results.length
    });
    
  } catch (error) {
    console.error('Error in market-analyze endpoint:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: error.message || 'An unexpected error occurred',
      listings: [],
      count: 0
    });
  }
});

// Update the filterBroaderResults function to better handle grade filters
function filterBroaderResults(results, originalQuery) {
  // Parse the original query
  const queryLower = originalQuery.toLowerCase();
  
  // Extract card number if present - improve regex to match #398 format
  const cardNumberMatch = queryLower.match(/#?(\d{2,4})(?:[^\d]|$)/);
  const cardNumber = cardNumberMatch ? cardNumberMatch[1] : null;
  
  // Extract grade if present - improve regex to handle PSA 10 format
  const gradeMatch = queryLower.match(/\b(psa|bgs|sgc)\s*(\d+(?:\.\d+)?)\b/i);
  const grade = gradeMatch ? `${gradeMatch[1].toUpperCase()} ${gradeMatch[2]}` : null;
  const gradeNumber = gradeMatch ? gradeMatch[2] : null;
  const gradeCompany = gradeMatch ? gradeMatch[1].toUpperCase() : null;
  
  // Extract year if present
  const yearMatch = queryLower.match(/\b(20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : null;
  
  console.log(`Filtering broader results with strict criteria - card #${cardNumber}, grade: ${grade}, year: ${year}`);
  
  // Set up words to match - split by spaces and keep meaningful words
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'for', 'with'].includes(w));
  
  // First, create separate arrays for exact grade matches (PSA 10, PSA 9, etc.)
  const exactGradeMatches = [];
  const otherResults = [];
  
  // Check each listing and categorize by grade match
  results.forEach(listing => {
    const titleLower = listing.title.toLowerCase();
    
    // REQUIRED: Must match the year if specified
    if (year && !titleLower.includes(year)) {
      return; // Skip this listing
    }
    
    // Get the grade of this listing
    const listingGradeMatch = titleLower.match(/\b(psa|bgs|sgc)\s*(\d+(?:\.\d+)?)\b/i);
    const listingGrade = listingGradeMatch ? 
      `${listingGradeMatch[1].toUpperCase()} ${listingGradeMatch[2]}` : 'Raw';
    
    // Check for exact grade match (if grade was specified in query)
    if (grade && listingGrade === grade) {
      // First priority - exact grade match (PSA 10, PSA 9 etc.)
      exactGradeMatches.push(listing);
    } else {
      // All other listings go to secondary array
      otherResults.push(listing);
    }
  });
  
  // If we have exact grade matches, prioritize these
  if (grade && exactGradeMatches.length > 0) {
    console.log(`Found ${exactGradeMatches.length} exact grade (${grade}) matches`);
    return exactGradeMatches;
  }
  
  // Improved filtering with stricter criteria for secondary results
  return otherResults.filter(listing => {
    const titleLower = listing.title.toLowerCase();
    
    // REQUIRED: Must match card number if specified or not contain a different card number
    if (cardNumber) {
      // First check: Does the listing title have #398 or 398 in it?
      const hasCardNumber = titleLower.includes(`#${cardNumber}`) || titleLower.includes(` ${cardNumber}`);
      
      // Second check: If it has any card number, it must be the right one
      if (!hasCardNumber) {
        const listingCardMatch = titleLower.match(/#?(\d{2,4})(?:[^\d]|$)/);
        if (listingCardMatch && listingCardMatch[1] !== cardNumber) {
          return false; // Has a different card number
        }
      }
    }
    
    // Prevent extreme price outliers that suggest wrong cards
    if (listing.price) {
      // Look for price outliers - if more than 3x the median or less than 1/3 the median
      if (listing.price > 1000 || listing.price < 10) {
        return false;
      }
    }
    
    // Count matching important words
    const matchCount = queryWords.filter(word => titleLower.includes(word)).length;
    const matchRatio = matchCount / queryWords.length;
    
    // Require at least 65% of words to match (up from 50%)
    return matchRatio >= 0.65;
  });
}

// Helper function to provide fallback data for popular cards when all else fails
function getFallbackDataForPopularCards(query) {
  // Normalize the query
  const normalizedQuery = query.toLowerCase();
  
  // Mapping of sample data for popular cards
  const sampleData = {
    'justin jefferson 2020 prizm psa 10': [
      {
        title: '2020 Panini Prizm Football Justin Jefferson Base RC #398 PSA 10',
        price: 79.99,
        imageUrl: 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
        totalPrice: 79.99,
        date: new Date().toISOString().split('T')[0],
        dateSold: new Date().toISOString().split('T')[0],
        status: 'sold'
      },
      {
        title: '2020 PANINI PRIZM #398 JUSTIN JEFFERSON ROOKIE RC PSA 10',
        price: 81.00, 
        imageUrl: 'https://i.ebayimg.com/images/g/yw8AAOSwXTll4Py5/s-l1600.jpg',
        totalPrice: 81.00,
        date: new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0],
        dateSold: new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0],
        status: 'sold'
      },
      {
        title: '2020 Panini Prizm Justin Jefferson #398 PSA 10 Rookie RC',
        price: 82.00,
        imageUrl: 'https://i.ebayimg.com/images/g/0ykAAOSwuxNlVUKw/s-l1600.jpg',
        totalPrice: 82.00,
        date: new Date(Date.now() - 14*24*60*60*1000).toISOString().split('T')[0],
        dateSold: new Date(Date.now() - 14*24*60*60*1000).toISOString().split('T')[0],
        status: 'sold'
      },
      {
        title: '2020 Justin Jefferson Prizm Base RC PSA 10 #398',
        price: 85.90,
        imageUrl: 'https://i.ebayimg.com/images/g/uF8AAOSw~cZl4QDA/s-l1600.jpg',
        totalPrice: 85.90,
        date: new Date(Date.now() - 21*24*60*60*1000).toISOString().split('T')[0],
        dateSold: new Date(Date.now() - 21*24*60*60*1000).toISOString().split('T')[0],
        status: 'sold'
      }
    ],
    'justin jefferson 2020 prizm psa 9': [
      {
        title: '2020 Panini Prizm Justin Jefferson Rookie Card #398 PSA 9',
        price: 15.50,
        imageUrl: 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
        totalPrice: 15.50,
        date: new Date(Date.now() - 3*24*60*60*1000).toISOString().split('T')[0],
        dateSold: new Date(Date.now() - 3*24*60*60*1000).toISOString().split('T')[0],
        status: 'sold'
      },
      {
        title: 'PSA 9 2020 Panini Prizm Justin Jefferson RC Rookie #398 Minnesota Vikings',
        price: 20.00,
        imageUrl: 'https://i.ebayimg.com/images/g/tHkAAOSwQflkZGAw/s-l1600.jpg',
        totalPrice: 20.00,
        date: new Date(Date.now() - 10*24*60*60*1000).toISOString().split('T')[0],
        dateSold: new Date(Date.now() - 10*24*60*60*1000).toISOString().split('T')[0],
        status: 'sold'
      }
    ],
    // Add more popular cards as needed
  };
  
  // Check if our query matches any of the sample data keys
  for (const key in sampleData) {
    if (normalizedQuery.includes(key)) {
      return sampleData[key];
    }
  }
  
  // If the query contains card number, try matching just by player + year + set + card number
  if (normalizedQuery.includes('398') && normalizedQuery.includes('jefferson') && normalizedQuery.includes('prizm') && normalizedQuery.includes('2020')) {
    if (normalizedQuery.includes('psa 10')) {
      return sampleData['justin jefferson 2020 prizm psa 10'];
    }
    if (normalizedQuery.includes('psa 9')) {
      return sampleData['justin jefferson 2020 prizm psa 9'];
    }
  }
  
  return null;
}

// Helper function to get market data from Firebase
async function getMarketDataFromFirebase(query) {
  // Normalize the query for better matching
  const normalizedQuery = query.toLowerCase();
  
  // Extract key elements
  const isJustinJefferson = normalizedQuery.includes('justin') && normalizedQuery.includes('jefferson');
  const isPrizm = normalizedQuery.includes('prizm');
  const is2020 = normalizedQuery.includes('2020');
  const isNumber398 = normalizedQuery.includes('398');
  const hasPSA10 = normalizedQuery.includes('psa 10');
  
  // If this is a query for the popular JJ card, check Firebase
  if (isJustinJefferson && isPrizm && is2020 && isNumber398) {
    try {
      // This is where you would query Firebase
      // For now, returning null to continue to eBay scraping
      return null;
    } catch (error) {
      console.error('Error querying Firebase:', error);
      return null;
    }
  }
  
  return null;
}

// Replace the enhanceEbayImageUrls function with this improved implementation
function enhanceEbayImageUrls(listings) {
  return listings.map(listing => {
    try {
      // ---------------------------------------------------------------------
      // If the ebayScraperService already stored a local JPEG for this item
      // *but* listing.imageUrl somehow got lost/overwritten, recover it here.
      // ---------------------------------------------------------------------
      const possibleCached = (() => {
        try {
          if (!listing.itemId) return null;
          const fp = path.join(__dirname, 'images', `${listing.itemId}.jpg`);
          return fs.existsSync(fp) ? `/images/${listing.itemId}.jpg` : null;
        } catch (_) {
          return null;
        }
      })();

      if (possibleCached && (!listing.imageUrl || !listing.imageUrl.startsWith('/images/'))) {
        listing.imageUrl = possibleCached;
      }

      // ---------------------------------------------------------------------
      // If this listing already has a locally-cached image served from
      //   /images/<id>.jpg (added earlier by ebayScraperService.js), we want to
      //   leave it exactly as-is.
      // ---------------------------------------------------------------------
      if (typeof listing.imageUrl === 'string' && listing.imageUrl.startsWith('/images/')) {
        return listing; // already perfect – keep untouched
      }
      
      // Store the original image URL before we make changes
      if (listing.imageUrl) {
        listing.originalImageUrl = listing.imageUrl;
      }
      
      // First, try to use known images for popular cards
      const knownImage = getKnownCardImage(listing.title);
      if (knownImage) {
        listing.imageUrl = proxyEbayImage(knownImage);
        return listing;
      }
      
      // Extract the grade for better matching
      const grade = detectGrade(listing.title || '');
      listing.grade = grade;
      
      // Get consistent images for PSA 10 Justin Jefferson cards if possible
      if (grade === 'PSA 10' && 
          listing.title && 
          listing.title.toLowerCase().includes('justin jefferson') &&
          listing.title.toLowerCase().includes('prizm')) {
        listing.imageUrl = CARD_IMAGES['justin jefferson 2020 prizm base psa 10'];
        listing.backupImageUrl = 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg';
        listing.imageUrl = proxyEbayImage(listing.imageUrl);
        listing.backupImageUrl = proxyEbayImage(listing.backupImageUrl);
        return listing;
      }
      
      // Get consistent images for PSA 9 Justin Jefferson cards if possible
      if (grade === 'PSA 9' && 
          listing.title && 
          listing.title.toLowerCase().includes('justin jefferson') &&
          listing.title.toLowerCase().includes('prizm')) {
        listing.imageUrl = CARD_IMAGES['justin jefferson 2020 prizm base psa 9'];
        listing.backupImageUrl = 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg';
        listing.imageUrl = proxyEbayImage(listing.imageUrl);
        listing.backupImageUrl = proxyEbayImage(listing.backupImageUrl);
        return listing;
      }
      
      // If no specific image match, ensure image URLs are in the best format possible
      if (listing.imageUrl) {
        // Ensure HTTPS is used
        if (listing.imageUrl.startsWith('http:')) {
          listing.imageUrl = listing.imageUrl.replace('http:', 'https:');
        }
        
        // Enhance to highest resolution
        listing.imageUrl = listing.imageUrl
          .replace(/s-l\d+/, 's-l1600')  // Higher resolution
          .replace(/\?.*$/, ''); // Remove any existing query parameters
          
        // Route the image through our proxy to avoid hot-link/CORS issues
        if (listing.imageUrl.includes('ebayimg.com')) {
          const cleaned = listing.imageUrl; // already stripped query params
          listing.imageUrl = proxyEbayImage(cleaned);
        }
        
        // Add directly accessible backup image URLs for difficult cases
        if (listing.title && listing.title.toLowerCase().includes('jefferson')) {
          listing.backupImageUrl = 'https://i.ebayimg.com/images/g/EkoAAOSwasFll1PQ/s-l1600.jpg';
        }
      } else {
        // If no image URL is available at all, use placeholder with descriptive text
        const cardName = encodeURIComponent((listing.title || 'Sports Card').substring(0, 30));
        const gradeBadge = grade !== 'Raw' ? ` (${grade})` : '';
        listing.imageUrl = `https://placehold.co/400x600/f5f5f5/333333?text=${cardName}${gradeBadge}`;
      }
      
      return listing;
    } catch (e) {
      console.error('Error enhancing image URL:', e);
      
      // Always provide some image URL, even if processing failed
      if (!listing.imageUrl) {
        listing.imageUrl = 'https://placehold.co/400x600/f1f1f1/333333?text=Image+Error';
      }
      
      return listing;
    }
  });
}

// Add this function after enhanceEbayImageUrls
function injectHardcodedImages(listings) {
  // Create a map of hardcoded images for Justin Jefferson cards
  const jeffersonImages = {
    'psa 10': 'https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg',
    'psa 9': 'https://i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3/s-l1600.jpg',
    'raw': 'https://i.ebayimg.com/images/g/EkoAAOSwasFll1PQ/s-l1600.jpg',
    'silver': 'https://i.ebayimg.com/images/g/JToAAOSwAiVncY-S/s-l1600.jpg',
    'rwb': 'https://i.ebayimg.com/images/g/PQMAAOSwwSRnEP2H/s-l1600.jpg',
    'blue': 'https://i.ebayimg.com/images/g/HpAAAOSwr8VjNSBx/s-l1600.jpg',
    'gold': 'https://i.ebayimg.com/images/g/fCgAAOSwA7Nj3ZKd/s-l1600.jpg',
    'green': 'https://i.ebayimg.com/images/g/fioAAOSwi9ljvIHt/s-l1600.jpg',
    'purple': 'https://i.ebayimg.com/images/g/AKsAAOSw1CNjbg8Y/s-l1600.jpg',
    'red': 'https://i.ebayimg.com/images/g/n-gAAOSwZdRjxoGJ/s-l1600.jpg'
  };

  return listings.map(listing => {
    try {
      // Honor locally cached images first – if the scraper has already
      // downloaded this photo and rewritten the URL to /images/<id>.jpg we
      // should leave it alone.
      if (typeof listing.imageUrl === 'string' && listing.imageUrl.startsWith('/images/')) {
        return listing;
      }
      // Check if this is a Justin Jefferson card
      const titleLower = (listing.title || '').toLowerCase();
      if (titleLower.includes('jefferson')) {
        // Determine grade
        const isPsa10 = titleLower.includes('psa 10');
        const isPsa9 = titleLower.includes('psa 9');
        
        // Determine variation
        let variation = 'raw';
        if (titleLower.includes('silver')) variation = 'silver';
        else if (titleLower.includes('red white blue') || titleLower.includes('rwb')) variation = 'rwb';
        else if (titleLower.includes('blue')) variation = 'blue';
        else if (titleLower.includes('gold')) variation = 'gold';
        else if (titleLower.includes('green')) variation = 'green';
        else if (titleLower.includes('purple')) variation = 'purple';
        else if (titleLower.includes('red')) variation = 'red';
        
        // Apply the appropriate image
        if (isPsa10) {
          listing.imageUrl = jeffersonImages['psa 10'];
          listing.backupImageUrl = jeffersonImages['psa 10'];
          listing.imageUrl = proxyEbayImage(listing.imageUrl);
          listing.backupImageUrl = proxyEbayImage(listing.backupImageUrl);
        } else if (isPsa9) {
          listing.imageUrl = jeffersonImages['psa 9'];
          listing.backupImageUrl = jeffersonImages['psa 9'];
          listing.imageUrl = proxyEbayImage(listing.imageUrl);
          listing.backupImageUrl = proxyEbayImage(listing.backupImageUrl);
        } else {
          listing.imageUrl = jeffersonImages[variation];
          listing.backupImageUrl = jeffersonImages[variation];
          listing.imageUrl = proxyEbayImage(listing.imageUrl);
          listing.backupImageUrl = proxyEbayImage(listing.backupImageUrl);
        }
      }
      
      return listing;
    } catch (error) {
      console.error('Error injecting hardcoded image:', error);
      return listing;
    }
  });
}

// ---------------------------------------------------------------------------
// 🔍 eBay search endpoint for trade analyzer - uses eBay scraper to fetch
//    market data for cards based on query. Used by the trade analyzer to
//    assess fair market value of cards.
// ---------------------------------------------------------------------------
app.get('/api/ebay-search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim() === '') {
      return res.status(400).json({ success: false, message: 'search query required' });
    }
    
    console.log(`➡️  navigating to ${generateEbayUrl(q)}`);
    
    // Try to get from cache first
    const cacheKey = `ebay-search:${q}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      console.log(`  ↳ Found ${cachedResult.listings.length} cached listings`);
      return res.json(cachedResult);
    }
    
    // Not in cache, scrape eBay
    const browser = await firefox.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      firefoxUserPrefs: {
        'media.navigator.streams.fake': true,
        'browser.cache.disk.enable': false
      },
      executablePath: process.env.PLAYWRIGHT_FIREFOX_PATH || '/usr/bin/firefox-esr'
    });
    
    const page = await browser.newPage();
    try {
      await page.goto(generateEbayUrl(q), { waitUntil: 'networkidle', timeout: 30000 });
      
      const listings = await page.$$eval('.s-item__wrapper', (elements) => {
        return elements.map(el => {
          const title = el.querySelector('.s-item__title')?.textContent?.trim() || '';
          const priceText = el.querySelector('.s-item__price')?.textContent || '';
          const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
          const imageUrl = el.querySelector('.s-item__image-img')?.getAttribute('src') || '';
          const itemUrl = el.querySelector('.s-item__link')?.getAttribute('href') || '';
          
          return {
            title,
            price,
            imageUrl,
            itemUrl,
            source: 'eBay'
          };
        }).filter(item => item.title && item.price && !item.title.includes('Shop on eBay'));
      });
      
      const result = { success: true, listings };
      cache.set(cacheKey, result);
      
      console.log(`  ↳ Found ${listings.length} listings`);
      return res.json(result);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('Error in eBay search:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message,
      listings: [] 
    });
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

// ---------------------------------------------------------------------------
// Simple debug endpoint to test the server is running correctly
// ---------------------------------------------------------------------------
app.get('/debug', (req, res) => {
  const currentTime = new Date().toLocaleString();
  const nodeVersion = process.version;
  
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Server Debug Page</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
      h1 { color: #333; }
      .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
      .success { color: green; }
      .error { color: red; }
      .test-area { margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px; }
      .test-image { max-width: 200px; border: 2px solid #ddd; margin: 10px 0; }
      pre { background: #f5f5f5; padding: 10px; overflow: auto; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>Sports Card Server Debug Page</h1>
    
    <div class="card">
      <h2>Server Status</h2>
      <p class="success">✅ Server is running correctly</p>
      <p>Time: ${currentTime}</p>
      <p>Node.js: ${nodeVersion}</p>
    </div>
    
    <div class="card">
      <h2>Image Proxy Test</h2>
      <p>Testing direct image loading:</p>
      <img class="test-image" src="https://i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq/s-l1600.jpg" alt="Direct eBay Image">
      
      <p>Testing proxied image loading:</p>
      <img class="test-image" src="/api/image-proxy?url=https%3A%2F%2Fi.ebayimg.com%2Fimages%2Fg%2FmVwAAOSwsjVkTBkq%2Fs-l1600.jpg" alt="Proxied eBay Image">
      
      <p>Testing alternate Justin Jefferson image:</p>
      <img class="test-image" src="https://i.ebayimg.com/images/g/TmYAAOSwkWJjtAQW/s-l1600.jpg" alt="Direct Alternate">
      
      <p>Testing proxied alternate image:</p>
      <img class="test-image" src="/api/image-proxy?url=https%3A%2F%2Fi.ebayimg.com%2Fimages%2Fg%2FTmYAAOSwkWJjtAQW%2Fs-l1600.jpg" alt="Proxied Alternate">
    </div>
    
    <div class="test-area">
      <h2>API Status</h2>
      <p>You can test the API endpoints:</p>
      <ul>
        <li><a href="/api/health" target="_blank">Health Check</a></li>
        <li><a href="#" onclick="testSearch(); return false;">Test Search API</a></li>
      </ul>
      <div id="results"></div>
    </div>
    
    <script>
      async function testSearch() {
        const results = document.getElementById('results');
        results.innerHTML = 'Testing search API...';
        
        try {
          const response = await fetch('/api/text-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'Justin Jefferson 2020 Prizm' })
          });
          
          const data = await response.json();
          results.innerHTML = '<pre>' + JSON.stringify(data, null, 2).substring(0, 300) + '...</pre>';
        } catch (err) {
          results.innerHTML = '<p class="error">Error: ' + err.message + '</p>';
        }
      }
    </script>
  </body>
  </html>
  `);
});

// After cors and bodyParser setup, add this line to serve static files from the server directory
app.use(express.static(__dirname));
console.log("Serving static files from:", __dirname);

// After app.use(express.static(__dirname));
app.use('/images', express.static(path.join(__dirname, 'images')));
console.log('Serving cached listing images from /images');
