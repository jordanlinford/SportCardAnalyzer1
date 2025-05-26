import { firefox } from 'playwright';

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
    if (process.env.NODE_ENV === 'production') {
      console.log('Running in production, using system Firefox');
      options.executablePath = '/usr/bin/firefox-esr';
    }

    const browser = await firefox.launch(options);
    console.log('Browser launched successfully');
    return browser;
  } catch (err) {
    console.error('Failed to launch browser:', err);
    throw err;
  }
}

/**
 * Fetches the primary image (and any variation images) from an eBay listing page.
 *
 * @param {string} listingUrl – Full URL to an eBay item (https://www.ebay.com/itm/…)
 * @returns {Promise<{ mainImage: string|null, variations: string[] }>}
 */
export async function fetchEbayImages(listingUrl) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  
  try {
    await page.goto(listingUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    const images = await page.$$eval('img.s-item__image-img', (imgs) => {
      return imgs.map(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        return src ? src.split('?')[0] : null;
      }).filter(Boolean);
    });
    
    return images;
  } catch (error) {
    console.error('Error fetching eBay images:', error);
    return [];
  } finally {
    await browser.close();
  }
} 