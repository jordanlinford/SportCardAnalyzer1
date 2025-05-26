const axios = require('axios');
const cheerio = require('cheerio');

// Market Analyzer logic converted from Python to JavaScript
class MarketAnalyzer {
  constructor() {
    // Initialize market analyzer
  }

  analyze(salesData) {
    if (!salesData || salesData.length < 3) {
      return {
        trend: "Insufficient Data",
        volatility: null,
        liquidity: null,
        investment_rating: "Unknown"
      };
    }

    // Extract prices and dates
    const prices = [];
    const saleDates = [];

    salesData.forEach(entry => {
      const price = entry.totalPrice || entry.price;
      const dateStr = entry.dateSold || entry.date;
      if (price && dateStr) {
        try {
          prices.push(price);
          saleDates.push(new Date(dateStr));
        } catch (error) {
          console.error("Error parsing date:", error);
        }
      }
    });

    if (prices.length < 3) {
      return {
        trend: "Insufficient Data",
        volatility: null,
        liquidity: null,
        investment_rating: "Unknown"
      };
    }

    // Sort sales by date
    const combined = saleDates.map((date, i) => ({ date, price: prices[i] }))
      .sort((a, b) => a.date - b.date);
    
    const datesSorted = combined.map(item => item.date);
    const pricesSorted = combined.map(item => item.price);

    // Calculate days since first sale
    const days = datesSorted.map(d => Math.floor((d - datesSorted[0]) / (1000 * 60 * 60 * 24)));

    // Price trend (linear regression slope)
    const slope = linearRegression(days, pricesSorted);
    
    const trend = 
      slope > 0.5 ? "Upward" :
      slope < -0.5 ? "Downward" :
      "Stable";

    // Volatility (standard deviation / mean)
    const mean = pricesSorted.reduce((a, b) => a + b, 0) / pricesSorted.length;
    const stdDev = Math.sqrt(pricesSorted.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / pricesSorted.length);
    const volatilityScore = parseFloat((stdDev / mean).toFixed(2));

    // Liquidity (sales per day)
    const totalDays = Math.max(Math.floor((datesSorted[datesSorted.length - 1] - datesSorted[0]) / (1000 * 60 * 60 * 24)), 1);
    const liquidityScore = parseFloat((pricesSorted.length / totalDays).toFixed(2));

    // Investment Rating
    let rating;
    if (trend === "Upward" && volatilityScore < 0.3 && liquidityScore > 0.2) {
      rating = "Strong Buy";
    } else if (trend === "Stable" && volatilityScore < 0.5) {
      rating = "Hold";
    } else if (trend === "Downward" && volatilityScore > 0.4) {
      rating = "Avoid";
    } else {
      rating = "Speculative";
    }

    return {
      trend,
      volatility: volatilityScore,
      liquidity: liquidityScore,
      investment_rating: rating
    };
  }
}

// Linear regression helper function
function linearRegression(x, y) {
  const n = x.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
  }

  // Calculate slope
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope;
}

// Scraper logic from server/api/scraper.js
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
        timeout: 30000, // 30 seconds
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
  
  const dateSold = date.toISOString().split('T')[0];
  
  return {
    title,
    price,
    shipping,
    totalPrice,
    date: date.toISOString(),
    dateSold,
    source: 'eBay',
    status: 'Sold',
    isRaw: isRaw
  };
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

// Main Netlify Function handler
exports.handler = async (event) => {
  // CORS headers for preflight requests
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers };
  }

  try {
    // Parse the incoming request body
    const requestBody = JSON.parse(event.body);
    const { query, grade = 'any', isRaw = false } = requestBody;

    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing query parameter'
        })
      };
    }

    console.log(`Processing card search for query: ${query}, grade: ${grade}`);

    // 1. Fetch the sales data
    const listings = await scrapeEbayWithQuery(query, isRaw === true);
    
    // 2. Filter by grade if specified
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

    // 3. Analyze the filtered sales data
    const analyzer = new MarketAnalyzer();
    const analysis = analyzer.analyze(filteredListings);

    // 4. Return the combined results
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        query,
        grade,
        listings: filteredListings,
        count: filteredListings.length,
        analysis
      })
    };
    
  } catch (error) {
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: `Error processing request: ${error.message}`
      })
    };
  }
}; 