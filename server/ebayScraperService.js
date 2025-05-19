// ebayScraperService.js
// Node.js/Express microservice for eBay scraping, variation grouping, and grade handling.

import dotenv from 'dotenv'; dotenv.config();
import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import NodeCache from 'node-cache';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const app = express();
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10min caching

// Multer setup for image uploads
const tmpUpload = multer({ dest: 'uploads/' });

app.use(express.json());

// Utility: normalize title by removing grade and special chars
function normalizeTitle(title) {
  return title
    .replace(/\b(PSA|BGS|SGC)\s*\d+\b/gi, '')
    .replace(/[^a-zA-Z0-9 ]+/g, '')
    .trim();
}

// Utility: extract grade (PSA/BGS/SGC) or mark as Raw
function extractGrade(title) {
  const m = title.match(/\b(PSA|BGS|SGC)\s*(\d+)\b/i);
  return m ? `${m[1].toUpperCase()} ${m[2]}` : 'Raw';
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
    og = await p.$eval('meta[property="og:image"]', el => el.getAttribute('content'));
  } catch (_) {
    /* ignore */
  } finally {
    await p.close();
  }

  if (og) cache.set(cacheKey, og);
  return og || '';
}

// Core: scrape by text query
async function scrapeEbay(query, limit = 20) {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)...');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

  // Scroll down to trigger lazy-loaded thumbnails
  await page.evaluate(async () => {
    await new Promise(res => {
      let total = 0;
      const step = 600;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total > 2400) { // ~4 screens
          clearInterval(timer);
          res();
        }
      }, 200);
    });
  });

  // give images a moment to populate data-src
  await page.waitForTimeout(1200);

  let raw = await page.$$eval(
    '.s-item',
    (els, lim) => els.slice(0, lim).map(el => {
      const title = el.querySelector('.s-item__title')?.innerText;
      const priceText = el.querySelector('.s-item__price')?.innerText || '';
      const price = parseFloat(priceText.replace(/[^0-9\.]/g, '')) || null;
      // eBay lazy-loads: sometimes the real URL is in data-src; fall back to src
      const imgEl = el.querySelector('img.s-item__image-img');
      let image = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';
      if (image && image.startsWith('//')) image = 'https:' + image; // protocol-relative → https
      if (image.includes('trans_1x1') || image.endsWith('.gif')) image = imgEl?.getAttribute('data-src') || '';
      const href = el.querySelector('.s-item__link')?.href;
      const idMatch = href?.match(/\/(\d+)(?:\?|$)/);
      return { itemId: idMatch?.[1] || null, title, price, imageUrl: image, itemHref: href };
    }),
    limit
  );
  raw = await ensureImages(raw, browser);
  raw = raw.filter(itm => {
    if (!itm.title) return false;
    if (/SHOP ON EBAY/i.test(itm.title)) return false;
    if (!itm.imageUrl || itm.imageUrl.trim() === '') return false;
    return true;
  });
  await browser.close();
  return raw;
}

// Patch missing images by visiting listing pages (slow-path only for blanks)
async function ensureImages(items, browser) {
  for (const itm of items) {
    if (!itm.imageUrl || /trans_1x1|gif$/i.test(itm.imageUrl)) {
      itm.imageUrl = await fetchOgImage(browser, itm.itemHref);
    }
  }
  return items;
}

// Core: scrape by image upload
async function scrapeEbayByImage(imagePath, limit = 20) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  try {
    // Navigate to eBay image search
    await page.goto('https://www.ebay.com/sch/ebayadvsearch', { waitUntil: 'networkidle2' });
    
    // Upload the image
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      console.warn('eBay image upload input not found – returning empty result');
      return [];
    }

    await fileInput.uploadFile(imagePath);
    
    // Wait for search results
    await page.waitForSelector('.s-item', { timeout: 30000 });
    
    // Extract listings
    let raw = await page.$$eval(
      '.s-item',
      (els, lim) => els.slice(0, lim).map(el => {
        const title = el.querySelector('.s-item__title')?.innerText;
        const priceText = el.querySelector('.s-item__price')?.innerText || '';
        const price = parseFloat(priceText.replace(/[^0-9\.]/g, '')) || null;
        // eBay lazy-loads: sometimes the real URL is in data-src; fall back to src
        const imgEl = el.querySelector('img.s-item__image-img');
        let image = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';
        if (image && image.startsWith('//')) image = 'https:' + image; // protocol-relative → https
        if (image.includes('trans_1x1') || image.endsWith('.gif')) image = imgEl?.getAttribute('data-src') || '';
        const href = el.querySelector('.s-item__link')?.href;
        const idMatch = href?.match(/\/(\d+)(?:\?|$)/);
        const dateText = el.querySelector('.s-item__sold-date, .s-item__endedDate')?.innerText || '';
        const date = new Date().toISOString();
        const dateSold = dateText.replace('Sold ', '');
        
        return {
          itemId: idMatch?.[1] || null,
          title,
          price,
          imageUrl: image,
          itemHref: href,
          date,
          dateSold,
          status: 'Sold'
        };
      }),
      limit
    );
    
    raw = await ensureImages(raw, browser);
    return raw;
  } catch (error) {
    console.error('Error in image-based search:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// API: Text search
app.post('/api/scrape-text', async (req, res) => {
  const { query, limit } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });
  try {
    const cacheKey = `text:${query}:${limit}`;
    if (cache.has(cacheKey)) return res.json({ grouped: cache.get(cacheKey) });
    const items = await scrapeEbay(query, limit || 20);
    const grouped = groupVariations(items);
    cache.set(cacheKey, grouped);
    res.json({ grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Image search (stub)
app.post('/api/scrape-image', tmpUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const items = await scrapeEbayByImage(req.file.path, 20);
    const grouped = groupVariations(items);
    res.json({ grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

export { scrapeEbay, scrapeEbayByImage }; 