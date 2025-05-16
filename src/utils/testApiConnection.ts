import { API_URL } from "@/lib/firebase/config";
import axios from "axios";

/**
 * Tests connection to the market analyzer API
 * This can be used during app initialization to verify the API is working
 * 
 * @param playerName - Optional player name to include in the test request
 * @returns Promise with the connection test result
 */
export async function testMarketAnalyzerConnection(playerName = "LeBron James"): Promise<{
  success: boolean;
  message: string;
  environment: string;
  apiUrl: string;
}> {
  console.log("Testing market analyzer API connection...");
  console.log("API URL:", API_URL);
  
  const environment = import.meta.env.PROD ? "production" : "development";
  
  try {
    // Make a simple request to test the connection
    const response = await axios.post(`${API_URL}/market-analyzer`, {
      playerName,
      year: "2020",
      cardSet: "Prizm",
      grade: "any"
    }, {
      timeout: 10000 // 10 second timeout
    });
    
    if (response.data?.success) {
      console.log("Market analyzer API connection successful");
      return {
        success: true,
        message: "Connection successful",
        environment,
        apiUrl: API_URL
      };
    } else {
      console.warn("Market analyzer API returned unexpected response", response.data);
      return {
        success: false,
        message: `API returned unexpected response: ${JSON.stringify(response.data)}`,
        environment,
        apiUrl: API_URL
      };
    }
  } catch (error) {
    console.error("Market analyzer API connection failed:", error);
    
    // Get a useful error message
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else if (axios.isAxiosError(error)) {
      errorMessage = error.message;
      if (error.response) {
        errorMessage += ` (Status: ${error.response.status})`;
      }
    }
    
    return {
      success: false,
      message: `Connection failed: ${errorMessage}`,
      environment,
      apiUrl: API_URL
    };
  }
}

// Add a function to test alternative endpoints if the main one fails
export async function testAlternativeEndpoints(): Promise<{
  success: boolean;
  workingUrl: string | null;
}> {
  // List of alternative API URLs to try
  const alternativeUrls = [
    "https://sports-card-api.vercel.app/api",
    "https://sports-card-analyzer.vercel.app/api",
    "https://sports-card-analyzer-api.vercel.app/api",
    "https://sports-card-backend.vercel.app/api"
  ];
  
  for (const url of alternativeUrls) {
    try {
      console.log(`Trying alternative API URL: ${url}`);
      const response = await axios.post(`${url}/market-analyzer`, {
        playerName: "Test Player",
        grade: "any"
      }, {
        timeout: 5000 // 5 second timeout
      });
      
      if (response.data?.success) {
        console.log(`Found working API URL: ${url}`);
        return {
          success: true,
          workingUrl: url
        };
      }
    } catch (error) {
      console.log(`Alternative URL ${url} failed:`, error instanceof Error ? error.message : "Unknown error");
    }
  }
  
  return {
    success: false,
    workingUrl: null
  };
} 