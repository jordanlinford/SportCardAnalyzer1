import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { DisplayCase } from '@/lib/firebase/displayCases';
import { Card } from '@/types/Card';

const CACHE_TIMEOUT_MS = 60000; // 1 minute cache timeout

export function useDisplayCase(id: string | undefined) {
  console.log("useDisplayCase hook called with ID:", id);
  const [displayCase, setDisplayCase] = useState<DisplayCase | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  useEffect(() => {
    console.log("useDisplayCase useEffect triggered with ID:", id);
    
    const fetchDisplayCase = async () => {
      if (!id) {
        console.log("useDisplayCase: No ID provided, skipping fetch");
        setIsLoading(false);
        return;
      }

      // Check if we need to refetch (either first fetch or cache expired)
      const now = Date.now();
      if (lastFetchTime > 0 && now - lastFetchTime < CACHE_TIMEOUT_MS) {
        console.log("useDisplayCase: Using cached data, skipping fetch");
        return;
      }
      
      setIsLoading(true);
      setLastFetchTime(now);

      try {
        console.log("useDisplayCase: Starting fetch for display case with ID:", id);
        
        // Try to fetch from public_display_cases first (for public URLs)
        let displayCaseDoc = await getDoc(doc(db, 'public_display_cases', id));
        let collectionSource = 'public_display_cases';
        
        // If not found, try displayCases collection (legacy)
        if (!displayCaseDoc.exists()) {
          console.log("useDisplayCase: Not found in public_display_cases, trying displayCases collection");
          displayCaseDoc = await getDoc(doc(db, 'displayCases', id));
          collectionSource = 'displayCases';
          
          // If still not found, give up
          if (!displayCaseDoc.exists()) {
            console.log("useDisplayCase: Not found in displayCases collection either, display case not found");
            setDisplayCase(null);
            setIsLoading(false);
            return;
          }
        }

        console.log(`useDisplayCase: Display case found in ${collectionSource}:`, displayCaseDoc.id);
        const data = displayCaseDoc.data();
        console.log("useDisplayCase: Display case data:", data);
        
        // Check if userId is missing - this is critical for card loading
        if (!data.userId) {
          console.error("useDisplayCase: Display case is missing userId field which is required to fetch cards");
        }
        
        // Ensure cardIds is always a clean array of strings
        let cardIds: string[] = [];
        
        // Handle different potential formats of cardIds
        if (data.cardIds) {
          if (Array.isArray(data.cardIds)) {
            // Filter out any null, undefined, or empty strings
            cardIds = data.cardIds.filter(id => id && typeof id === 'string');
            console.log(`useDisplayCase: Found ${cardIds.length} valid card IDs in array`);
          } else if (typeof data.cardIds === 'string') {
            // If it's a single string, convert to array
            cardIds = [data.cardIds];
            console.log("useDisplayCase: cardIds was a string, converted to array:", cardIds);
          } else if (typeof data.cardIds === 'object') {
            // If it's an object (but not array), try to extract values
            console.log("useDisplayCase: cardIds is an object (not array):", data.cardIds);
            const objectCardIds = Object.values(data.cardIds).filter(id => id && typeof id === 'string');
            if (objectCardIds.length > 0) {
              cardIds = objectCardIds as string[];
              console.log("useDisplayCase: Extracted card IDs from object:", cardIds);
            }
          }
        }
        
        console.log("useDisplayCase: Final processed card IDs:", cardIds);
        
        const displayCaseData: DisplayCase = {
          id: displayCaseDoc.id,
          publicId: data.publicId || displayCaseDoc.id, // Use ID as fallback
          userId: data.userId,
          name: data.name || "Untitled Display Case",
          description: data.description || "",
          background: data.background || "default",
          isPublic: data.isPublic !== false, // Default to true
          cardIds: cardIds,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          likes: data.likes || 0,
          visits: data.visits || 0,
          comments: (data.comments || []).map((comment: any) => ({
            ...comment,
            timestamp: comment.timestamp?.toDate() || new Date()
          }))
        };

        setDisplayCase(displayCaseData);
        console.log("useDisplayCase: Display case data processed and set");

        // Fetch cards only if we have valid cardIds
        if (cardIds.length > 0) {
          console.log(`useDisplayCase: Attempting to fetch ${cardIds.length} cards for display case`);
          
          // Exit early if userId is missing to prevent silent failures
          if (!data.userId && cardIds.some(id => !id.startsWith('card'))) {
            console.error("useDisplayCase: Cannot fetch cards without userId field. Cards may not load.");
          }
          
          try {
            // Fetch each card individually for maximum reliability
            const cardsData: Card[] = [];
            const processingPromises = cardIds.map(async cardId => {
              if (!cardId) {
                console.warn("useDisplayCase: Skipping empty cardId");
                return;
              }
              
              try {
                // Try standard cards collection first
                console.log(`useDisplayCase: Fetching card: ${cardId}`);
                const cardDoc = await getDoc(doc(db, 'cards', cardId));
                
                if (cardDoc.exists()) {
                  const cardData = cardDoc.data();
                  cardsData.push({
                    id: cardDoc.id,
                    ...cardData,
                    // Ensure required fields exist
                    playerName: cardData.playerName || "Unknown Player",
                    year: cardData.year || "",
                    cardSet: cardData.cardSet || "",
                    imageUrl: cardData.imageUrl || ""
                  } as Card);
                  console.log(`useDisplayCase: Found card: ${cardDoc.id}`);
                  return;
                }
                
                // If card not in main collection and we have a userId, try user's collection
                if (data.userId) {
                  // First try the newer collection path (preferred)
                  const collectionRef = doc(db, 'users', data.userId, 'collection', cardId);
                  const collectionSnapshot = await getDoc(collectionRef);
                  
                  if (collectionSnapshot.exists()) {
                    const cardData = collectionSnapshot.data();
                    cardsData.push({
                      id: collectionSnapshot.id,
                      ...cardData,
                      playerName: cardData.playerName || "Unknown Player",
                      year: cardData.year || "",
                      cardSet: cardData.cardSet || "",
                      imageUrl: cardData.imageUrl || ""
                    } as Card);
                    console.log(`useDisplayCase: Found card in user collection path: ${cardId}`);
                    return;
                  }
                  
                  // Then try the older cards path
                  const cardsRef = doc(db, 'users', data.userId, 'cards', cardId);
                  const cardsSnapshot = await getDoc(cardsRef);
                  
                  if (cardsSnapshot.exists()) {
                    const cardData = cardsSnapshot.data();
                    cardsData.push({
                      id: cardsSnapshot.id,
                      ...cardData,
                      playerName: cardData.playerName || "Unknown Player",
                      year: cardData.year || "",
                      cardSet: cardData.cardSet || "",
                      imageUrl: cardData.imageUrl || ""
                    } as Card);
                    console.log(`useDisplayCase: Found card in user cards path: ${cardId}`);
                    return;
                  }
                }
                
                console.log(`useDisplayCase: Card not found: ${cardId}`);
                console.warn(`useDisplayCase: Tried following paths for card:\n- cards/${cardId}\n${data.userId ? `- users/${data.userId}/collection/${cardId}\n- users/${data.userId}/cards/${cardId}` : '- No user collection path (userId missing)'}`);
              } catch (err) {
                console.error(`useDisplayCase: Error fetching card ${cardId}:`, err);
              }
            });
            
            // Wait for all card fetching to complete
            await Promise.all(processingPromises);
            
            console.log(`useDisplayCase: Successfully fetched ${cardsData.length} of ${cardIds.length} cards`);
            setCards(cardsData);
          } catch (error) {
            console.error("useDisplayCase: Error fetching cards:", error);
            setCards([]);
          }
        } else {
          console.log("useDisplayCase: No card IDs found in display case");
          setCards([]);
        }
      } catch (error) {
        console.error('useDisplayCase: Error fetching display case:', error);
        setDisplayCase(null);
        setCards([]);
      } finally {
        console.log("useDisplayCase: Finished loading, setting isLoading to false");
        setIsLoading(false);
      }
    };

    fetchDisplayCase();
    
    return () => {
      console.log("useDisplayCase cleanup for ID:", id);
    };
  }, [id, lastFetchTime]);

  // Add a manual refresh function
  const refreshDisplayCase = useCallback(() => {
    setLastFetchTime(0); // Force a refresh by resetting the cache time
  }, []);

  return { displayCase, cards, isLoading, refreshDisplayCase };
} 