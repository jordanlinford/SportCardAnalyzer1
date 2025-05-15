import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config();

// Simplified version of the scraper function for serverless
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  console.log(`Attempting to fetch URL: ${url}`);
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const delayMs = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
      await new Promise(resolve => setTimeout(resolve, delayMs));
      console.log(`Request attempt ${attempt + 1} of ${maxRetries}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Cache-Control': 'max-age=0',
        },
        timeout: 30000,
        ...options
      });
      if (response.status === 200) {
        console.log(`Successfully fetched URL on attempt ${attempt + 1}`);
        return response;
      }
    } catch (error) {
      console.error(`Error on attempt ${attempt + 1}:`, error.message);
      if (attempt === maxRetries - 1) throw error;
    }
  }
  throw new Error(`Failed to fetch URL after ${maxRetries} attempts`);
}

function extractBestImageUrl(imageElement) {
  if (!imageElement || imageElement.length === 0) return '';
  return imageElement.attr('src') || 
         imageElement.attr('data-src') || 
         imageElement.attr('data-img-src') || 
         extractSrcset(imageElement.attr('srcset')) ||
         imageElement.attr('data-imageurl') ||
         '';
}

function extractSrcset(srcset) {
  if (!srcset) return '';
  try {
    const srcsetParts = srcset.split(',').map(part => part.trim());
    if (srcsetParts.length === 0) return '';
    const lastPart = srcsetParts[srcsetParts.length - 1];
    return lastPart.split(' ')[0] || '';
  } catch (e) {
    console.log("Error parsing srcset:", e);
    return '';
  }
}

function extractListingData($, element) {
  try {
    const titleElement = $(element).find('div.s-item__title span');
    const title = titleElement.text().trim();
    if (title.toLowerCase().includes('shop on ebay')) {
      return null;
    }
    
    const priceStr = $(element).find('.s-item__price').text().trim();
    const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    
    const shippingStr = $(element).find('.s-item__shipping, .s-item__freeXDays').text().trim();
    let shipping = 0;
    if (shippingStr && !shippingStr.toLowerCase().includes('free')) {
      shipping = parseFloat(shippingStr.replace(/[^0-9.]/g, '')) || 0;
    }
    
    const totalPrice = price + shipping;
    const date = new Date();
    const dateSold = date.toISOString().split('T')[0];
    
    // Extract image
    let imageUrl = '';
    const imageContainer = $(element).find('.s-item__image-wrapper');
    if (imageContainer.length > 0) {
      const imageElement = imageContainer.find('img');
      if (imageElement.length > 0) {
        imageUrl = extractBestImageUrl(imageElement);
      }
    }
    
    // Improve image URL
    if (imageUrl) {
      imageUrl = imageUrl
        .replace('s-l64', 's-l500')
        .replace('s-l96', 's-l500')
        .replace('s-l140', 's-l500')
        .replace('s-l225', 's-l500')
        .replace('s-l300', 's-l500');
      
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      }
    }
    
    const link = $(element).find('.s-item__link').attr('href') || '';
    
    return {
      title,
      price,
      shipping,
      totalPrice,
      date: date.toISOString(),
      dateSold,
      imageUrl,
      link,
      status: 'Sold'
    };
  } catch (err) {
    console.error("Error extracting listing data:", err.message);
    return null;
  }
}

async function scrapeEbay(url) {
  console.log("Scraping URL:", url);
  try {
    const response = await fetchWithRetry(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const items = $('.s-item__wrapper');
    console.log(`Found ${items.length} total items on page`);
    
    if (items.length === 0) return [];
    
    const listings = [];
    items.each((index, element) => {
      try {
        if ($(element).text().includes("Shop on eBay")) return;
        
        const listing = extractListingData($, element);
        if (listing) {
          listings.push(listing);
          console.log(`Added item: ${listing.title} - $${listing.price} - ${listing.imageUrl}`);
        }
      } catch (err) {
        console.error("Error processing item:", err.message);
      }
    });
    
    console.log(`Successfully scraped ${listings.length} listings`);
    return listings;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return [];
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { 
    playerName, 
    year, 
    cardSet, 
    cardNumber, 
    variation, 
    condition, 
    negKeywords 
  } = req.body;
  
  if (!playerName) {
    return res.status(400).json({ error: 'Player name is required' });
  }
  
  try {
    // Build the search query
    let baseQuery = playerName;
    if (year) baseQuery += ' ' + year;
    if (cardSet) baseQuery += ' ' + cardSet;
    if (cardNumber) baseQuery += ' ' + cardNumber;
    if (variation) baseQuery += ' ' + variation;
    if (condition) baseQuery += ' ' + condition;
    
    // Add negative keywords
    const negQuery = (negKeywords || ['lot', 'reprint']).map(kw => `-${kw}`).join(' ');
    const searchQuery = `${baseQuery} ${negQuery}`;
    
    // Create the eBay URL
    const encodedQuery = encodeURIComponent(searchQuery);
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sacat=212&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=240`;
    
    console.log("Searching eBay with URL:", ebayUrl);
    const results = await scrapeEbay(ebayUrl);
    
    // Return the results
    res.status(200).json({
      listings: results,
      count: results.length,
      query: ebayUrl
    });
  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 