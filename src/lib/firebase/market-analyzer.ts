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

    const res = await axiosClient.post<MarketAnalysisResponse>("/market_analyzer", input, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Market analysis failed: ${error.message}`);
    }
    throw new Error("Market analysis failed: Unknown error");
  }
} 