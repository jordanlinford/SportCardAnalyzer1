// Nightly eBay scraper script
// This script runs on a schedule to pre-fetch data for popular cards
// and store it in Firebase for faster retrieval

import admin from 'firebase-admin';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { scrapeEbay } from '../ebayScraperService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Starting nightly eBay scraper job...');

// Initialize Firebase
try {
  const serviceAccount = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../credentials/service-account.json'), 'utf8')
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);
  process.exit(1);
}

// Popular cards to scrape
// This list can be expanded or made dynamic based on trending cards
const CARDS_TO_SCRAPE = [
  {
    id: 'jefferson-prizm-psa10',
    query: 'Justin Jefferson 2020 Prizm PSA 10 #398',
    description: 'Justin Jefferson 2020 Prizm Base PSA 10',
    player: 'Justin Jefferson',
    year: '2020',
    set: 'Prizm',
    grade: 'PSA 10'
  },
  {
    id: 'jefferson-prizm-psa9',
    query: 'Justin Jefferson 2020 Prizm PSA 9 #398',
    description: 'Justin Jefferson 2020 Prizm Base PSA 9',
    player: 'Justin Jefferson',
    year: '2020',
    set: 'Prizm',
    grade: 'PSA 9'
  },
  {
    id: 'stroud-zenith-psa10',
    query: '2023 CJ Stroud Zenith Zeal of Approval Red 24 PSA 10',
    description: 'CJ Stroud 2023 Zenith Zeal of Approval Red PSA 10',
    player: 'CJ Stroud',
    year: '2023',
    set: 'Zenith',
    grade: 'PSA 10'
  },
  {
    id: 'purdy-luminance-psa9',
    query: '2023 Brock Purdy Luminance Green Parallel 62 PSA 9',
    description: 'Brock Purdy 2023 Luminance Green PSA 9',
    player: 'Brock Purdy',
    year: '2023',
    set: 'Luminance',
    grade: 'PSA 9'
  },
  {
    id: 'love-donruss-psa10',
    query: '2020 Jordan Love Donruss Rookie Card 304 PSA 10',
    description: 'Jordan Love 2020 Donruss Rookie PSA 10',
    player: 'Jordan Love',
    year: '2020',
    set: 'Donruss',
    grade: 'PSA 10'
  }
];

// Function to scrape and store data for a card
async function scrapeAndStoreCard(card) {
  console.log(`Scraping data for ${card.description}...`);
  
  try {
    // Scrape eBay for the card's sold listings
    const listings = await scrapeEbay(card.query, 60);
    
    if (!listings || listings.length === 0) {
      console.log(`No listings found for ${card.description}`);
      return;
    }
    
    console.log(`Found ${listings.length} listings for ${card.description}`);
    
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
    
    // Store in Firebase
    const db = admin.firestore();
    
    // Create a document with the card data and listings
    await db.collection('cached_cards').doc(card.id).set({
      description: card.description,
      player: card.player,
      year: card.year,
      set: card.set,
      grade: card.grade,
      query: card.query,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      median: median,
      recentAverage: recentAvg,
      count: listings.length,
      listings: listings.map(item => ({
        title: item.title,
        price: item.price,
        totalPrice: item.totalPrice,
        date: item.dateSold || item.date,
        imageUrl: item.imageUrl,
        status: item.status || 'sold'
      }))
    });
    
    // Also add to price history
    await db.collection('price_history').add({
      cardId: card.id,
      date: new Date(),
      median: median,
      recentAverage: recentAvg,
      sampleSize: listings.length
    });
    
    console.log(`Successfully stored data for ${card.description}`);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error(`Error scraping ${card.description}:`, error);
  }
}

// Main function to scrape all cards
async function scrapeAllCards() {
  try {
    // Process cards sequentially to avoid overwhelming eBay
    for (const card of CARDS_TO_SCRAPE) {
      await scrapeAndStoreCard(card);
    }
    
    console.log('Nightly scrape completed successfully');
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    // Ensure process exits
    setTimeout(() => process.exit(0), 1000);
  }
}

// Run the script
scrapeAllCards(); 