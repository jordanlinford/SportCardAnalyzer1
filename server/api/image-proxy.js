import axios from 'axios';

export default async function handler(req, res) {
  // Add CORS headers for image access from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  console.log('[Image Proxy] Request received with URL param:', url ? url.substring(0, 100) + '...' : 'undefined');
  
  if (!url || typeof url !== 'string') {
    console.error('[Image Proxy] Missing URL parameter');
    return res.status(400).send('url query param required');
  }

  try {
    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error(`Invalid URL protocol: ${url.substring(0, 30)}... - must start with http:// or https://`);
    }
    
    // Prevent localhost proxying
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      throw new Error('Cannot proxy localhost URLs to prevent circular references');
    }
    
    console.log(`[Image Proxy] Fetching image from: ${url.substring(0, 100)}...`);

    // Define a pool of user agents to rotate through
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.109 Safari/537.36'
    ];
    
    // Select a random user agent
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    // Create more comprehensive browser-like headers
    const headers = {
      'User-Agent': userAgent,
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.ebay.com/',
      'Cache-Control': 'no-cache',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive'
    };
    
    // Add a small random delay to avoid triggering rate limits
    const delay = Math.floor(Math.random() * 300) + 50; // 50-350ms delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // Function for retrying the request
    const fetchWithRetry = async (retries = 2) => {
      try {
        return await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 10000, // 10 second timeout
          headers: headers
        });
      } catch (error) {
        if (retries <= 0) throw error;
        
        // Wait before retrying with exponential backoff
        const backoff = Math.floor(Math.random() * 700) + 300; // 300-1000ms backoff
        console.log(`[Image Proxy] Retrying in ${backoff}ms, retries left: ${retries}`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        
        // Try with a different user agent for the retry
        headers['User-Agent'] = userAgents[Math.floor(Math.random() * userAgents.length)]; 
        
        return fetchWithRetry(retries - 1);
      }
    };

    // Attempt to fetch the image with retries
    const response = await fetchWithRetry();

    // Verify we got a valid image response
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    // For image content types, return the image
    if (contentType.includes('image/')) {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hour cache
      
      console.log(`[Image Proxy] Success: ${url.substring(0, 50)}... (${response.data.length} bytes, type: ${contentType})`);
      return res.send(response.data);
    }
    
    // If eBay gives us text/html, it's likely their anti-scraping page
    if (contentType.includes('text/html')) {
      console.log('[Image Proxy] Received HTML instead of an image - sending placeholder');
      
      // Send a placeholder image
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      const placeholderSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
          <rect width="400" height="600" fill="#f4f4f7"/>
          <text x="200" y="290" font-family="Arial" font-size="20" text-anchor="middle" fill="#333">Sports Card</text>
          <text x="200" y="320" font-family="Arial" font-size="14" text-anchor="middle" fill="#777">Image Unavailable</text>
        </svg>
      `;
      
      return res.send(Buffer.from(placeholderSvg));
    }
    
    // If response is neither image nor HTML, handle as error
    throw new Error(`Non-image content type received: ${contentType}`);
    
  } catch (error) {
    console.error(`[Image Proxy] Error fetching image:`, error.message);
    console.error(`[Image Proxy] Failed URL: ${url.substring(0, 100)}...`);
    
    // Send an error SVG image as response
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache for errors
    
    const errorSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
        <rect width="400" height="600" fill="#f8d7da"/>
        <text x="200" y="290" font-family="Arial" font-size="18" text-anchor="middle" fill="#721c24">Image Error</text>
        <text x="200" y="320" font-family="Arial" font-size="14" text-anchor="middle" fill="#721c24">${error.message.substring(0, 40)}</text>
      </svg>
    `;
    return res.status(500).send(Buffer.from(errorSvg));
  }
} 