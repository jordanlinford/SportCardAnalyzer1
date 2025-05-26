const axios = require('axios');

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: {
        'Allow': 'POST'
      }
    };
  }

  try {
    // Hardcode the backend URL to avoid environment variable size issues
    const BACKEND_URL = 'http://localhost:3001';
    
    // Get the request body
    const requestBody = JSON.parse(event.body);
    
    // Log the request for debugging
    console.log('Forwarding request to:', `${BACKEND_URL}/api/text-search`);
    console.log('Request body:', requestBody);
    
    // Make the request to our backend
    const response = await axios.post(
      `${BACKEND_URL}/api/text-search`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Return the response from our backend
    return {
      statusCode: response.status,
      body: JSON.stringify(response.data),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  } catch (error) {
    console.error('Proxy error:', error);
    
    // Return error details
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({
        error: 'Error proxying request',
        details: error.message,
        response: error.response?.data
      })
    };
  }
}; 