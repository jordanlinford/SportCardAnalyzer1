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
async function scrapeEbay(query, limit = 120) {
  // Helper to scrape a single URL and return items (used twice)
  async function fetchPage(searchUrl, statusTag = 'sold') {
    const browser = await puppeteer.launch({ 
      headless: "new", // Use new headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Use a more modern user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    
    // Add viewport settings
    await page.setViewport({ width: 1280, height: 800 });

    // DEBUG: see where Puppeteer is going
    console.log('➡️  navigating to', searchUrl);

    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for listing items to load
      await page.waitForSelector('.srp-results .s-item__pl-on-bottom', { timeout: 10000 })
        .catch(() => console.log('Warning: Timing out waiting for listings'));
      
      // Scroll to trigger lazy loading
      await page.evaluate(async () => {
        await new Promise(res => {
          let total = 0;
          const step = 600;
          const timer = setInterval(() => {
            window.scrollBy(0, step);
            total += step;
            if (total > 5000) { // Scroll more for modern pages
              clearInterval(timer);
              res();
            }
          }, 200);
        });
      });

      await page.waitForTimeout(1500);

      // Try multiple selectors based on eBay's different listing formats
      const results = await page.evaluate((lim, tag) => {
        // Try various eBay listing selectors - they change frequently
        const selectors = [
          '.srp-results .s-item__pl-on-bottom', // Modern layout
          '.srp-results .s-item',              // Alternative layout
          '.b-list__items .s-item',           // Old layout
          '[data-view="mi:1686|iid:1"]'        // Very new layout
        ];
        
        let items = [];
        
        // Try each selector until we find listings
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements && elements.length > 0) {
            items = Array.from(elements).slice(0, lim).map(el => {
              // Extract title with fallbacks
              const titleEl = el.querySelector('.s-item__title') || 
                             el.querySelector('[role="heading"]') ||
                             el.querySelector('h3');
              const title = titleEl?.innerText?.replace('New Listing', '').trim();
              
              // Extract price with fallbacks
              const priceEl = el.querySelector('.s-item__price') || 
                             el.querySelector('.x-price') ||
                             el.querySelector('[data-testid="price"]');
              const priceText = priceEl?.innerText || '';
              const price = parseFloat(priceText.replace(/[^0-9\.]/g, '')) || null;
              
              // Extract image with multiple fallbacks
              const imgEl = el.querySelector('.s-item__image-img') || 
                           el.querySelector('.image img') ||
                           el.querySelector('[data-testid="itemImage"] img');
              
              let image = '';
              if (imgEl) {
                // Try multiple attributes where image might be
                image = imgEl.getAttribute('src') || 
                        imgEl.getAttribute('data-src') || 
                        imgEl.getAttribute('srcset')?.split(' ')[0] || '';
              }
              
              // Fix protocol-relative URLs
              if (image && image.startsWith('//')) image = 'https:' + image;
              
              // Skip placeholder/transparent images
              if (image && (image.includes('trans_1x1') || image.endsWith('.gif'))) {
                image = imgEl?.getAttribute('data-src') || '';
              }
              
              // Extract link with fallbacks
              const linkEl = el.querySelector('.s-item__link') || 
                            el.querySelector('a[href*="itm/"]') ||
                            el.querySelector('[data-testid="itemCard"] a');
              const href = linkEl?.href;
              
              // Extract ID from URL
              const idMatch = href?.match(/\/(\d+)(?:\?|$)/);
              const itemId = idMatch?.[1] || null;
              
              // Extract sold date if available
              const dateEl = el.querySelector('.s-item__endedDate, .s-item__sold-date') ||
                           el.querySelector('[data-testid="itemEndDate"]');
              const dateText = dateEl?.innerText || '';
              // Current date fallback
              const now = new Date().toISOString().split('T')[0];
              const soldDate = dateText.replace(/Sold\s+|Ended\s+/i, '').trim() || now;
              
              // Extract shipping if available
              const shippingEl = el.querySelector('.s-item__shipping, .s-item__freeXDays') ||
                               el.querySelector('[data-testid="itemShipping"]');
              const shippingText = shippingEl?.innerText || '';
              // Extract shipping cost or 0 for free shipping
              let shipping = 0;
              if (shippingText && !shippingText.toLowerCase().includes('free')) {
                const shippingMatch = shippingText.match(/(\d+\.\d+)/);
                if (shippingMatch) shipping = parseFloat(shippingMatch[1]);
              }
              
              return { 
                itemId, 
                title, 
                price, 
                shipping,
                totalPrice: price + shipping,
                imageUrl: image, 
                itemHref: href, 
                dateSold: soldDate,
                date: now,
                status: tag 
              };
            });
            // If we found items with this selector, break the loop
            break;
          }
        }
        
        // Filter out invalid items
        return items.filter(item => item.title && item.price && item.itemId);
        
      }, limit, statusTag);

      await browser.close();
      return results || [];
    } catch (error) {
      console.error(`Error scraping ${searchUrl}:`, error);
      await browser.close();
      return [];
    }
  }

  const soldUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=13&LH_Sold=1&LH_Complete=1`;
  let items = await fetchPage(soldUrl, 'sold');
  console.log(`  ↳ Found ${items.length} sold listings`);

  // Fallback to active listings if too few sold comps
  if (items.length < 5) {
    console.log('  ↳ Not enough sold listings, adding active listings...');
    const activeUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`;
    const active = await fetchPage(activeUrl, 'active');
    console.log(`  ↳ Found ${active.length} active listings`);
    items = items.concat(active);
  }

  // Basic clean-up
  items = items.filter(itm => {
    if (!itm.title) return false;
    if (/SHOP ON EBAY|Shop on eBay/i.test(itm.title)) return false;
    return true;
  });

  console.log(`  ↳ Returning ${items.length} total listings`);
  return items.slice(0, limit);
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