import { compareTwoStrings } from 'string-similarity';

// Types
export interface ScrapedListing {
  title: string;
  price: number;
  shipping: number;
  date: string;
  url: string;
  imageUrl: string;
  [key: string]: any;
}

export interface TargetCard {
  playerName: string;
  year: string;
  cardSet: string;
  variation?: string;
  grade?: string;
  rawOrGraded?: string;
}

export interface GroupedListing extends ScrapedListing {
  grade?: string;
  variation?: string;
  totalPrice?: number;
}

/**
 * Normalize text by removing special characters and converting to lowercase
 */
export function normalizeText(text: string): string {
  return text.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase();
}

/**
 * Check if a listing matches the target card based on fuzzy matching
 */
export function isMatch(listing: ScrapedListing, target: TargetCard): boolean {
  const title = normalizeText(listing.title || '');
  
  // Create a string of all target keywords
  const targetKeywords = [
    target.playerName,
    target.year,
    target.cardSet,
    target.variation || '',
    target.grade || ''
  ].filter(Boolean); // Filter out empty strings
  
  const keywordString = normalizeText(targetKeywords.join(' '));
  
  // Score the match using string similarity (0 to 1 where 1 is perfect match)
  const score = compareTwoStrings(title, keywordString);
  
  // Convert to percentage score and require 85% match (same as Python version)
  return score * 100 >= 85;
}

/**
 * Group sales by variation, filtering listings that match the target card
 */
export function groupVariationSales(
  scrapedListings: ScrapedListing[], 
  target: TargetCard
): GroupedListing[] {
  const grouped: GroupedListing[] = [];
  
  for (const listing of scrapedListings) {
    if (isMatch(listing, target)) {
      grouped.push({
        ...listing,
        grade: target.grade,
        variation: target.variation,
        // Calculate total price including shipping
        totalPrice: (listing.price || 0) + (listing.shipping || 0)
      });
    }
  }
  
  // Sort by date, newest first
  return grouped.sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * Calculate market metrics based on grouped listings
 */
export function calculateMarketMetrics(listings: GroupedListing[]) {
  // Ensure we have valid listings with prices
  const validListings = listings.filter(l => {
    const price = l.totalPrice || l.price || 0;
    return price > 0;
  });
  
  if (!validListings.length) {
    return {
      volatility: 0,
      trend: 50,
      demand: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0,
      priceRange: 0,
      salesCount: 0,
      recentTrend: 0
    };
  }
  
  // Extract prices, ensuring they are valid numbers
  const prices = validListings.map(l => {
    const price = l.totalPrice || l.price || 0;
    return isNaN(price) ? 0 : price;
  }).filter(p => p > 0); // Extra filter to ensure no zeros slip through
  
  if (!prices.length) {
    return {
      volatility: 0,
      trend: 50,
      demand: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0,
      priceRange: 0,
      salesCount: 0,
      recentTrend: 0
    };
  }
  
  // Basic statistics
  const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  
  // Calculate volatility (coefficient of variation)
  const variance = prices.reduce((sum, price) => sum + Math.pow(price - averagePrice, 2), 0) / prices.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Raw percentage (0-100) before scaling
  let volatilityPct = 0;
  if (standardDeviation > 0) {
    // Calculate coefficient of variation (CV) and scale it to be more intuitive
    // CV = (standard deviation / mean) * 100
    volatilityPct = (standardDeviation / Math.max(0.01, averagePrice)) * 100;
    
    // Scale the volatility to be more intuitive:
    // - CV of 0% = 0 (perfect stability)
    // - CV of 50% = 50 (moderate volatility)
    // - CV of 100% = 75 (high volatility)
    // - CV of 200%+ = 100 (extreme volatility)
    volatilityPct = Math.min(100, Math.max(0, volatilityPct * 0.75));
  }
  
  // ----- guarantee a floor so every card registers something -----
  if (validListings.length === 1) {
    // Single comp → minimal uncertainty
    volatilityPct = Math.max(volatilityPct, 5);
  } else if (volatilityPct === 0) {
    // Multiple comps but identical prices
    volatilityPct = 3;
  }
  
  // No need for additional scaling since we already scaled above
  const scaledVolatility = volatilityPct;
  
  // Calculate trend (direction of price movement)
  let trend = 50; // Neutral start
  let recentTrend = 0;
  
  try {
    if (validListings.length >= 3) {
      // Make sure listings are sorted by date, newest first
      const sortedListings = [...validListings].sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Split listings into "recent" and "older" halves
      const midpoint = Math.floor(sortedListings.length / 2);
      const recentListings = sortedListings.slice(0, midpoint);
      const olderListings = sortedListings.slice(midpoint);
      
      // Calculate averages, avoiding division by zero
      const recentAvg = recentListings.length > 0 
        ? recentListings.reduce((sum, l) => sum + (l.totalPrice || l.price || 0), 0) / recentListings.length
        : 0;
        
      const olderAvg = olderListings.length > 0
        ? olderListings.reduce((sum, l) => sum + (l.totalPrice || l.price || 0), 0) / olderListings.length
        : 0;
      
      // Calculate percent change, avoiding division by zero
      if (olderAvg > 0) {
        const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
        
        // Scale to 0-100 range centered at 50
        trend = Math.min(100, Math.max(0, 50 + percentChange * 2)); // Each percent moves trend score by 2 points
      }
      
      // Calculate recent trend over the last 3 sales
      const recent3 = sortedListings.slice(0, 3);
      if (recent3.length === 3) {
        const newest = recent3[0].totalPrice || recent3[0].price || 0;
        const oldest = recent3[2].totalPrice || recent3[2].price || 0;
        
        // Avoid division by zero
        if (oldest > 0) {
          recentTrend = ((newest - oldest) / oldest) * 100;
        }
      }
    }
  } catch (error) {
    console.error("Error calculating trend:", error);
    // Fallback to neutral trend
    trend = 50;
    recentTrend = 0;
  }
  
  return {
    volatility: Math.round(scaledVolatility),
    trend: Math.round(trend),
    demand: calculateDemand(validListings),
    averagePrice,
    minPrice,
    maxPrice,
    priceRange,
    salesCount: validListings.length,
    recentTrend
  };
}

/**
 * Calculate demand score based on frequency of sales
 */
function calculateDemand(listings: GroupedListing[]): number {
  if (listings.length < 2) return 0;
  
  try {
    // Get unique dates to see how many different days have sales
    const dates = listings.map(l => l.date?.split('T')[0] || '').filter(Boolean);
    if (dates.length < 2) return 0;
    
    const uniqueDates = new Set(dates);
    
    // Get date range in days
    const dateObjects = dates.map(d => new Date(d))
      .filter(d => !isNaN(d.getTime())) // Filter out invalid dates
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (dateObjects.length < 2) return 0;
    
    const oldestDate = dateObjects[0];
    const newestDate = dateObjects[dateObjects.length - 1];
    
    const dayRange = Math.max(1, Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate daily sales rate
    const salesPerDay = listings.length / dayRange;
    
    // Scale to 0-100 range
    return Math.min(100, Math.round(salesPerDay * 25 * 100)); // Scoring factor: 0.25 sales/day = 100 demand
  } catch (error) {
    console.error("Error calculating demand:", error);
    return 0;
  }
}

/**
 * Predict future prices based on trend data
 */
export function predictFuturePrices(listings: GroupedListing[], currentPrice: number, isRawCard: boolean = false) {
  // Ensure we have a valid current price
  if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {
    console.log("Invalid current price for prediction:", currentPrice);
    return {
      days30: 0,
      days60: 0,
      days90: 0
    };
  }
  
  try {
    // For raw cards - use a much more conservative approach
    if (isRawCard) {
      // For raw cards with limited data, use a very modest growth model
      const growthRate = 0.0025; // 0.25% growth per month for raw cards (very conservative)
      
      return {
        days30: currentPrice * (1 + growthRate),
        days60: currentPrice * (1 + growthRate * 1.8), // Slightly diminishing returns
        days90: currentPrice * (1 + growthRate * 2.4)  // Slightly diminishing returns
      };
    }
    
    // Default to slight increase if no data
    if (!listings || listings.length < 3) {
      // More conservative growth with limited data
      const growthRate = 0.01; // 1% growth per month
      return {
        days30: currentPrice * (1 + growthRate),
        days60: currentPrice * (1 + growthRate * 2),
        days90: currentPrice * (1 + growthRate * 3)
      };
    }
    
    // Calculate the trend from historical data
    // Extract and sort price data points by date
    const priceData: { date: Date, price: number }[] = [];
    
    // Process listings to extract date and price
    listings.forEach(listing => {
      // Make sure we have valid dates and prices
      if (!listing.dateSold && !listing.date) return;
      if (!listing.price && !listing.totalPrice) return;
      
      // Get date
      let dateStr = listing.dateSold || listing.date || '';
      if (!dateStr) return;
      
      // Ensure date is a string we can parse
      if (typeof dateStr !== 'string') {
        try {
          dateStr = dateStr.toString();
        } catch (e) {
          return; // Skip if we can't convert to string
        }
      }
      
      // Try to parse date
      let dateObj: Date;
      try {
        dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) return; // Skip invalid dates
      } catch (e) {
        return; // Skip unparseable dates
      }
      
      // Get price - prefer totalPrice if available
      const price = listing.totalPrice || listing.price;
      if (!price || price <= 0) return;
      
      // Add to our dataset
      priceData.push({
        date: dateObj,
        price: price
      });
    });
    
    // Sort by date ascending
    priceData.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // If we have less than 3 valid data points, use default growth
    if (priceData.length < 3) {
      const growthRate = isRawCard ? 0.0025 : 0.01;
      return {
        days30: currentPrice * (1 + growthRate),
        days60: currentPrice * (1 + growthRate * 2),
        days90: currentPrice * (1 + growthRate * 3)
      };
    }
    
    // Calculate linear regression to find trend
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    const baseDate = priceData[0].date.getTime();
    
    priceData.forEach(point => {
      // X is days since first date
      const x = (point.date.getTime() - baseDate) / (1000 * 60 * 60 * 24);
      const y = point.price;
      
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });
    
    const n = priceData.length;
    
    // Check for potential division by zero
    const denominator = (n * sumXX - sumX * sumX);
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = n !== 0 ? (sumY - slope * sumX) / n : currentPrice;
    
    // Safety check for invalid regression results
    if (isNaN(slope) || isNaN(intercept) || !isFinite(slope) || !isFinite(intercept)) {
      console.log("Invalid regression results:", { slope, intercept });
      // Fallback to simple growth model
      const growthRate = isRawCard ? 0.0025 : 0.01;
      return {
        days30: currentPrice * (1 + growthRate),
        days60: currentPrice * (1 + growthRate * 2),
        days90: currentPrice * (1 + growthRate * 3)
      };
    }
    
    // Calculate predicted future prices
    // For raw cards, dampen the slope (more conservative)
    const adjustedSlope = isRawCard ? slope * 0.3 : slope;
    
    // Predict prices at different points
    let days30Price = intercept + adjustedSlope * (30);
    let days60Price = intercept + adjustedSlope * (60);
    let days90Price = intercept + adjustedSlope * (90);
    
    // Ensure predictions are positive numbers
    days30Price = Math.max(0.01, isNaN(days30Price) ? currentPrice : days30Price);
    days60Price = Math.max(0.01, isNaN(days60Price) ? currentPrice : days60Price);
    days90Price = Math.max(0.01, isNaN(days90Price) ? currentPrice : days90Price);
    
    // Ensure predictions are not too extreme
    let maxIncreasePercent = isRawCard ? 1.1 : 1.3; // 10% for raw, 30% for graded max increase
    let minDecreasePercent = isRawCard ? 0.95 : 0.8; // 5% for raw, 20% for graded max decrease
    
    return {
      days30: Math.max(currentPrice * minDecreasePercent, Math.min(currentPrice * maxIncreasePercent, days30Price)),
      days60: Math.max(currentPrice * (minDecreasePercent * 0.98), Math.min(currentPrice * maxIncreasePercent * 1.05, days60Price)),
      days90: Math.max(currentPrice * (minDecreasePercent * 0.95), Math.min(currentPrice * maxIncreasePercent * 1.1, days90Price))
    };
  } catch (error) {
    // Fallback to very modest growth if anything fails
    console.error("Error predicting prices:", error);
    const growthRate = isRawCard ? 0.002 : 0.005;
    return {
      days30: currentPrice * (1 + growthRate),
      days60: currentPrice * (1 + growthRate * 1.5),
      days90: currentPrice * (1 + growthRate * 2)
    };
  }
}

/**
 * Calculate an overall market score based on individual metrics
 */
export function calculateOverallMarketScore(metrics: ReturnType<typeof calculateMarketMetrics> | null): number {
  if (!metrics) return 50; // Default middle score
  
  // Extract key metrics
  const { volatility, trend, demand } = metrics;
  
  // Weight factors (can be adjusted based on importance)
  // Trend is weighted highest as it's most predictive of future value
  const weights = {
    trend: 0.5,      // Future direction is most important
    demand: 0.3,     // Sales activity is next most important
    volatility: 0.2  // Price stability is least weighted
  };
  
  // Calculate weighted score - note that lower volatility is better
  const volatilityScore = 100 - volatility; // Invert volatility (lower is better in raw form)
  const overallScore = (
    (trend * weights.trend) + 
    (demand * weights.demand) + 
    (volatilityScore * weights.volatility)
  );
  
  // Round to nearest whole number
  return Math.round(Math.max(0, Math.min(100, overallScore)));
}

/**
 * Generate market recommendation with more detailed descriptions
 */
export function generateRecommendation(metrics: ReturnType<typeof calculateMarketMetrics> | null, roi: number = 0): {
  action: string;
  reason: string;
  details: string;
} {
  if (!metrics) {
    return {
      action: 'WATCH',
      reason: 'Insufficient data to make a recommendation.',
      details: 'Consider researching this card further before making investment decisions.'
    };
  }
  
  const { trend, volatility, demand } = metrics;
  const overallScore = calculateOverallMarketScore(metrics);
  
  // Default recommendation
  let action = 'HOLD';
  let reason = '';
  let details = '';
  
  // Determine action based on metrics
  if (trend > 70 && demand > 60 && volatility < 50) {
    action = 'BUY';
    reason = 'Strong positive trend with good demand and stable prices.';
    details = `The market for this card is showing excellent growth potential (trend: ${trend}%) with healthy demand (${demand}%) and relatively stable pricing (volatility: ${volatility}%). This combination typically indicates a card that may continue to appreciate in value.`;
  } else if (trend > 60 && demand > 50) {
    action = 'BUY';
    reason = 'Positive trend with decent demand shows growth potential.';
    details = `This card shows promising growth (trend: ${trend}%) with adequate market activity (demand: ${demand}%). While volatility is at ${volatility}%, the positive indicators suggest this could be a good addition to your collection.`;
  } else if (trend < 30 && volatility > 60) {
    action = 'SELL';
    reason = 'Downward trend with high price volatility suggests declining value.';
    details = `This card is showing concerning market signals with a downward trend (${trend}%) and high price instability (volatility: ${volatility}%). These conditions often precede further price drops.`;
  } else if (trend < 40 && demand < 50) {
    // Only recommend selling if BOTH trend AND demand are low
    action = 'SELL';
    reason = 'Market appears to be cooling with decreasing demand.';
    details = `With a weak market trend (${trend}%) and decreasing demand (${demand}%), this may indicate the market is cooling. Consider your position carefully.`;
  } else if (volatility > 70 && demand < 40) {
    action = 'WATCH';
    reason = 'High volatility with low demand indicates an unstable market.';
    details = `The combination of high price fluctuations (volatility: ${volatility}%) and weak buying interest (demand: ${demand}%) suggests waiting for the market to stabilize before making decisions.`;
  } else if (demand < 30) {
    action = 'WATCH';
    reason = 'Very low demand may make it difficult to sell.';
    details = `With minimal market activity (demand: ${demand}%), this card may be difficult to sell at a fair price. Consider waiting for increased collector interest.`;
  } else if (trend > 50 && demand > 40) {
    // Add explicit HOLD with positive reasoning for rising trends
    action = 'HOLD';
    reason = 'Positive price trend suggests continued growth potential.';
    details = `This card is showing good market metrics (trend: ${trend}%, demand: ${demand}%) with a positive price trajectory. If you own it, holding may be the best strategy to capture continued appreciation.`;
  } else {
    action = 'HOLD';
    reason = 'Stable market conditions with no strong indicators either way.';
    details = `This card is showing balanced market metrics (trend: ${trend}%, demand: ${demand}%, volatility: ${volatility}%) without any strong buy or sell signals. If you own it, holding may be best until clearer trends emerge.`;
  }
  
  // Adjust based on ROI if available
  if (roi > 50 && action !== 'SELL') {
    action = 'CONSIDER SELLING';
    reason = 'You have a significant ROI that may be worth securing.';
    details = `With your excellent ROI of ${roi.toFixed(1)}%, you might consider taking profits, especially if this card represents a significant portion of your collection value.`;
  } else if (roi < -20 && action !== 'BUY') {
    action = 'CONSIDER CUTTING LOSSES';
    reason = 'Significant negative ROI with no strong recovery indicators.';
    details = `Your current loss of ${Math.abs(roi).toFixed(1)}% combined with market metrics (trend: ${trend}%, demand: ${demand}%) suggests considering whether to reallocate your investment to more promising cards.`;
  }
  
  return { action, reason, details };
}

/**
 * Calculate potential profit from grading a raw card
 */
export function calculateGradingProfit(rawPrice: number, psa9Price: number, psa10Price: number, psa9Odds: number = 0.60, psa10Odds: number = 0.15) {
  // Standard costs (in USD)
  const gradingCosts = {
    psaRegular: 50,       // Regular PSA grading fee
    psaExpress: 150,      // Express PSA grading fee
    shippingToGrader: 15, // Shipping to grading company
    shippingToSeller: 5,  // Shipping to buyer after graded
    ebayFeePercent: 0.13  // 13% eBay fee (typical)
  };
  
  // Calculate expected value based on odds
  const expectedGradedValue = (psa9Price * psa9Odds) + (psa10Price * psa10Odds);
  
  // Calculate costs
  const totalCost = rawPrice + gradingCosts.psaRegular + gradingCosts.shippingToGrader + gradingCosts.shippingToSeller;
  
  // Calculate expected revenue after fees
  const expectedRevenue = expectedGradedValue * (1 - gradingCosts.ebayFeePercent);
  
  // Calculate profit
  const expectedProfit = expectedRevenue - totalCost;
  const roi = (expectedProfit / totalCost) * 100;
  
  // Calculate individual outcomes
  const psa9Profit = (psa9Price * (1 - gradingCosts.ebayFeePercent)) - totalCost;
  const psa10Profit = (psa10Price * (1 - gradingCosts.ebayFeePercent)) - totalCost;
  
  return {
    expectedProfit,
    roi,
    psa9Profit,
    psa10Profit,
    gradingCost: gradingCosts.psaRegular,
    totalCost,
    expectedValue: expectedGradedValue,
    ebayFee: gradingCosts.ebayFeePercent * expectedGradedValue
  };
}

/**
 * Format a number as currency
 */
export function formatCurrency(value: number): string {
  if (!value && value !== 0) return '$0';
  return '$' + value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

/**
 * Analyze sales data to extract trends
 */
export function analyzeSalesData(listings: GroupedListing[]): {
  prices: number[];
  dates: Date[];
  trend: number;
  volatility: number;
} {
  // Extract prices and dates
  const prices: number[] = [];
  const dates: Date[] = [];
  
  // Process each listing 
  for (const listing of listings) {
    if (listing.price > 0) {
      prices.push(listing.price);
      
      // Try to extract date
      let listingDate: Date | null = null;
      if (listing.dateSold) {
        try {
          listingDate = new Date(listing.dateSold);
        } catch {
          // Skip invalid dates
        }
      }
      
      if (!listingDate && listing.date) {
        try {
          listingDate = new Date(listing.date);
        } catch {
          // Skip invalid dates
        }
      }
      
      if (listingDate && !isNaN(listingDate.getTime())) {
        dates.push(listingDate);
      }
    }
  }
  
  // Calculate trend
  let trend = 50; // Default neutral trend
  if (prices.length >= 3 && dates.length >= 3) {
    // Sort data by date
    const sortedData = dates.map((date, index) => ({
      date: date.getTime(),
      price: prices[index] || 0
    })).sort((a, b) => a.date - b.date);
    
    // Simple linear regression
    const n = sortedData.length;
    const sumX = sortedData.reduce((sum, point) => sum + point.date, 0);
    const sumY = sortedData.reduce((sum, point) => sum + point.price, 0);
    const sumXY = sortedData.reduce((sum, point) => sum + (point.date * point.price), 0);
    const sumXX = sortedData.reduce((sum, point) => sum + (point.date * point.date), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Convert slope to a trend score (0-100)
    const avgPrice = sumY / n;
    const relativeTrend = (slope * 30 * 24 * 60 * 60 * 1000) / avgPrice; // Trend over 30 days
    
    // Map relative trend to 0-100 scale
    trend = 50 + (relativeTrend * 500); // Scale factor can be adjusted
    trend = Math.max(0, Math.min(100, trend)); // Clamp to 0-100
  }
  
  // Calculate volatility
  let volatility = 50; // Default medium volatility
  if (prices.length >= 2) {
    // Calculate standard deviation
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Relative volatility (coefficient of variation)
    const relativeVolatility = (stdDev / avgPrice);
    
    // Map to 0-100 scale
    volatility = relativeVolatility * 200; // Scale factor can be adjusted
    volatility = Math.max(0, Math.min(100, volatility)); // Clamp to 0-100
  }
  
  return {
    prices,
    dates,
    trend,
    volatility
  };
} 