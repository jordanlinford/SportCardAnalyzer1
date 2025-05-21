import { Card } from '../types/Card';
import { updateCardValue } from './TradeEbayService';

export interface TradeResult {
  valueSideA: number;
  valueSideB: number;
  recommendation: "Accept" | "Decline" | "Fair Trade";
  difference: number;
  percentageDifference: number;
  riskLevel: "Low" | "Medium" | "High";
  potentialGrowth: {
    sideA: number;
    sideB: number;
  };
}

export interface SavedTrade {
  id: string;
  name: string;
  date: string;
  cardsA: Card[];
  cardsB: Card[];
  result: TradeResult;
}

/**
 * Analyzes a trade between two sets of cards and provides a recommendation
 */
export async function analyzeTrade(sideA: Card[], sideB: Card[]): Promise<TradeResult> {
  // Update market values for all cards
  const [updatedSideA, updatedSideB] = await Promise.all([
    Promise.all(sideA.map(updateCardValue)),
    Promise.all(sideB.map(updateCardValue))
  ]);
  
  // Calculate total current value for each side
  const valueSideA = updatedSideA.reduce((sum, card) => sum + (card.currentValue || 0), 0);
  const valueSideB = updatedSideB.reduce((sum, card) => sum + (card.currentValue || 0), 0);
  
  // Calculate absolute and percentage differences
  const difference = valueSideA - valueSideB;
  
  // Avoid division by zero
  const percentageDifference = valueSideA > 0 ? 
    (difference / valueSideA) * 100 : 
    (valueSideB > 0 ? -100 : 0);
  
  // Determine recommendation based on percentage difference
  let recommendation: TradeResult["recommendation"] = "Fair Trade";
  
  if (Math.abs(percentageDifference) < 5) {
    recommendation = "Fair Trade";
  } else if (difference > 0) {
    recommendation = "Decline"; // You're giving up more value
  } else {
    recommendation = "Accept"; // You're getting more value
  }
  
  // Calculate risk level based on volatility of cards
  const riskLevel = calculateRiskLevel(updatedSideA, updatedSideB);
  
  // Calculate potential growth based on recent trends
  const potentialGrowth = {
    sideA: calculatePotentialGrowth(updatedSideA),
    sideB: calculatePotentialGrowth(updatedSideB)
  };

  return { 
    valueSideA, 
    valueSideB, 
    difference, 
    percentageDifference,
    recommendation, 
    riskLevel,
    potentialGrowth
  };
}

/**
 * Calculates the risk level of a trade based on card volatility
 */
function calculateRiskLevel(sideA: Card[], sideB: Card[]): "Low" | "Medium" | "High" {
  // Determine risk level based on number of cards, value, and market trends
  const totalCards = sideA.length + sideB.length;
  const totalValue = sideA.reduce((sum, card) => sum + (card.currentValue || 0), 0) +
                     sideB.reduce((sum, card) => sum + (card.currentValue || 0), 0);
  
  // Simple risk heuristic
  if (totalCards > 5 || totalValue > 1000) {
    return "High";
  } else if (totalCards > 2 || totalValue > 250) {
    return "Medium";
  } else {
    return "Low";
  }
}

/**
 * Estimates potential growth for a set of cards
 */
function calculatePotentialGrowth(cards: Card[]): number {
  // Calculate average growth potential based on cards' market trends
  if (cards.length === 0) return 0;
  
  // Use price history if available, otherwise use a conservative estimate
  const growthPotential = cards.reduce((sum, card) => {
    // If we have predictions, use the 90-day growth rate
    if (card.price && card.currentValue && card.currentValue > card.price) {
      const growthRate = (card.currentValue - card.price) / card.price;
      return sum + (growthRate * 0.5 * card.currentValue); // Apply half of historical growth rate
    }
    
    // Default conservative 5% expected growth
    return sum + ((card.currentValue || 0) * 0.05);
  }, 0);
  
  return growthPotential;
}

/**
 * Calculates the fair market value for a specific card
 * This function would typically call other market analysis functions
 */
export function calculateCardMarketValue(card: Card): number {
  // Use current value if available
  if (card.currentValue && card.currentValue > 0) {
    return card.currentValue;
  }
  
  // Use price if available
  if (card.price && card.price > 0) {
    return card.price;
  }
  
  // Use price paid if available
  if (card.pricePaid && card.pricePaid > 0) {
    return card.pricePaid;
  }
  
  // Default to 0 if no values are available
  return 0;
}

/**
 * Saves a trade to local storage
 */
export function saveTrade(name: string, cardsA: Card[], cardsB: Card[], result: TradeResult): SavedTrade {
  const savedTrades = getSavedTrades();
  
  const newTrade: SavedTrade = {
    id: generateTradeId(),
    name,
    date: new Date().toISOString(),
    cardsA,
    cardsB,
    result
  };
  
  savedTrades.push(newTrade);
  localStorage.setItem('savedTrades', JSON.stringify(savedTrades));
  
  return newTrade;
}

/**
 * Gets all saved trades from local storage
 */
export function getSavedTrades(): SavedTrade[] {
  const savedTradesJson = localStorage.getItem('savedTrades');
  if (!savedTradesJson) return [];
  
  try {
    return JSON.parse(savedTradesJson);
  } catch (e) {
    console.error('Error parsing saved trades', e);
    return [];
  }
}

/**
 * Deletes a saved trade from local storage
 */
export function deleteSavedTrade(tradeId: string): boolean {
  const savedTrades = getSavedTrades();
  const updatedTrades = savedTrades.filter(trade => trade.id !== tradeId);
  
  if (updatedTrades.length === savedTrades.length) {
    return false; // Trade not found
  }
  
  localStorage.setItem('savedTrades', JSON.stringify(updatedTrades));
  return true;
}

/**
 * Generates a unique ID for a trade
 */
function generateTradeId(): string {
  return `trade-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function isGraded(condition: string): boolean {
  if (!condition) return false;
  const normalized = condition.toUpperCase();
  return (
    normalized.includes("PSA") ||
    normalized.includes("BGS") ||
    normalized.includes("SGC") ||
    normalized.includes("CGC")
  );
} 