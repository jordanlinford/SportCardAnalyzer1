import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/types/Card";

interface MiniCardGridProps {
  cardIds: string[];
}

export function MiniCardGrid({ cardIds }: MiniCardGridProps) {
  const [cardData, setCardData] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Debug logging for initial props
  console.log('[MiniCardGrid] Rendering with cardIds:', cardIds);
  console.log('[MiniCardGrid] User:', user?.uid);

  useEffect(() => {
    async function fetchCardData() {
      console.log('[MiniCardGrid] Starting fetchCardData with cardIds:', cardIds);
      
      if (!user?.uid || !cardIds?.length) {
        console.log('[MiniCardGrid] No user or cardIds, exiting early');
        setLoading(false);
        return;
      }

      try {
        const fetchedCards: Card[] = [];
        
        // For each card ID, try to fetch from Firestore
        for (const cardId of cardIds.slice(0, 4)) {
          console.log(`[MiniCardGrid] Fetching card ${cardId}`);
          let cardDoc = null;
          
          // Try both possible locations
          try {
            // First try collection path
            console.log(`[MiniCardGrid] Trying collection path for ${cardId}`);
            const collectionRef = doc(db, "users", user.uid, "collection", cardId);
            const collectionSnapshot = await getDoc(collectionRef);
            
            if (collectionSnapshot.exists()) {
              console.log(`[MiniCardGrid] Found card ${cardId} in collection`);
              cardDoc = {
                id: collectionSnapshot.id,
                ...collectionSnapshot.data()
              } as Card;
              console.log(`[MiniCardGrid] Card data:`, cardDoc);
            } else {
              // Then try cards path
              console.log(`[MiniCardGrid] Trying cards path for ${cardId}`);
              const cardRef = doc(db, "users", user.uid, "cards", cardId);
              const cardSnapshot = await getDoc(cardRef);
              
              if (cardSnapshot.exists()) {
                console.log(`[MiniCardGrid] Found card ${cardId} in cards`);
                cardDoc = {
                  id: cardSnapshot.id,
                  ...cardSnapshot.data()
                } as Card;
                console.log(`[MiniCardGrid] Card data:`, cardDoc);
              } else {
                console.log(`[MiniCardGrid] Card ${cardId} not found in either location`);
              }
            }
          } catch (error) {
            console.error(`[MiniCardGrid] Error fetching card ${cardId}:`, error);
          }

          if (cardDoc) {
            console.log(`[MiniCardGrid] Adding card ${cardId} to fetchedCards array`);
            fetchedCards.push(cardDoc);
          }
        }

        console.log('[MiniCardGrid] All fetched cards:', fetchedCards);
        console.log('[MiniCardGrid] Cards with imageUrl:', fetchedCards.filter(c => c.imageUrl));
        setCardData(fetchedCards);
      } catch (error) {
        console.error("[MiniCardGrid] Error fetching card data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCardData();
  }, [cardIds, user]);

  console.log('[MiniCardGrid] Current state - loading:', loading, 'cardData:', cardData);

  if (loading) {
    return <div className="text-xs text-gray-400">Loading cards...</div>;
  }

  if (!cardData.length) {
    return <div className="text-xs text-amber-500">No cards found</div>;
  }

  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {cardData.map((card) => {
        console.log(`[MiniCardGrid] Rendering card ${card.id} with imageUrl:`, card.imageUrl);
        return card.imageUrl ? (
          <div key={card.id} className="w-16 h-20 overflow-hidden rounded border border-amber-200 bg-white">
            {/* Log the image URL being rendered */}
            {(() => { console.log(`[MiniCardGrid] Rendering image with src: ${card.imageUrl}`); return null; })()}
            <img 
              src={card.imageUrl} 
              alt={card.playerName || "Card"} 
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div key={card.id} className="w-16 h-20 flex items-center justify-center bg-gray-50 border border-amber-200 rounded">
            <span className="text-xs text-amber-700 text-center p-1">
              {card.playerName || "No Image"}
            </span>
          </div>
        );
      })}
    </div>
  );
} 