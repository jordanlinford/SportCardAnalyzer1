// This script runs from a cron (GitHub Action, Render Cron, etc.)
// It iterates over a list of search queries (one per line in scrape-queue.txt),
// scrapes eBay sold/completed data via the existing scrapeEbay helper, and
// writes each sale as a document to Firestore collection `sales_raw/{itemId}`.

import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { scrapeEbay } from '../server/ebayScraperService.js';

// ---- Firebase Admin init (local or CI) ----
const svcPath = path.join(process.cwd(), 'credentials', 'service-account.json');
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync(svcPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ---- read queue file ----
const QUEUE_FILE = path.join(process.cwd(), 'scripts', 'scrape-queue.txt');
if (!fs.existsSync(QUEUE_FILE)) {
  console.error('Queue file not found', QUEUE_FILE);
  process.exit(1);
}
const lines = fs.readFileSync(QUEUE_FILE, 'utf8')
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(Boolean);

// Helper functions duplicated from scrape-one.ts
function detectGrade(title = ''): string {
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

function extractPlayerName(searchTerm: string): string {
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
  
  return playerName;
}

(async () => {
  for (const q of lines) {
    console.log('🔍  scraping', q);
    try {
      const listings = await scrapeEbay(q, 120);
      console.log(`  ↳ got ${listings.length} listings`);

      const batch = db.batch();
      listings.forEach(listing => {
        if (!listing.itemId) return;
        const ref = db.collection('sales_raw').doc(listing.itemId);
        batch.set(ref, { ...listing, query: q }, { merge: true });
      });
      await batch.commit();
      
      // Process listings to extract card info using the same improved methods from scrape-one.ts
      const year = extractYear(q);
      const grade = detectGrade(q);
      const cardNumber = extractCardNumber(q);
      const playerName = extractPlayerName(q);
      
      // Create a document ID
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
      
      console.log(`  ↳ Saved: ${year} ${playerName} #${cardNumber} ${grade}, ${prices.length} sales, avg $${avg.toFixed(2)}`);
    } catch (err) {
      console.warn('scrape error', q, err.message);
    }
    // polite delay so we do ~150 requests / hour
    await new Promise(r => setTimeout(r, 15000));
  }
})(); 