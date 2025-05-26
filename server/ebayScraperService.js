// ebayScraperService.js
// Node.js/Express microservice for eBay scraping, variation grouping, and grade handling.

import dotenv from 'dotenv'; dotenv.config();
import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import NodeCache from 'node-cache';
import { firefox } from 'playwright';
import { fetchEbayImages } from './ebayImageScraper.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cors from 'cors';
import cheerio from 'cheerio';

const app = express();
const cache = new NodeCache({ stdTTL: 600 }); // 10 min cache

// Multer setup for image uploads
const tmpUpload = multer({ dest: 'uploads/' });

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowedPatterns = [
      /^https?:\/\/localhost(:\d+)?$/,
      /netlify\.app$/,
      /sportscardanalyzer\.com$/
    ];
    if (allowedPatterns.some(re => re.test(origin))) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked for origin ${origin}`));
  },
  credentials: true
}));

app.use(express.json());

// ---------------------------------------------------------------------------
// Local image cache directory – we download each listing's main image once
//  and then serve it from /images/<itemId>.jpg so the front-end never has to
//  talk to eBay. This bypasses hot-link blocking and guarantees availability.
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  console.log('[ebayScraper] Created local image cache dir', IMAGES_DIR);
}

// Helper: download + save a remote image if we don't already have a cached copy
async function cacheImage(localPath, remoteUrl) {
  if (fs.existsSync(localPath)) return true; // already cached
  try {
    const resp = await axios.get(remoteUrl, { responseType: 'arraybuffer', timeout: 15000, headers: {
      'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0 Safari/537.36',
      'Accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
    }});
    fs.writeFileSync(localPath, resp.data);
    return true;
  } catch(err) {
    console.warn('cacheImage: failed', remoteUrl.substring(0,120), err.message);
    return false;
  }
}

// Utility: normalize title by removing grade and special chars
function normalizeTitle(title) {
  return title
    .replace(/\b(PSA|BGS|SGC)\s*\d+\b/gi, '')
    .replace(/[^a-zA-Z0-9 ]+/g, '')
    .trim();
}

// Utility: extract grade (PSA/BGS/SGC) or mark as Raw
function extractGrade(title) {
  if (!title) return 'Raw';
  const standard = title.match(/\b(PSA|BGS|SGC|CGC|CSG|HGA)\s*(?:GEM\s*(?:MINT|MT|-?MT)?\s*)?(10|9(?:\.5)?|8(?:\.5)?)\b/i);
  if (standard) return `${standard[1].toUpperCase()} ${standard[2]}`;
  const noSpace = title.match(/\b(PSA|BGS|SGC|CGC|CSG|HGA)(10|9(?:\.5)?|8(?:\.5)?)\b/i);
  if (noSpace) return `${noSpace[1].toUpperCase()} ${noSpace[2]}`;
  if (/RAW|UN ?GRADED/i.test(title)) return 'Raw';
  return 'Raw';
}

// Group items into variations
function groupVariations(items) {
  const map = {};
  items.forEach(item => {
    const variation = normalizeTitle(item.title);
    item.grade = extractGrade(item.title);
    if (!map[variation]) {
      map[variation] = { variation, image: item.imageUrl, items: [] };
    }
    map[variation].items.push(item);
  });
  return Object.values(map);
}

// --------------------------------------------------
// Helper: fetch og:image from a listing page once
// --------------------------------------------------
async function fetchOgImage(browser, itemUrl) {
  if (!itemUrl) return '';
  const cacheKey = `og:${itemUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let og = '';
  const p = await browser.newPage();
  try {
    await p.goto(itemUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Try og:image first (fastest, if present)
    og = await p.$eval('meta[property="og:image"]', el => el.getAttribute('content')).catch(() => '');

    // ------------------------------------------------------------------
    // Fallback: many modern eBay pages omit the og:image tag or replace it
    // with a 1×1 placeholder.  In those cases, the main listing photo is
    // still available in the <img id="icImg"> element once the DOM has
    // loaded.  Grabbing its src gives us a full-size JPEG that we can cache.
    // ------------------------------------------------------------------
    if (!og) {
      try {
        // Wait briefly for the hero image to render; bail quickly on timeout
        await p.waitForSelector('#icImg', { timeout: 8000 });
        og = await p.$eval('#icImg', el => el.getAttribute('src'));
      } catch (_) {
        /* ignore – image may not be present */
      }
    }
  } catch (_) {
    /* ignore */
  } finally {
    await p.close();
  }

  if (og) cache.set(cacheKey, og);
  return og || '';
}

async function launchBrowser() {
  try {
    console.log('Launching Firefox browser...');
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
    console.log('Browser launched successfully');
    return browser;
  } catch (err) {
    console.error('Failed to launch browser:', err);
    throw err;
  }
}

// Scrape eBay with Firefox
async function scrapeEbay(query, limit = 60) {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=13&LH_Sold=1&LH_Complete=1`;
  console.log(`Scraping eBay for: ${query}`);

  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    console.log('Navigating to search URL...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('Extracting listings...');
    const items = await page.$$eval('.s-item__wrapper', (elements, maxItems) => {
      const results = [];
      
      for (const el of elements) {
        if (results.length >= maxItems) break;

        const title = el.querySelector('.s-item__title')?.textContent?.replace('New Listing', '').trim();
        const priceText = el.querySelector('.s-item__price')?.textContent;
        const price = parseFloat(priceText?.replace(/[^0-9.]/g, '') || '0');
        
        const imageUrl = el.querySelector('.s-item__image-img')?.getAttribute('src');
        const itemUrl = el.querySelector('.s-item__link')?.getAttribute('href');
        
        // Extract date
        const dateText = el.querySelector('.s-item__endedDate')?.textContent;
        const date = dateText ? new Date(dateText.replace('Sold ', '')).toISOString() : new Date().toISOString();

        // Extract shipping
        const shippingText = el.querySelector('.s-item__shipping')?.textContent;
        let shipping = 0;
        if (shippingText && !shippingText.toLowerCase().includes('free')) {
          const match = shippingText.match(/(\d+\.\d{2})/);
          if (match) shipping = parseFloat(match[1]);
        }

        if (title && price && !title.includes('Shop on eBay')) {
          results.push({
            title,
            price,
            shipping,
            totalPrice: price + shipping,
            imageUrl,
            itemHref: itemUrl,
            dateSold: date,
            date: new Date().toISOString(),
            status: 'sold'
          });
        }
      }
      return results;
    }, limit);

    console.log(`Found ${items.length} items`);
    return items;
  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// API Routes
app.post('/api/text-search', async (req, res) => {
  const { query, limit = 60 } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const cacheKey = `search:${query}:${limit}`;
    if (cache.has(cacheKey)) {
      return res.json({ 
        success: true, 
        listings: cache.get(cacheKey),
        cached: true
      });
    }

    const listings = await scrapeEbay(query, limit);
    cache.set(cacheKey, listings);
    
    res.json({ 
      success: true, 
      listings,
      cached: false
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message,
      listings: []
    });
  }
});

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server running on port ${port}`));

export { scrapeEbay }; 