// ebayScraperService.js
// Node.js service for eBay scraping, variation grouping, and grade handling.

import dotenv from 'dotenv'; dotenv.config();
import fs from 'fs';
import path from 'path';
import NodeCache from 'node-cache';
import { firefox } from 'playwright';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cache = new NodeCache({ stdTTL: 600 }); // 10 min cache

// ---------------------------------------------------------------------------
// Local image cache directory – we download each listing's main image once
//  and then serve it from /images/<itemId>.jpg so the front-end never has to
//  talk to eBay. This bypasses hot-link blocking and guarantees availability.
// ---------------------------------------------------------------------------
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

async function launchBrowser() {
  try {
    console.log('Launching Firefox browser...');
    const options = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    };

    // If we're in Docker, use the pre-installed browser
    if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
      console.log(`Using browser from ${process.env.PLAYWRIGHT_BROWSERS_PATH}`);
      options.executablePath = `${process.env.PLAYWRIGHT_BROWSERS_PATH}/firefox-1423/firefox/firefox`;
    }

    const browser = await firefox.launch(options);
    console.log('Browser launched successfully');
    return browser;
  } catch (err) {
    console.error('Failed to launch browser:', err);
    throw err;
  }
}

// Scrape eBay with Firefox
export async function scrapeEbay(query, maxItems = 60) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  
  try {
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=13&LH_Sold=1&LH_Complete=1`;
    console.log('Navigating to:', url);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
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
    
    return listings.slice(0, maxItems);
  } catch (error) {
    console.error('Error scraping eBay:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export { groupVariations, extractGrade, normalizeTitle, cacheImage }; 