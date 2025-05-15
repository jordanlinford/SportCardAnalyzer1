import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config();

// Configure max timeout for eBay requests
const FETCH_TIMEOUT = 30000; // 30 seconds

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
        timeout: FETCH_TIMEOUT,
        ...options
      });
      if (response.status === 200) {
        console.log(`Successfully fetched URL on attempt ${attempt + 1}`);
        return response;
      } else {
        console.log(`Received status ${response.status} on attempt ${attempt + 1}`);
      }
    } catch (error) {
      console.error(`Error on attempt ${attempt + 1}:`, error.message);
      if (attempt === maxRetries - 1) {
        throw error;
      }
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

function extractListingData($, element, isRaw = false) {
  const titleElement = $(element).find('div.s-item__title span');
  const title = titleElement.text().trim();
  if (title.toLowerCase().includes('shop on ebay')) {
    console.log("Skipping 'Shop on eBay' listing");
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
  
  // Extract date
  const dateSelectors = [
    '.s-item__listingDate',
    '.s-item__endedDate',
    '.s-item__soldDate',
    '.s-item__time-left'
  ];
  let dateStr = null;
  for (const selector of dateSelectors) {
    const dateElement = $(element).find(selector);
    if (dateElement.length > 0) {
      dateStr = dateElement.text().trim();
      break;
    }
  }
  if (!dateStr) {
    $(element).find('span, div').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text.includes('Sold') || text.includes('Ended')) {
        dateStr = text;
        return false;
      }
    });
  }
  
  // Process the date
  let date = new Date();
  if (dateStr) {
    try {
      dateStr = dateStr.replace(/^(Sold|Ended)\s+/i, '').trim();
      if (dateStr.includes('d ago')) {
        const days = parseInt(dateStr);
        if (!isNaN(days)) {
          date = new Date();
          date.setDate(date.getDate() - days);
        }
      } else if (dateStr.includes('h ago')) {
        const hours = parseInt(dateStr);
        if (!isNaN(hours)) {
          date = new Date();
          date.setHours(date.getHours() - hours);
        }
      } else {
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate;
        }
      }
    } catch (e) {
      console.log("Error parsing date:", e);
    }
  }
  
  // Extract image
  let imageUrl = '';
  const imageContainer = $(element).find('.s-item__image, .s-item__image-wrapper, .s-item__image-section');
  if (imageContainer.length > 0) {
    const imageElement = imageContainer.find('img');
    if (imageElement.length > 0) {
      imageUrl = extractBestImageUrl(imageElement);
    }
  }
  
  // If still no image, try different selectors
  if (!imageUrl || imageUrl.includes('data:image') || imageUrl.includes('.gif')) {
    const directImageSelectors = [
      'img.s-item__image-img',
      'img.s-item__image',
      'img.s-item__image--img',
      'img.s-item__image-img--img'
    ];
    for (const selector of directImageSelectors) {
      const imageElement = $(element).find(selector);
      if (imageElement.length > 0) {
        const extractedUrl = extractBestImageUrl(imageElement);
        if (extractedUrl && !extractedUrl.includes('data:image') && !extractedUrl.includes('.gif')) {
          imageUrl = extractedUrl;
          break;
        }
      }
    }
  }
  
  // Last resort image extraction
  if (!imageUrl || imageUrl.includes('data:image') || imageUrl.includes('.gif')) {
    const anyImage = $(element).find('img').first();
    if (anyImage.length > 0) {
      imageUrl = extractBestImageUrl(anyImage);
    }
  }
  
  // Process the image URL
  if (imageUrl) {
    imageUrl = imageUrl
      .replace('s-l64', 's-l500')
      .replace('s-l96', 's-l500')
      .replace('s-l140', 's-l500')
      .replace('s-l225', 's-l500')
      .replace('s-l300', 's-l500');
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    } else if (imageUrl.startsWith('/')) {
      imageUrl = 'https://www.ebay.com' + imageUrl;
    }
    if (imageUrl.includes('?')) {
      imageUrl = imageUrl.split('?')[0];
    }
    if (imageUrl.toLowerCase().includes('placeholder') || 
        imageUrl.toLowerCase().includes('no-image')) {
      imageUrl = '';
    }
  }
  
  // Get link
  const link = $(element).find('.s-item__link').attr('href') || '';
  
  // Determine status
  const itemInfoElements = $(element).find('.s-item__caption-section');
  let status = '';
  itemInfoElements.each((index, infoElem) => {
    const text = $(infoElem).text().trim().toLowerCase();
    if (text.includes('sold') || text.includes('ended')) {
      status = 'Sold';
    }
  });
  
  const dateSold = date.toISOString().split('T')[0];
  
  return {
    title,
    price,
    shipping,
    totalPrice,
    date: date.toISOString(),
    dateSold,
    imageUrl,
    url: link,
    source: 'eBay',
    status: status || 'Sold',
    isRaw: isRaw
  };
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

export async function handler(req, res) {
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
  
  const { query, grade = 'any', isRaw = false } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }
  
  try {
    // For simplicity, we'll scrape eBay completed listings
    const listings = await scrapeEbayWithQuery(query, isRaw);
    
    // Filter by grade if specified
    let filteredListings = listings;
    if (grade && grade !== 'any') {
      filteredListings = listings.filter(listing => {
        const title = listing.title.toLowerCase();
        // Different grade matching patterns based on the grading company
        if (grade.startsWith('PSA')) {
          return title.includes('psa') && title.includes(grade.split(' ')[1]);
        } else if (grade.startsWith('BGS')) {
          return title.includes('bgs') && title.includes(grade.split(' ')[1]);
        } else if (grade.startsWith('SGC')) {
          return title.includes('sgc') && title.includes(grade.split(' ')[1]);
        } else if (grade === 'raw') {
          // For raw cards, exclude graded cards
          return !title.includes('psa') && !title.includes('bgs') && 
                 !title.includes('sgc') && !title.includes('graded');
        }
        return true;
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      listings: filteredListings,
      count: filteredListings.length,
      originalQuery: query,
      grade
    });
  } catch (error) {
    console.error('Error scraping eBay:', error);
    return res.status(500).json({ 
      error: 'Error scraping data',
      message: error.message,
      query
    });
  }
}

async function scrapeEbayWithQuery(searchQuery, isRaw = false) {
  // Create a URL-friendly search query
  const encodedQuery = encodeURIComponent(searchQuery);
  
  // Construct the eBay completed listings URL
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sacat=0&LH_Complete=1&LH_Sold=1&rt=nc&_udlo=0.01`;
  
  try {
    const listings = await scrapeEbay(url, isRaw);
    console.log(`Query "${searchQuery}": found ${listings.length} listings`);
    return listings;
  } catch (error) {
    console.error(`Error scraping listings for query "${searchQuery}":`, error);
    throw error;
  }
}

async function scrapeEbay(url, isRaw = false) {
  console.log("Scraping URL:", url);
  try {
    const response = await fetchWithRetry(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    const listings = [];
    
    // Select all listing items
    $('.s-item__wrapper').each((index, element) => {
      try {
        const listingData = extractListingData($, element, isRaw);
        if (listingData) {
          console.log(`Added item: ${listingData.title} - $${listingData.totalPrice} - ${listingData.imageUrl}`);
          listings.push(listingData);
        }
      } catch (e) {
        console.error('Error processing listing:', e);
      }
    });
    
    console.log(`Successfully scraped ${listings.length} listings`);
    return listings;
  } catch (error) {
    console.error('Error scraping eBay:', error);
    throw error;
  }
} 