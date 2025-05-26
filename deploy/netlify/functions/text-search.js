// Import only what we need
const axios = require('axios');
const cheerio = require('cheerio');

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
    
    // Simple response to test the function is working
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        query,
        message: "Market analyzer endpoint is working. This is a simplified version returning test data.",
        test: true,
        url
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