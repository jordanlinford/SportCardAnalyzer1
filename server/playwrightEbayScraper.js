import { firefox } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_TIMEOUT = 30000;
const SOLD_URL = (query) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=0&LH_Sold=1&LH_Complete=1&_ipg=240`;

const randomUserAgent = () => {
  const list = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  ];
  return list[Math.floor(Math.random() * list.length)];
};

const isRealImage = (url) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return !(
    lower.includes('placeholder') ||
    lower.includes('no-image') ||
    lower.includes('spacer') ||
    lower.endsWith('.gif') ||
    lower.trim() === ''
  );
};

async function launchBrowser() {
  try {
    console.log('Launching browser...');
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

export async function scrapeByText(query, maxItems = 60) {
  const browser = await launchBrowser();
  const context = await browser.newContext({ userAgent: randomUserAgent() });
  const page = await context.newPage();

  try {
    console.log('Navigating to eBay search URL...');
    await page.goto(SOLD_URL(query), { waitUntil: 'networkidle', timeout: DEFAULT_TIMEOUT });
    console.log('Page loaded, scrolling...');
    await autoScroll(page);

    console.log('Extracting listings...');
    const listings = await page.$$eval('.s-item', (elements, max) => {
      const parsePrice = (txt) => parseFloat(txt.replace(/[^0-9.]/g, ''));
      const results = [];
      
      for (const el of elements) {
        if (results.length >= max) break;
        
        const titleEl = el.querySelector('.s-item__title');
        const priceEl = el.querySelector('.s-item__price');
        const imageEl = el.querySelector('img.s-item__image-img');
        const linkEl = el.querySelector('a.s-item__link');
        
        if (!titleEl || !priceEl || !imageEl || !linkEl) continue;
        
        const title = titleEl.textContent.trim();
        if (title.includes('Shop on eBay')) continue;
        
        const price = parsePrice(priceEl.textContent || '');
        if (!price) continue;
        
        const img = imageEl.getAttribute('src') || imageEl.getAttribute('data-src');
        if (!img || img.includes('s-l64') || img.includes('s-l96')) continue;
        
        results.push({
          title,
          price,
          shipping: 0,
          totalPrice: price,
          date: new Date().toISOString(),
          dateSold: new Date().toISOString().split('T')[0],
          imageUrl: img.split('?')[0],
          url: linkEl.href,
          source: 'eBay'
        });
      }
      return results;
    }, maxItems);

    console.log(`Found ${listings.length} listings`);
    return listings;
  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export async function scrapeByImage(localImagePath, maxItems = 60) {
  const browser = await launchBrowser();
  const context = await browser.newContext({ userAgent: randomUserAgent() });
  const page = await context.newPage();

  try {
    console.log('Navigating to eBay image search...');
    await page.goto('https://www.ebay.com/sl/img', { waitUntil: 'networkidle', timeout: DEFAULT_TIMEOUT });
    const input = await page.$('input[type="file"]');
    if (!input) throw new Error('Could not find image upload input');
    
    console.log('Uploading image...');
    await input.setInputFiles(localImagePath);

    console.log('Waiting for results...');
    await page.waitForSelector('.s-item', { timeout: DEFAULT_TIMEOUT });
    await autoScroll(page);

    console.log('Extracting listings...');
    const listings = await page.$$eval('.s-item', (elements, max, isRealImageFn) => {
      const parsePrice = (txt) => parseFloat(txt.replace(/[^0-9.]/g, ''));
      const results = [];
      for (const el of elements) {
        if (results.length >= max) break;
        const titleEl = el.querySelector('.s-item__title');
        const priceEl = el.querySelector('.s-item__price');
        const imageEl = el.querySelector('img.s-item__image-img');
        const linkEl = el.querySelector('a.s-item__link');
        if (!titleEl || !priceEl || !imageEl || !linkEl) continue;
        const img = imageEl.getAttribute('src') || imageEl.getAttribute('data-src');
        if (!isRealImageFn(img)) continue;
        const price = parsePrice(priceEl.textContent || '');
        if (!price) continue;
        results.push({
          title: titleEl.textContent.trim(),
          price,
          shipping: 0,
          totalPrice: price,
          date: new Date().toISOString(),
          dateSold: new Date().toISOString().split('T')[0],
          imageUrl: img.split('?')[0],
          url: linkEl.href,
          source: 'eBay',
        });
      }
      return results;
    }, maxItems, isRealImage.toString());

    console.log(`Found ${listings.length} listings`);
    return listings;
  } catch (error) {
    console.error('Error during image search:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 1000;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 400);
    });
  });
} 