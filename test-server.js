const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Fallback image URLs by player (in case real eBay images fail)
const FALLBACK_IMAGES = {
  'default': [
    'https://placehold.co/500x700/e1e1e1/4a4a4a?text=Default+Card+1',
    'https://placehold.co/500x700/e1e1e1/4a4a4a?text=Default+Card+2',
    'https://placehold.co/500x700/e1e1e1/4a4a4a?text=Default+Card+3',
    'https://placehold.co/500x700/e1e1e1/4a4a4a?text=Default+Card+4'
  ],
  'stroud': [
    'https://placehold.co/500x700/0052A5/ffffff?text=CJ+Stroud+Base',
    'https://placehold.co/500x700/0052A5/ffffff?text=CJ+Stroud+Red+Green',
    'https://placehold.co/500x700/0052A5/ffffff?text=CJ+Stroud+Auto',
    'https://placehold.co/500x700/0052A5/ffffff?text=CJ+Stroud+Prizm'
  ],
  'mahomes': [
    'https://placehold.co/500x700/E31837/ffffff?text=Mahomes+Base',
    'https://placehold.co/500x700/E31837/ffffff?text=Mahomes+Gold',
    'https://placehold.co/500x700/E31837/ffffff?text=Mahomes+Auto',
    'https://placehold.co/500x700/E31837/ffffff?text=Mahomes+Silver'
  ],
  'brady': [
    'https://placehold.co/500x700/0a2342/ffffff?text=Brady+Base',
    'https://placehold.co/500x700/0a2342/ffffff?text=Brady+Refractor',
    'https://placehold.co/500x700/0a2342/ffffff?text=Brady+Auto',
    'https://placehold.co/500x700/0a2342/ffffff?text=Brady+Gold'
  ],
  'kelce': [
    'https://placehold.co/500x700/E31837/ffffff?text=Kelce+Base',
    'https://placehold.co/500x700/E31837/ffffff?text=Kelce+Prizm',
    'https://placehold.co/500x700/E31837/ffffff?text=Kelce+Auto',
    'https://placehold.co/500x700/E31837/ffffff?text=Kelce+Dragon+Scale'
  ]
};

// Define variations for each player
const COMMON_VARIATIONS = {
  'default': ['Base', 'Prizm', 'Autograph', 'Numbered'],
  'stroud': ['Base Rookie', 'Red & Green Prizm', 'Autograph Rookie', 'Silver Prizm'],
  'mahomes': ['Base', 'Gold Parallel', 'Autograph', 'Silver Prizm'],
  'brady': ['Base', 'Refractor', 'Autograph', 'Gold Parallel'],
  'kelce': ['Base', 'Silver Prizm', 'Autograph', 'Dragon Scale']
};

// Function to fetch real data from eBay
async function fetchEbayData(searchQuery) {
  try {
    // Create a search URL for eBay
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sacat=212&LH_Complete=1&LH_Sold=1&_sop=13&_ipg=60`;
    
    console.log(`Fetching eBay data from: ${url}`);
    
    // Make the HTTP request to eBay
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      },
      timeout: 10000, // 10 second timeout
    });
    
    // Parse the HTML response
    const $ = cheerio.load(response.data);
    const listings = [];
    
    // Extract listings from the search results
    $('.s-item__pl-on-bottom').each((index, element) => {
      try {
        // Skip the first element which is usually a prompt
        if (index === 0) return;
        
        const titleElement = $(element).find('.s-item__title');
        const title = titleElement.text().trim();
        
        // Skip "Shop on eBay" listings
        if (title.includes('Shop on eBay')) return;
        
        const priceText = $(element).find('.s-item__price').text().trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        
        const imageUrl = $(element).find('.s-item__image-img').attr('src');
        
        const itemUrl = $(element).find('a.s-item__link').attr('href');
        
        const dateText = $(element).find('.s-item__endedDate').text().trim();
        const date = new Date().toISOString(); // Current date as ISO string
        const dateSold = dateText.replace('Sold ', '');
        
        const shipping = 0; // Simplified for demo
        
        listings.push({
          title,
          price,
          shipping,
          totalPrice: price + shipping,
          imageUrl,
          url: itemUrl,
          date,
          dateSold,
          status: 'Sold'
        });
      } catch (error) {
        console.log(`Error parsing listing: ${error.message}`);
      }
    });
    
    console.log(`Successfully extracted ${listings.length} listings from eBay`);
    return listings;
  } catch (error) {
    console.error(`Error fetching eBay data: ${error.message}`);
    throw new Error(`Failed to fetch data from eBay: ${error.message}`);
  }
}

// Function to extract variation from listing title
function extractVariation(title, defaultVariations) {
  // Common card variations to look for
  const variationKeywords = {
    'base': 'Base',
    'rookie': 'Rookie',
    'prizm': 'Prizm',
    'refractor': 'Refractor',
    'auto': 'Autograph',
    'autograph': 'Autograph',
    'gold': 'Gold',
    'silver': 'Silver',
    'blue': 'Blue',
    'red': 'Red',
    'green': 'Green',
    'purple': 'Purple',
    'pink': 'Pink',
    'numbered': 'Numbered',
    'parallel': 'Parallel',
    'insert': 'Insert',
    'mosaic': 'Mosaic',
    'optic': 'Optic',
    'select': 'Select',
    'dragon': 'Dragon Scale',
    'scale': 'Scale',
    'patch': 'Patch',
    'jersey': 'Jersey'
  };
  
  // Check for each variation keyword in the title
  const lowerTitle = title.toLowerCase();
  
  for (const [keyword, variation] of Object.entries(variationKeywords)) {
    if (lowerTitle.includes(keyword)) {
      return variation;
    }
  }
  
  // For rookie cards
  if (lowerTitle.includes('rc') || lowerTitle.includes('rookie card')) {
    return 'Rookie';
  }
  
  // If no specific variation found, assume it's a base card
  return defaultVariations[0] || 'Base';
}

// Function to group listings by variation
function groupListingsByVariation(listings, defaultVariations) {
  const variationGroups = {};
  
  // First pass - group by variation
  listings.forEach(listing => {
    // Extract variation from title
    const variation = extractVariation(listing.title, defaultVariations);
    
    // Add variation to listing
    listing.variation = variation;
    
    // Initialize group if it doesn't exist
    if (!variationGroups[variation]) {
      variationGroups[variation] = {
        listings: [],
        totalPrice: 0,
        count: 0,
        imageUrls: new Set() // Track unique image URLs
      };
    }
    
    // Add listing to appropriate group
    variationGroups[variation].listings.push(listing);
    variationGroups[variation].totalPrice += listing.price;
    variationGroups[variation].count += 1;
    
    // Add image URL to set if it exists
    if (listing.imageUrl && typeof listing.imageUrl === 'string' && !listing.imageUrl.includes('undefined')) {
      variationGroups[variation].imageUrls.add(listing.imageUrl);
    }
  });
  
  // Convert to array format
  const groupedResults = Object.entries(variationGroups).map(([variation, group], index) => {
    // Find the best image URL for this variation
    let bestImageUrl = '';
    
    // If we have image URLs, use the first one
    if (group.imageUrls.size > 0) {
      bestImageUrl = Array.from(group.imageUrls)[0];
    } else {
      // Otherwise use a fallback based on player key
      const playerKey = getPlayerKey(group.listings[0]?.title || '');
      const fallbackImages = FALLBACK_IMAGES[playerKey] || FALLBACK_IMAGES.default;
      bestImageUrl = fallbackImages[index % fallbackImages.length];
    }
    
    return {
      id: `variation-${index}`,
      title: variation,
      variation: variation,
      representativeImageUrl: bestImageUrl,
      listings: group.listings,
      count: group.count,
      averagePrice: group.totalPrice / group.count
    };
  });
  
  console.log('Grouped listings:', groupedResults.map(g => ({ 
    variation: g.title, 
    count: g.count, 
    imageUrl: g.representativeImageUrl 
  })));
  
  return groupedResults;
}

// Function to get player key from name
function getPlayerKey(playerName) {
  const lowerName = playerName.toLowerCase();
  if (lowerName.includes('stroud')) return 'stroud';
  if (lowerName.includes('mahomes')) return 'mahomes';
  if (lowerName.includes('brady')) return 'brady';
  if (lowerName.includes('kelce')) return 'kelce';
  return 'default';
}

// API endpoint for scraping card data
app.post('/api/scrape-card', async (req, res) => {
  try {
    const { playerName, query, negKeywords = [] } = req.body;
    
    if (!playerName && !query) {
      return res.status(400).json({
        success: false,
        error: "Either playerName or query is required"
      });
    }
    
    // Use query if provided, otherwise use playerName
    const searchQuery = query || playerName;
    
    // Fetch real data from eBay
    const listings = await fetchEbayData(searchQuery);
    
    if (!listings || listings.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No listings found for the given search criteria"
      });
    }
    
    // Group listings by variation
    const groupedListings = groupListingsByVariation(
      listings,
      COMMON_VARIATIONS[getPlayerKey(playerName)] || COMMON_VARIATIONS.default
    );
    
    // Send response with success, listings and variation groups
    res.json({
      success: true,
      listings: listings,
      groupedListings: groupedListings,
      count: listings.length,
      variationCount: groupedListings.length,
      dataSource: 'ebay'
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while processing the request"
    });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Test server is running!');
});

// Test images endpoint to verify all images
app.get('/test-images', (req, res) => {
  const allImages = Object.entries(FALLBACK_IMAGES).map(([player, urls]) => {
    return {
      player,
      urls
    };
  });
  
  let html = `
    <html>
      <head>
        <title>Image Test</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 20px; }
          .player-section { margin-bottom: 30px; }
          .images { display: flex; flex-wrap: wrap; }
          .image-card { margin: 10px; border: 1px solid #ddd; padding: 10px; border-radius: 4px; }
          img { height: 200px; display: block; margin-bottom: 5px; }
          .url { font-size: 12px; word-break: break-all; max-width: 200px; }
        </style>
      </head>
      <body>
        <h1>Test Images</h1>
  `;
  
  allImages.forEach(({player, urls}) => {
    html += `
      <div class="player-section">
        <h2>${player.toUpperCase()}</h2>
        <div class="images">
    `;
    
    urls.forEach((url, index) => {
      const variation = COMMON_VARIATIONS[player]?.[index] || 'Variation ' + (index + 1);
      html += `
        <div class="image-card">
          <h3>${variation}</h3>
          <img src="${url}" alt="${player} ${variation}">
          <div class="url">${url}</div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  html += `
      </body>
    </html>
  `;
  
  res.send(html);
});

// Add a debug endpoint to test images
app.get('/api/debug-images', (req, res) => {
  const allImages = [];
  
  // Add fallback images
  Object.entries(FALLBACK_IMAGES).forEach(([key, images]) => {
    images.forEach(img => {
      allImages.push({
        type: 'fallback',
        player: key,
        url: img
      });
    });
  });
  
  // Generate HTML to show all images
  let html = `
    <html>
      <head>
        <title>Image Test</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 20px; }
          .images { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
          .image-card { border: 1px solid #ddd; padding: 10px; border-radius: 4px; }
          img { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; margin-bottom: 10px; }
          .url { font-size: 12px; word-break: break-all; }
          h2 { margin-top: 30px; }
        </style>
      </head>
      <body>
        <h1>Test Server Image Debugging</h1>
        <h2>Fallback Images</h2>
        <div class="images">
  `;
  
  allImages.forEach(img => {
    html += `
      <div class="image-card">
        <img src="${img.url}" alt="${img.player}" onerror="this.src='https://placehold.co/300x400?text=Error'" />
        <div>${img.player}</div>
        <div class="url">${img.url}</div>
      </div>
    `;
  });
  
  html += `
        </div>
        <h2>Make a Test Search</h2>
        <form onsubmit="event.preventDefault(); testSearch();">
          <input id="query" placeholder="Search term" style="padding: 8px; width: 300px;" />
          <button type="submit" style="padding: 8px 16px;">Search</button>
        </form>
        <div id="results" style="margin-top: 20px;"></div>
        
        <script>
          async function testSearch() {
            const query = document.getElementById('query').value;
            const results = document.getElementById('results');
            results.innerHTML = 'Searching...';
            
            try {
              const response = await fetch('/api/scrape-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerName: query, query })
              });
              
              const data = await response.json();
              
              let html = '<h3>Results</h3>';
              
              if (data.groupedListings && data.groupedListings.length > 0) {
                html += '<h4>Variations</h4><div class="images">';
                
                data.groupedListings.forEach(group => {
                  html += \`
                    <div class="image-card">
                      <img src="\${group.representativeImageUrl}" alt="\${group.title}" onerror="this.src='https://placehold.co/300x400?text=Error'" />
                      <div>\${group.title} (\${group.count})</div>
                      <div class="url">\${group.representativeImageUrl}</div>
                    </div>
                  \`;
                });
                
                html += '</div>';
              }
              
              results.innerHTML = html;
            } catch (error) {
              results.innerHTML = 'Error: ' + error.message;
            }
          }
        </script>
      </body>
    </html>
  `;
  
  res.send(html);
});

// Start the server
const PORT = process.env.PORT || 9876;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Main endpoint: http://localhost:${PORT}/`);
  console.log(`Image test page: http://localhost:${PORT}/test-images`);
}); 