import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Fetches the primary image (and any variation images) from an eBay listing page.
 *
 * @param {string} listingUrl – Full URL to an eBay item (https://www.ebay.com/itm/…)
 * @returns {Promise<{ mainImage: string|null, variations: string[] }>}
 */
export async function fetchEbayImages(listingUrl) {
  if (!listingUrl || typeof listingUrl !== 'string') {
    throw new Error('listingUrl must be a non-empty string');
  }

  try {
    const { data: html } = await axios.get(listingUrl, {
      headers: {
        // Pretend to be a normal browser to avoid bot blocks
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(html);

    // 1. Primary image
    let mainImage = $('img#icImg').attr('src');
    if (!mainImage) {
      mainImage = $('meta[property="og:image"]').attr('content') || null;
    }

    // 2. Variation images – look for PictureURL arrays inside <script> tags
    const variations = new Set();

    $('script').each((_, el) => {
      const scriptText = $(el).html() || '';
      if (!scriptText.includes('PictureURL')) return;

      // Common pattern:  "PictureURL":"https://...jpg" or "PictureURLLarge":"https://..."
      const regex = /"PictureURL(?:Large|FullSize)?"\s*:\s*"(https?:[^"\s]+)"/g;
      let match;
      while ((match = regex.exec(scriptText)) !== null) {
        variations.add(match[1]);
      }

      // Alternate key name sometimes used by eBay: pictureURL (lower-case p)
      const regex2 = /\bpictureURL"?\s*:\s*"(https?:[^"\s]+)"/g;
      while ((match = regex2.exec(scriptText)) !== null) {
        variations.add(match[1]);
      }
    });

    // Remove duplicate of mainImage if present
    if (mainImage) variations.delete(mainImage);

    return {
      mainImage: mainImage || null,
      variations: Array.from(variations),
    };
  } catch (err) {
    console.error('fetchEbayImages error:', err.message || err);
    throw err;
  }
} 