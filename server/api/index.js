import express from 'express';
import ebayRoutes from './routes/ebay.js';
import { scrapeEbay } from '../ebayScraperService.js';

const router = express.Router();

// Mount routes
router.use('/ebay', ebayRoutes);

// Text search endpoint
router.post('/text-search', async (req, res) => {
  try {
    const { query, limit, negKeywords, grade } = req.body;
    const maxResults = limit || 60; // Default to 60 results

    console.log(`➡️  Text search for: ${query}`);
    const listings = await scrapeEbay(query, maxResults, negKeywords, grade);
    console.log(`  ↳ Found ${listings.length} sold listings`);
    
    res.json({
      success: true,
      listings,
      message: `Found ${listings.length} sold listings`
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

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router; 