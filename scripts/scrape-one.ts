// Manual scraping tool for a single card search
// Usage: node --experimental-modules scripts/scrape-one.ts "2020 Prizm Justin Jefferson #398 PSA 10"

import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { scrapeEbay } from '../server/ebayScraperService.js';

// Grab the search term from command line args
const searchTerm = process.argv[2];

if (!searchTerm) {
  console.error('Please provide a search term as an argument');
  console.error('Example: node --experimental-modules scripts/scrape-one.ts "2020 Prizm Justin Jefferson #398 PSA 10"');
  process.exit(1);
}

// ---- Firebase Admin init ----
const svcPath = path.join(process.cwd(), 'credentials', 'service-account.json');
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync(svcPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// Utility functions duplicated here to prevent dependency issues
function detectGrade(title: string): string {
  const m = title.match(/\b(PSA|BGS|SGC|CGC|CSG|HGA)\s*(?:GEM\s*(?:MINT|MT|-?MT)?\s*)?(10|9(?:\.5)?|8(?:\.5)?)\b/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  return 'Raw';
}

function extractCardNumber(title: string): string {
  // Try multiple patterns to extract card number
  const patterns = [
    // #123 format
    /\#(\d{2,4})(?:\s|$)/,
    // Card #123 format
    /card\s*\#?\s*(\d{2,4})(?:\s|$)/i,
    // No.123 format
    /no\.?\s*(\d{2,4})(?:\s|$)/i,
    // Number 123 format
    /number\s*(\d{2,4})(?:\s|$)/i,
    // Just look for 2-4 digit numbers that might be card numbers
    /\s(\d{2,4})(?:\s|$)/
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Fallback to basic pattern from search term
  const n = title.match(/#?(\d{2,4})(?:[^\d]|$)/);
  return n ? n[1] : '';
}

function extractYear(searchTerm: string): string {
  // Look for 4-digit year between 1900-2100
  const yearMatch = searchTerm.match(/\b(19\d{2}|20\d{2})\b/);
  return yearMatch ? yearMatch[1] : '';
}

// Run the scraper for the provided search term
(async () => {
  console.log(`🔍 Scraping data for: "${searchTerm}"`);
  
  try {
    // Scrape eBay for the search term
    const listings = await scrapeEbay(searchTerm, 120);
    console.log(`  ↳ Found ${listings.length} listings`);
    
    if (listings.length === 0) {
      console.error('No listings found!');
      process.exit(1);
    }
    
    // Save raw listing data to Firebase
    const batch = db.batch();
    
    listings.forEach(listing => {
      if (!listing.itemId) return;
      const ref = db.collection('sales_raw').doc(listing.itemId);
      batch.set(ref, { ...listing, query: searchTerm }, { merge: true });
    });
    
    await batch.commit();
    console.log(`  ↳ Saved ${listings.length} raw listing documents to Firebase`);
    
    // Process listings to extract card info
    const year = extractYear(searchTerm);
    const grade = detectGrade(searchTerm);
    const cardNumber = extractCardNumber(searchTerm);
    
    // Create a player name from the first 1-2 words that aren't years
    const words = searchTerm.split(' ');
    let playerName = '';
    
    // Find player name (name usually comes before the year)
    for (const word of words) {
      // Skip if it's a year or card identifier
      if (/^(19|20)\d{2}$/.test(word) || /^#?\d+$/.test(word) || 
          /prizm|optic|select|mosaic|donruss/i.test(word)) {
        continue;
      }
      // Add to player name if it's likely part of a name (not too short)
      if (word.length > 1) {
        playerName += (playerName ? ' ' : '') + word;
      }
      // Stop after we have 2-3 words (likely first/last name)
      if (playerName.split(' ').length >= 2) break;
    }
    
    // Fallback to first word
    if (!playerName && words.length > 0) {
      playerName = words[0];
    }
    
    // Create a more semantic document ID
    const key = `${year}|${cardNumber}|${grade}`.replace(/\|\|/g, '|'); 
    const cardRef = db.collection('cards').doc(key);
    
    // Process all the sales for this card
    const sales = listings.map(item => ({ 
      price: item.totalPrice || item.price || 0, 
      date: item.dateSold || new Date().toISOString() 
    }));
    
    // Compute metrics
    const prices = sales.map(s => s.price).filter(p => p > 0);
    const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    
    // Save processed card data
    await cardRef.set({
      year, 
      cardNumber,
      grade,
      player: playerName,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      metrics: { averagePrice: avg, minPrice: min, maxPrice: max, count: prices.length },
      sales: sales.slice(-500) // keep last 500
    }, { merge: true });
    
    console.log(`  ↳ Processed card data saved to Firebase`);
    console.log(`  ↳ Card: ${year} ${playerName} #${cardNumber} ${grade}`);
    console.log(`  ↳ Metrics: Avg $${avg.toFixed(2)}, Min $${min.toFixed(2)}, Max $${max.toFixed(2)}, Count ${prices.length}`);
  } catch (err) {
    console.error('Error scraping data:', err);
    process.exit(1);
  }
  
  process.exit(0);
})(); 