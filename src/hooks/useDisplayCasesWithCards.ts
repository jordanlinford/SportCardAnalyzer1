import { useState, useEffect } from "react";
import { useDisplayCases } from "./display/useDisplayCases";
import { DisplayCase } from "@/types/display-case";
import { Card } from "@/types/Card";
import { useAuth } from "@/context/AuthContext";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export function useDisplayCasesWithCards() {
  const [displayCasesWithCards, setDisplayCasesWithCards] = useState<(DisplayCase & { cards: Card[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Get display cases using existing hook
  const { displayCases, isLoading: isLoadingCases } = useDisplayCases();

  useEffect(() => {
    // Wait for display cases to load
    if (isLoadingCases || !user?.uid) {
      console.log("Still loading cases or user not authenticated, waiting...");
      setLoading(true);
      return;
    }
    
    if (!displayCases || displayCases.length === 0) {
      console.log("No display cases found after loading");
      setDisplayCasesWithCards([]);
      setLoading(false);
      return;
    }

    console.log("useDisplayCasesWithCards - Found display cases:", { 
      displayCasesCount: displayCases.length
    });
    
    if (displayCases.length > 0) {
      console.log("Sample display case cardIds:", displayCases[0]?.cardIds || []);
    }
    
    async function fetchCards() {
      try {
        // Ensure user exists (we already checked above, but TypeScript needs this)
        if (!user || !user.uid) {
          setLoading(false);
          return;
        }
        
        // Extract all card IDs needed from display cases
        const allCardIds = new Set<string>();
        if (displayCases) {
          displayCases.forEach(displayCase => {
            if (displayCase.cardIds && Array.isArray(displayCase.cardIds)) {
              displayCase.cardIds.forEach(id => allCardIds.add(id));
            }
          });
        }
        
        console.log(`Need to fetch ${allCardIds.size} unique card IDs from all display cases`);
        
        if (allCardIds.size === 0) {
          // No cards to fetch
          processDisplayCases([]);
          return;
        }
        
        // Fetch all cards from both possible paths
        const cardPaths = [
          collection(db, "users", user.uid, "cards"),
          collection(db, "users", user.uid, "collection")
        ];
        
        let allCards: Card[] = [];
        
        // Try first path
        try {
          const cardsSnapshot = await getDocs(cardPaths[0]);
          console.log(`Found ${cardsSnapshot.docs.length} cards in users/${user.uid}/cards`);
          
          const cardsFromFirstPath = cardsSnapshot.docs
            .filter(doc => allCardIds.has(doc.id)) // Only get cards we need
            .map(doc => ({
              ...doc.data(),
              id: doc.id,
              tags: doc.data().tags || [],
            } as Card));
          
          allCards = [...allCards, ...cardsFromFirstPath];
        } catch (error) {
          console.error("Error fetching from cards path:", error);
        }
        
        // Try second path
        try {
          const collectionSnapshot = await getDocs(cardPaths[1]);
          console.log(`Found ${collectionSnapshot.docs.length} cards in users/${user.uid}/collection`);
          
          const cardsFromSecondPath = collectionSnapshot.docs
            .filter(doc => allCardIds.has(doc.id)) // Only get cards we need
            .map(doc => ({
              ...doc.data(),
              id: doc.id,
              tags: doc.data().tags || [],
            } as Card));
          
          // Merge all cards, avoiding duplicates by id
          cardsFromSecondPath.forEach(card => {
            if (!allCards.some(existingCard => existingCard.id === card.id)) {
              allCards.push(card);
            }
          });
        } catch (error) {
          console.error("Error fetching from collection path:", error);
        }
        
        console.log(`Successfully fetched ${allCards.length} out of ${allCardIds.size} needed cards`);
        
        // Create a mapping of card ID to card object for quick lookup
        const cardMap = new Map<string, Card>();
        allCards.forEach(card => cardMap.set(card.id, card));
        
        // Debug
        if (allCards.length > 0) {
          console.log("Sample fetched card:", allCards[0]);
        }
        
        processDisplayCases(cardMap);
      } catch (error) {
        console.error("Error fetching cards:", error);
        setLoading(false);
      }
    }
    
    function processDisplayCases(cardMap: Map<string, Card> | Card[]) {
      // Ensure displayCases exist (we already checked above, but TypeScript needs this)
      if (!displayCases) {
        setLoading(false);
        return;
      }
      
      // Process each display case to attach its cards
      const enrichedDisplayCases = displayCases.map(displayCase => {
        // Find all cards that match the IDs in this display case
        const cardsInCase = displayCase.cardIds
          ? displayCase.cardIds
              .map(id => {
                // Check if we're using an array or a Map
                const matchedCard = Array.isArray(cardMap)
                  ? cardMap.find(card => card.id === id)
                  : cardMap.get(id);
                
                if (!matchedCard) {
                  console.log(`Card ID ${id} from display case ${displayCase.name} not found in cards collection`);
                }
                return matchedCard;
              })
              .filter(Boolean) as Card[]
          : [];
        
        console.log(`Display case ${displayCase.name} has ${displayCase.cardIds?.length || 0} cardIds, found ${cardsInCase.length} matching cards`);
        
        // Return the display case with its cards attached
        return {
          ...displayCase,
          cards: cardsInCase
        };
      });

      setDisplayCasesWithCards(enrichedDisplayCases);
      setLoading(false);
    }
    
    fetchCards();
  }, [displayCases, isLoadingCases, user]);

  return { 
    displayCases: displayCasesWithCards, 
    loading 
  };
} 