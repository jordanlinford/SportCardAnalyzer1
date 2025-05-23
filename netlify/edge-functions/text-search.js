// Edge Function for text-search with CORS support
export default async (request, context) => {
  // Handle OPTIONS requests for CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json",
      },
    });
  }

  try {
    // Parse the request body if it's a POST request
    let requestBody = { query: "" };
    if (request.method === "POST") {
      try {
        requestBody = await request.json();
      } catch (error) {
        console.error("Error parsing request body:", error);
      }
    }

    const { query } = requestBody;

    if (!query) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing query parameter",
        }),
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Content-Type": "application/json",
          },
          status: 400,
        }
      );
    }

    // Log the search query
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
    return new Response(
      JSON.stringify(mockData),
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error processing request: ${error.message}`
      }),
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
}; 