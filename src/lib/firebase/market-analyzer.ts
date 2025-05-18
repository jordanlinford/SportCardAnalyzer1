import { getAuth } from "firebase/auth";
import { axiosClient } from "@/lib/axios";
import { MarketAnalysisRequest, MarketAnalysisResponse } from "@/types/market";

/**
 * Analyzes the market for a specific card.
 * 
 * @param input - The market analysis request parameters
 * @returns Promise resolving to the market analysis results
 * @throws Error if user is not authenticated or API request fails
 */
export async function analyzeMarket(input: MarketAnalysisRequest): Promise<MarketAnalysisResponse> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User not authenticated");
  }

  try {
    const token = await user.getIdToken();

    const res = await axiosClient.post<MarketAnalysisResponse>("/api/market/analyze", input, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000, // 30 second timeout
    });

    if (!res.data) {
      throw new Error("No data received from market analysis");
    }

    // Validate response data
    if (!res.data.listings || !Array.isArray(res.data.listings)) {
      throw new Error("Invalid response format: missing or invalid listings array");
    }

    // Process and normalize the response data
    const processedData: MarketAnalysisResponse = {
      ...res.data,
      listings: res.data.listings.map(listing => ({
        ...listing,
        price: Number(listing.price) || 0,
        date: listing.date || new Date().toISOString(),
        imageUrl: listing.imageUrl || '',
        title: listing.title || 'Unknown Card',
        grade: listing.grade || 'ungraded',
        variation: listing.variation || 'base'
      }))
    };

    return processedData;
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific error cases
      if (error.message.includes('timeout')) {
        throw new Error("Request timed out. Please try again.");
      }
      if (error.message.includes('network')) {
        throw new Error("Network error. Please check your connection.");
      }
      if (error.message.includes('401')) {
        throw new Error("Authentication failed. Please log in again.");
      }
      throw new Error(`Market analysis failed: ${error.message}`);
    }
    throw new Error("Market analysis failed: Unknown error");
  }
} 