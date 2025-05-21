// Test script for eBay scraper
// This script scrapes data for a single card and outputs the results
// Useful for testing the scraper without affecting the database

import { scrapeEbay } from '../ebayScraperService.js';

// The card to test scrape
const TEST_CARD = {
  query: 'Justin Jefferson 2020 Prizm PSA 10 #398',
  description: 'Justin Jefferson 2020 Prizm Base PSA 10'
};

console.log(`Testing scraper for: ${TEST_CARD.description}`);
console.log(`Query: ${TEST_CARD.query}`);
console.log('---------------------------------------------------');

async function testScrape() {
  try {
    // Scrape eBay for the card's sold listings
    console.log(`Scraping eBay for: ${TEST_CARD.query}`);
    const listings = await scrapeEbay(TEST_CARD.query, 10);
    
    if (!listings || listings.length === 0) {
      console.log('No listings found');
      return;
    }
    
    console.log(`Found ${listings.length} listings`);
    
    // Calculate median price
    const prices = listings.map(item => item.totalPrice || item.price)
      .filter(price => price && price > 0)
      .sort((a, b) => a - b);
      
    const median = prices.length > 0 
      ? prices[Math.floor(prices.length / 2)]
      : null;
      
    // Calculate average of most recent 5 sales
    const recentListings = [...listings].sort((a, b) => {
      const dateA = new Date(a.dateSold || a.date || 0);
      const dateB = new Date(b.dateSold || b.date || 0);
      return dateB - dateA;
    }).slice(0, 5);
    
    const recentAvg = recentListings.length > 0
      ? recentListings.reduce((sum, item) => sum + (item.totalPrice || item.price || 0), 0) / recentListings.length
      : null;
    
    // Display results
    console.log('\nRESULTS:');
    console.log(`Median price: $${median?.toFixed(2) || 'N/A'}`);
    console.log(`Recent average (last 5): $${recentAvg?.toFixed(2) || 'N/A'}`);
    console.log('\nSAMPLE LISTINGS:');
    
    // Display first 3 listings
    listings.slice(0, 3).forEach((item, index) => {
      console.log(`\n#${index + 1} - ${item.title}`);
      console.log(`Price: $${item.totalPrice || item.price || 'N/A'}`);
      console.log(`Date: ${item.dateSold || item.date || 'Unknown'}`);
      console.log(`Image: ${item.imageUrl || 'No image'}`);
    });
    
    console.log('\nTest completed successfully');
  } catch (error) {
    console.error('Error during test scrape:', error);
  }
}

// Run the test
testScrape().then(() => {
  console.log('Script finished');
  process.exit(0);
}).catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
}); 