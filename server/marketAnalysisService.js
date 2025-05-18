// Analyze price trends and market data
async function analyzeMarketData(listings) {
  if (!listings || listings.length === 0) {
    return {
      averagePrice: 0,
      priceRange: { min: 0, max: 0 },
      priceTrend: 'neutral',
      marketInsights: []
    };
  }

  // Calculate basic statistics
  const prices = listings.map(l => l.price).filter(p => p !== null);
  const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Calculate price trend
  const sortedByDate = [...listings].sort((a, b) => new Date(a.dateSold) - new Date(b.dateSold));
  const recentPrices = sortedByDate.slice(-5).map(l => l.price);
  const priceTrend = calculatePriceTrend(recentPrices);

  // Generate market insights
  const insights = generateMarketInsights(listings, averagePrice);

  return {
    averagePrice,
    priceRange: { min: minPrice, max: maxPrice },
    priceTrend,
    marketInsights: insights
  };
}

// Calculate price trend based on recent sales
function calculatePriceTrend(recentPrices) {
  if (recentPrices.length < 2) return 'neutral';

  const priceChanges = [];
  for (let i = 1; i < recentPrices.length; i++) {
    priceChanges.push(recentPrices[i] - recentPrices[i - 1]);
  }

  const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
  
  if (avgChange > 0.1) return 'upward';
  if (avgChange < -0.1) return 'downward';
  return 'neutral';
}

// Generate market insights based on listing data
function generateMarketInsights(listings, averagePrice) {
  const insights = [];

  // Analyze price distribution
  const priceDistribution = analyzePriceDistribution(listings, averagePrice);
  insights.push(priceDistribution);

  // Analyze condition distribution
  const conditionInsight = analyzeConditionDistribution(listings);
  insights.push(conditionInsight);

  // Analyze seller performance
  const sellerInsight = analyzeSellerPerformance(listings);
  insights.push(sellerInsight);

  return insights;
}

// Analyze price distribution
function analyzePriceDistribution(listings, averagePrice) {
  const belowAvg = listings.filter(l => l.price < averagePrice).length;
  const aboveAvg = listings.filter(l => l.price > averagePrice).length;
  
  return {
    type: 'price_distribution',
    message: `${belowAvg} items sold below average price, ${aboveAvg} items sold above average price`
  };
}

// Analyze condition distribution
function analyzeConditionDistribution(listings) {
  const conditions = {};
  listings.forEach(l => {
    const condition = l.condition || 'Unknown';
    conditions[condition] = (conditions[condition] || 0) + 1;
  });

  const mostCommon = Object.entries(conditions)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    type: 'condition_distribution',
    message: `Most common condition: ${mostCommon[0]} (${mostCommon[1]} items)`
  };
}

// Analyze seller performance
function analyzeSellerPerformance(listings) {
  const sellers = {};
  listings.forEach(l => {
    const seller = l.seller || 'Unknown';
    sellers[seller] = (sellers[seller] || 0) + 1;
  });

  const topSeller = Object.entries(sellers)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    type: 'seller_performance',
    message: `Top seller: ${topSeller[0]} with ${topSeller[1]} sales`
  };
}

export { analyzeMarketData }; 