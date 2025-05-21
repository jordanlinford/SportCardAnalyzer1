import express from 'express';
import { scrapeEbay } from '../../ebayScraperService.js';
import { fetchEbayImages } from '../../ebayImageScraper.js';
import { generateEbayUrl, proxyEbayImage, normalizeQuery } from '../utils/ebay.js';
import { cacheImage } from '../utils/image.js';

const router = express.Router();

// GET /api/ebay/search
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const normalizedQuery = normalizeQuery(query);
    const ebayUrl = generateEbayUrl(normalizedQuery);
    
    console.log('➡️  navigating to', ebayUrl);
    const listings = await scrapeEbay(normalizedQuery);
    
    if (!listings || listings.length === 0) {
      return res.json({ listings: [] });
    }

    // Enrich listings with full-size images
    console.log('  ↳ Enriching', listings.length, 'listings with full-size images…');
    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const imageUrl = listing.imageUrl;
        if (!imageUrl) return listing;

        const proxyUrl = proxyEbayImage(imageUrl);
        const localPath = `images/${listing.id}.jpg`;
        
        await cacheImage(localPath, proxyUrl);
        
        return {
          ...listing,
          imageUrl: proxyUrl,
          localImagePath: localPath
        };
      })
    );

    console.log('  ↳ Returning', enrichedListings.length, 'enriched listings');
    res.json({ listings: enrichedListings });
  } catch (error) {
    console.error('Error in /api/ebay/search:', error);
    res.status(500).json({ error: 'Failed to fetch eBay listings' });
  }
});

// GET /api/ebay/image-proxy
router.get('/image-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('[Image Proxy] Request received with URL param:', url.substring(0, 120) + '...');
    console.log('[Image Proxy] Fetching image from:', url.substring(0, 120) + '...');

    const response = await fetchEbayImages(url);
    if (!response) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.set('Content-Type', response.contentType);
    res.set('Content-Length', response.contentLength);
    res.send(response.buffer);

    console.log('[Image Proxy] Success:', url.substring(0, 120) + '...', 
      `(${response.contentLength} bytes, type: ${response.contentType})`);
  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

export default router; 