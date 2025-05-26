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
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Launching Firefox browser (attempt ${retryCount + 1}/${maxRetries})...`);
      const options = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-popup-blocking',
          '--disable-notifications',
          '--window-size=1920,1080'
        ],
        firefoxUserPrefs: {
          'browser.cache.disk.enable': false,
          'browser.cache.memory.enable': false,
          'browser.cache.offline.enable': false,
          'network.http.use-cache': false,
          'permissions.default.image': 2
        },
        viewport: { width: 1920, height: 1080 }
      };

      // If we're in Docker, use the pre-installed browser
      if (process.env.NODE_ENV === 'production') {
        console.log('Running in production, using system Firefox');
        if (!process.env.FIREFOX_PATH) {
          throw new Error('FIREFOX_PATH environment variable not set');
        }
        options.executablePath = process.env.FIREFOX_PATH;
        console.log('Using Firefox at:', process.env.FIREFOX_PATH);
      }

      const browser = await firefox.launch(options);
      console.log('Browser launched successfully');
      return browser;
    } catch (err) {
      retryCount++;
      console.error(`Failed to launch browser (attempt ${retryCount}/${maxRetries}):`, err);
      
      if (retryCount === maxRetries) {
        throw new Error(`Failed to launch browser after ${maxRetries} attempts: ${err.message}`);
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
    }
  }
}

// Scrape eBay with Firefox
export async function scrapeEbay(query, maxItems = 60) {
  let browser = null;
  let context = null;
  let page = null;
  
  try {
    browser = await launchBrowser();
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    });
    
    page = await context.newPage();
    
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=13&LH_Sold=1&LH_Complete=1`;
    console.log('Navigating to:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 60000
    });
    
    await page.waitForSelector('.s-item__wrapper', { timeout: 30000 });
    await autoScroll(page);
    
    const listings = await page.$$eval('.s-item__wrapper', (elements) => {
      return elements.map(el => {
        const title = el.querySelector('.s-item__title')?.textContent?.trim() || '';
        if (title.includes('Shop on eBay')) return null;
        
        const priceText = el.querySelector('.s-item__price')?.textContent || '';
        const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
        
        let imageUrl = '';
        const imgEl = el.querySelector('.s-item__image-img');
        if (imgEl) {
          // Try to get the highest quality image URL
          const srcset = imgEl.getAttribute('srcset');
          if (srcset) {
            // Parse srcset and get the largest image
            const srcs = srcset.split(',')
              .map(src => {
                const [url, width] = src.trim().split(' ');
                return { url, width: parseInt(width) };
              })
              .sort((a, b) => b.width - a.width);
            if (srcs.length > 0) imageUrl = srcs[0].url;
          }
          
          if (!imageUrl) {
            imageUrl = imgEl.getAttribute('data-src') || 
                      imgEl.getAttribute('src') || 
                      imgEl.getAttribute('data-image-src') || '';
          }
          
          // Remove eBay's image sizing parameters and ensure we get the largest version
          imageUrl = imageUrl.split('?')[0].replace(/s-l\d+/g, 's-l1600');
        }
        
        const itemUrl = el.querySelector('.s-item__link')?.getAttribute('href') || '';
        const dateText = el.querySelector('.s-item__endedDate')?.textContent?.trim() || '';
        
        return title && price && imageUrl ? {
          title,
          price,
          imageUrl,
          itemUrl,
          dateSold: dateText,
          source: 'eBay'
        } : null;
      }).filter(Boolean);
    });
    
    console.log(`Found ${listings.length} valid listings, caching images...`);
    
    // Cache images in parallel with a concurrency limit
    const processedListings = await Promise.all(
      listings.slice(0, maxItems).map(async (listing) => {
        try {
          // Generate a unique filename based on the listing URL or title
          const itemId = listing.itemUrl.match(/\/(\d+)\?/) ? 
                        listing.itemUrl.match(/\/(\d+)\?/)[1] : 
                        Buffer.from(listing.title).toString('base64').substring(0, 32);
          
          const imagePath = path.join(IMAGES_DIR, `${itemId}.jpg`);
          
          // Try to cache the image
          const cached = await cacheImage(imagePath, listing.imageUrl);
          
          if (cached) {
            // Return the local path instead of the eBay URL
            return {
              ...listing,
              imageUrl: `/images/${itemId}.jpg` // This will be served from your local images directory
            };
          }
          
          return listing; // Keep original URL if caching failed
        } catch (err) {
          console.warn(`Failed to cache image for listing: ${listing.title}`, err.message);
          return listing;
        }
      })
    );
    
    console.log(`Successfully processed ${processedListings.length} listings with images`);
    return processedListings;
    
  } catch (error) {
    console.error('Error scraping eBay:', error);
    
    if (error.message.includes('net::ERR_CONNECTION_TIMED_OUT')) {
      throw new Error('Connection to eBay timed out. Please try again.');
    } else if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      throw new Error('Connection to eBay was refused. The service may be temporarily unavailable.');
    } else if (error.message.includes('Navigation timeout')) {
      throw new Error('Page load timed out. eBay may be slow or blocking requests.');
    }
    
    throw error;
  } finally {
    if (page) await page.close().catch(console.error);
    if (context) await context.close().catch(console.error);
    if (browser) await browser.close().catch(console.error);
  }
}

// Helper function to scroll and load all items
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  
  // Wait a bit for any lazy-loaded images
  await page.waitForTimeout(2000);
}

export { groupVariations, extractGrade, normalizeTitle, cacheImage }; 