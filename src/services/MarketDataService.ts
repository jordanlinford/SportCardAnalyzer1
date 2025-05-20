import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export interface CardSale {
  price: number;
  date: string;
}

export interface CardMetrics {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  count: number;
}

export interface CardMarketData {
  id: string;
  year: string;
  cardNumber: string;
  grade: string;
  player: string;
  lastUpdated: Date;
  metrics: CardMetrics;
  sales: CardSale[];
}

/**
 * Retrieves market data for a specific card by search parameters
 */
export async function getCardMarketData(
  playerName: string,
  cardNumber?: string,
  year?: string,
  grade?: string
): Promise<CardMarketData[]> {
  try {
    const cardsRef = collection(db, 'cards');
    let q = query(cardsRef);
    
    // Add filters as available
    if (grade) {
      q = query(q, where('grade', '==', grade));
    }
    if (cardNumber) {
      q = query(q, where('cardNumber', '==', cardNumber));
    }
    if (year) {
      q = query(q, where('year', '==', year));
    }
    
    const querySnapshot = await getDocs(q);
    const results: CardMarketData[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<CardMarketData, 'id'>;
      results.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamp to Date
        lastUpdated: data.lastUpdated ? new Date((data.lastUpdated as any).seconds * 1000) : new Date(),
      });
    });

    // Filter by player name if specified (can't use in query due to substring matching)
    if (playerName) {
      return results.filter(card => 
        card.player.toLowerCase().includes(playerName.toLowerCase())
      );
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching card market data:', error);
    return [];
  }
}

/**
 * Get detailed market data for a specific card
 */
export async function getCardById(cardId: string): Promise<CardMarketData | null> {
  try {
    const cardRef = doc(db, 'cards', cardId);
    const cardSnap = await getDoc(cardRef);
    
    if (cardSnap.exists()) {
      const data = cardSnap.data() as Omit<CardMarketData, 'id'>;
      return {
        id: cardSnap.id,
        ...data,
        lastUpdated: data.lastUpdated ? new Date((data.lastUpdated as any).seconds * 1000) : new Date(),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching card by ID:', error);
    return null;
  }
} 