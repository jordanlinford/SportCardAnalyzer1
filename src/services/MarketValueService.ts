import { Card } from './CardService';
import { doc, getDocs, updateDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const BASE_URL = import.meta.env.VITE_SCRAPER_API;

if (!BASE_URL) {
  throw new Error('VITE_SCRAPER_API environment variable is not set');
}

interface CardPriceResult {
  price: number;
  source: string;
  timestamp: string;
}

interface CardDetails {
  player: string;
  year: string;
  set: string;
  number: string;
  condition: string;
}

export class MarketValueService {
  static async fetchCardMarketValue(card: Card): Promise<number | null> {
    try {
      const queryParams = {
        player: card.playerName,
        year: card.year,
        set: card.brand,
        number: card.cardNumber,
        condition: card.grade || 'ungraded',
      };

      const query = new URLSearchParams(queryParams as Record<string, string>).toString();
      const response = await fetch(`${BASE_URL}/api/fetch-price?${query}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.price || null;
    } catch (error) {
      console.error('Error fetching market value:', error);
      return null;
    }
  }

  static async fetchLatestCardPrice(cardDetails: CardDetails): Promise<CardPriceResult> {
    try {
      const queryParams = new URLSearchParams({
        player: cardDetails.player,
        year: cardDetails.year,
        set: cardDetails.set,
        number: cardDetails.number,
        condition: cardDetails.condition,
      });

      const response = await fetch(`${BASE_URL}/api/fetch-price?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch card price: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        price: data.price || 0,
        source: data.source || 'Unknown',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching card price:', error);
      throw error;
    }
  }

  static async updateAllCardValues(userId: string): Promise<void> {
    try {
      const cardsRef = collection(db, 'users', userId, 'cards');
      const snapshot = await getDocs(cardsRef);
      
      for (const docSnap of snapshot.docs) {
        const card = docSnap.data();
        try {
          const result = await this.fetchLatestCardPrice({
            player: card.playerName,
            year: card.year,
            set: card.cardSet,
            number: card.cardNumber,
            condition: card.condition || 'ungraded',
          });

          await updateDoc(docSnap.ref, {
            currentValue: result.price,
            lastUpdated: result.timestamp,
            priceSource: result.source,
          });
        } catch (error) {
          console.error(`Failed to update card ${card.playerName}:`, error);
          // Continue with the next card even if this one fails
          continue;
        }
      }
      // --- Value History Tracking ---
      // After all updates, calculate total value and write to value_history
      let totalValue = 0;
      const updatedSnapshot = await getDocs(cardsRef);
      updatedSnapshot.forEach(docSnap => {
        const card = docSnap.data();
        totalValue += card.currentValue || card.price || 0;
      });
      const valueHistoryRef = collection(db, 'users', userId, 'value_history');
      await addDoc(valueHistoryRef, {
        timestamp: Timestamp.now(),
        totalValue
      });
      // --- End Value History Tracking ---
    } catch (error) {
      console.error('Error updating card values:', error);
      throw error;
    }
  }
} 