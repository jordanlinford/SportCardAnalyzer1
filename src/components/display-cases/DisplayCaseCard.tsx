import { DisplayCase } from "@/types/display-case";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Card } from "@/types/Card";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

interface DisplayCaseCardProps {
  displayCase: DisplayCase & { cards?: Card[] };
}

export default function DisplayCaseCard({ displayCase }: DisplayCaseCardProps) {
  const navigate = useNavigate();
  const [cardData, setCardData] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState<{[key: string]: boolean}>({});

  // Directly fetch card data if it wasn't provided
  useEffect(() => {
    if (displayCase.cards && displayCase.cards.length > 0) {
      // Cards already provided via the cards prop
      setCardData(displayCase.cards);
      return;
    }

    // If we have cardIds but no cards, fetch them directly
    if (displayCase.cardIds && displayCase.cardIds.length > 0) {
      setLoading(true);
      
      const fetchCards = async () => {
        try {
          // Keep track of which card IDs were successfully found
          const foundCards: Card[] = [];
          
          for (const cardId of displayCase.cardIds!) {
            let cardFound = false;
            
            // Try both possible collection paths
            try {
              const cardDoc = await getDoc(doc(db, "users", displayCase.userId, "collection", cardId));
              if (cardDoc.exists()) {
                foundCards.push({ 
                  id: cardDoc.id, 
                  ...cardDoc.data(),
                  tags: cardDoc.data().tags || [] 
                } as Card);
                cardFound = true;
              }
            } catch (err) {
              // Silent error handling
            }
            
            if (!cardFound) {
              try {
                const cardDoc = await getDoc(doc(db, "users", displayCase.userId, "cards", cardId));
                if (cardDoc.exists()) {
                  foundCards.push({ 
                    id: cardDoc.id, 
                    ...cardDoc.data(),
                    tags: cardDoc.data().tags || [] 
                  } as Card);
                  cardFound = true;
                }
              } catch (err) {
                // Silent error handling
              }
            }
            
            if (!cardFound) {
              // Try global cards collection as fallback
              try {
                const cardDoc = await getDoc(doc(db, "cards", cardId));
                if (cardDoc.exists()) {
                  foundCards.push({ 
                    id: cardDoc.id, 
                    ...cardDoc.data(),
                    tags: cardDoc.data().tags || [] 
                  } as Card);
                  cardFound = true;
                }
              } catch (err) {
                // Silent error handling
              }
            }
            
            if (!cardFound) {
              console.log(`Could not find card with ID: ${cardId} for display case ${displayCase.name}`);
            }
          }
          
          console.log(`Found ${foundCards.length} out of ${displayCase.cardIds!.length} cards for display case ${displayCase.name}`);
          setCardData(foundCards);
          setLoading(false);
        } catch (error) {
          console.error("Error fetching cards:", error);
          setLoading(false);
        }
      };
      
      fetchCards();
    }
  }, [displayCase]);

  const handleClick = (e: React.MouseEvent) => {
    navigate(`/display-cases/${displayCase.id}`);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    
    // Handle both Firestore Timestamp objects and regular Date objects
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "MMM d, yyyy");
  };

  // Function to handle image load errors
  const handleImageError = (cardId: string) => {
    setImageLoadErrors(prev => ({...prev, [cardId]: true}));
  };

  // Function to render a card placeholder with player name or ID
  const renderCardPlaceholder = (card: Card) => (
    <div 
      className="h-28 w-20 bg-gray-100 flex flex-col items-center justify-center text-xs rounded shadow-sm border border-gray-200 overflow-hidden"
    >
      {card.playerName ? (
        <>
          <div className="font-medium text-center px-1 text-gray-700">{card.playerName}</div>
          {card.year && <div className="text-[8px] text-center px-1 text-gray-500">{card.year}</div>}
        </>
      ) : (
        <>
          <div className="font-medium text-center px-1 text-gray-500">Card</div>
          <div className="text-[8px] text-center px-1 text-gray-400 overflow-hidden text-ellipsis">
            {card.id ? card.id.substring(0, 8) + "..." : "Unknown"}
          </div>
        </>
      )}
    </div>
  );

  // Function to render a card ID placeholder
  const renderIdPlaceholder = (cardId: string) => (
    <div 
      className="h-28 w-20 bg-gray-100 flex flex-col items-center justify-center text-xs rounded shadow-sm border border-gray-200 overflow-hidden"
    >
      <div className="font-medium text-center px-1 text-gray-600">Card</div>
      <div className="text-[8px] text-center px-1 text-gray-500 overflow-hidden text-ellipsis">
        {cardId.substring(0, 8)}...
      </div>
    </div>
  );

  return (
    <div 
      className="rounded-2xl border p-4 shadow hover:shadow-lg transition cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex justify-between items-start mb-1">
        <h3 className="text-lg font-semibold">{displayCase.name}</h3>
        {/* (Sync buttons removed – no longer necessary) */}
      </div>
      <p className="text-sm text-muted-foreground mb-2">
        Created on {formatDate(displayCase.createdAt)}
      </p>

      {displayCase.tags && displayCase.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {displayCase.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-blue-100 rounded-full text-blue-700 border border-blue-200"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Display actual card images or placeholders */}
      <div className="h-32 relative border-t mt-2 pt-2 mb-2">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {loading ? (
            // Loading state
            <div className="flex items-center justify-center w-full h-28">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            </div>
          ) : cardData && cardData.length > 0 ? (
            // Display actual card images if we have cardData
            cardData.slice(0, 3).map((card) => (
              <div key={card.id} className="mr-2">
                {card.imageUrl && !imageLoadErrors[card.id] ? (
                  <img 
                    src={card.imageUrl} 
                    alt={card.playerName || "Card image"} 
                    className="h-28 w-20 object-cover rounded shadow-sm border border-gray-200"
                    onError={() => handleImageError(card.id)}
                    loading="lazy"
                  />
                ) : (
                  // Fallback if image is not available or failed to load
                  renderCardPlaceholder(card)
                )}
              </div>
            ))
          ) : displayCase.cardIds && displayCase.cardIds.length > 0 ? (
            // Fallback to showing card ID placeholders when no card data is found
            displayCase.cardIds.slice(0, 3).map((cardId) => (
              <div key={cardId} className="mr-2">
                {renderIdPlaceholder(cardId)}
              </div>
            ))
          ) : (
            // Empty display case or no cards found
            <div className="flex items-center justify-center w-full h-28 bg-gray-100 rounded-lg">
              <span className="text-sm text-gray-400">No cards in this display case</span>
            </div>
          )}
          
          {/* Show the +X indicator if more than 3 cards */}
          {((cardData && cardData.length > 3) || 
            (!cardData.length && displayCase.cardIds && displayCase.cardIds.length > 3)) && (
            <div className="flex items-center justify-center h-28 w-20 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm text-gray-500">
                +{(cardData.length > 0 ? cardData.length : displayCase.cardIds?.length || 0) - 3}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Stats display */}
      <div className="flex items-center space-x-4 mt-4 text-sm text-gray-500">
        <span title="Likes">❤️ {displayCase.likes || 0}</span>
        <span title="Comments">💬 {displayCase.comments?.length || 0}</span>
        <span title="Views">👁️ {displayCase.visits || 0}</span>
        {displayCase.isPublic && (
          <span title="Public" className="text-green-500">🌎 Public</span>
        )}
      </div>
    </div>
  );
} 