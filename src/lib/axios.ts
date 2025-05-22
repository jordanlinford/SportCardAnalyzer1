import axios from 'axios';

// Use the globally defined API_URL from env.js if available, otherwise use environment variable or fallback
const API_URL = (typeof window !== 'undefined' && (window as any).API_URL) || 
                import.meta.env.VITE_API_URL || 
                'http://localhost:3001';

// Log the API URL being used
console.log('Axios using API URL:', API_URL);

export const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Add request interceptor for authentication
axiosClient.interceptors.request.use(
  (config) => {
    // You can add any request preprocessing here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error:', error.response.data);
      
      // Handle specific error cases
      if (error.response.status === 401) {
        // Handle unauthorized
        console.error('Authentication error');
      } else if (error.response.status === 429) {
        // Handle rate limiting
        console.error('Rate limit exceeded');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
); 