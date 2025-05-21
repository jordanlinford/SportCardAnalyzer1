import React, { createContext, useContext, useState, useEffect } from 'react';
import { Card } from '@/types/Card';

// Define the context value shape
interface TradeContextType {
  cardsA: Card[];
  cardsB: Card[];
  addCardToTrade: (card: Card, side: 'A' | 'B') => void;
  removeCardFromTrade: (cardId: string, side: 'A' | 'B') => void;
  clearTradeCards: (side?: 'A' | 'B') => void;
}

// Create the context with a default empty value
const TradeContext = createContext<TradeContextType>({
  cardsA: [],
  cardsB: [],
  addCardToTrade: () => {},
  removeCardFromTrade: () => {},
  clearTradeCards: () => {},
});

// Hook for using this context
export const useTradeContext = () => useContext(TradeContext);

// Provider component
export const TradeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // State for cards on both sides of the trade
  const [cardsA, setCardsA] = useState<Card[]>([]);
  const [cardsB, setCardsB] = useState<Card[]>([]);

  // Add a card to a specific side of the trade
  const addCardToTrade = (card: Card, side: 'A' | 'B') => {
    if (side === 'A') {
      // Don't add duplicates
      if (!cardsA.some(c => c.id === card.id)) {
        setCardsA(prevCards => [...prevCards, card]);
      }
    } else {
      // Don't add duplicates
      if (!cardsB.some(c => c.id === card.id)) {
        setCardsB(prevCards => [...prevCards, card]);
      }
    }
  };

  // Remove a card from a specific side
  const removeCardFromTrade = (cardId: string, side: 'A' | 'B') => {
    if (side === 'A') {
      setCardsA(prevCards => prevCards.filter(card => card.id !== cardId));
    } else {
      setCardsB(prevCards => prevCards.filter(card => card.id !== cardId));
    }
  };

  // Clear cards from one or both sides
  const clearTradeCards = (side?: 'A' | 'B') => {
    if (!side || side === 'A') {
      setCardsA([]);
    }
    if (!side || side === 'B') {
      setCardsB([]);
    }
  };

  // Provide the context value
  const contextValue: TradeContextType = {
    cardsA,
    cardsB,
    addCardToTrade,
    removeCardFromTrade,
    clearTradeCards,
  };

  return (
    <TradeContext.Provider value={contextValue}>
      {children}
    </TradeContext.Provider>
  );
};

export default TradeProvider; 