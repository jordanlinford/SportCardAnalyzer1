// Simple API function with proper CORS headers
exports.handler = async (event) => {
  // CORS headers for preflight requests
  const headers = {
    "Access-Control-Allow-Origin": "*", // Allow requests from any origin
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers };
  }

  try {
    // Parse the incoming request body
    const requestBody = JSON.parse(event.body || '{"query":""}');
    const { query } = requestBody;

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

    console.log(`Processing card search for query: ${query}`);

    // Create a URL-friendly search query
    const encodedQuery = encodeURIComponent(query);
    
    // Construct the eBay completed listings URL
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sacat=0&LH_Complete=1&LH_Sold=1&rt=nc&_udlo=0.01`;
    
    // Mock response data
    const mockData = {
      success: true,
      query,
      count: 5,
      listings: [
        { title: "Sample Card 1", price: 99.99, dateSold: "2023-12-01", totalPrice: 110.99 },
        { title: "Sample Card 2", price: 149.99, dateSold: "2023-12-05", totalPrice: 160.99 },
        { title: "Sample Card 3", price: 79.99, dateSold: "2023-12-10", totalPrice: 90.99 },
        { title: "Sample Card 4", price: 189.99, dateSold: "2023-12-15", totalPrice: 200.99 },
        { title: "Sample Card 5", price: 129.99, dateSold: "2023-12-20", totalPrice: 140.99 }
      ],
      analysis: {
        trend: "Stable",
        volatility: 0.22,
        liquidity: 0.31,
        investment_rating: "Hold"
      },
      ebayUrl: url
    };

    // Return the mock data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mockData)
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