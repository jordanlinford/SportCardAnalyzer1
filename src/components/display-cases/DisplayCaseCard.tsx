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
          const promises = displayCase.cardIds!.map(async (cardId) => {
            // Try both possible collection paths
            try {
              const cardDoc = await getDoc(doc(db, "users", displayCase.userId, "collection", cardId));
              if (cardDoc.exists()) {
                return { id: cardDoc.id, ...cardDoc.data() } as Card;
              }
            } catch (err) {
              console.error(`Error fetching card ${cardId} from collection:`, err);
            }
            
            try {
              const cardDoc = await getDoc(doc(db, "users", displayCase.userId, "cards", cardId));
              if (cardDoc.exists()) {
                return { id: cardDoc.id, ...cardDoc.data() } as Card;
              }
            } catch (err) {
              console.error(`Error fetching card ${cardId} from cards:`, err);
            }
            
            // Try global cards collection as fallback
            try {
              const cardDoc = await getDoc(doc(db, "cards", cardId));
              if (cardDoc.exists()) {
                return { id: cardDoc.id, ...cardDoc.data() } as Card;
              }
            } catch (err) {
              console.error(`Error fetching card ${cardId} from global cards:`, err);
            }
            
            console.log(`Could not find card with ID: ${cardId}`);
            return null;
          });
          
          const results = await Promise.all(promises);
          const validCards = results.filter(Boolean) as Card[];
          console.log(`Found ${validCards.length} out of ${displayCase.cardIds!.length} cards for display case ${displayCase.name}`);
          setCardData(validCards);
          setLoading(false);
        } catch (error) {
          console.error("Error fetching cards:", error);
          setLoading(false);
        }
      };
      
      fetchCards();
    }
  }, [displayCase]);

  const handleClick = () => {
    navigate(`/display-case/${displayCase.id}`);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    
    // Handle both Firestore Timestamp objects and regular Date objects
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "MMM d, yyyy");
  };

  // Function to render a card placeholder with the ID for debugging
  const renderCardPlaceholder = (cardId: string) => (
    <div 
      className="h-28 w-20 bg-gray-200 flex flex-col items-center justify-center text-xs text-gray-500 rounded shadow-sm border border-gray-300 overflow-hidden"
    >
      <div className="font-medium text-center px-1 mb-1">ID:</div>
      <div className="text-[8px] text-center px-1 overflow-hidden text-ellipsis">{cardId.substring(0, 12)}...</div>
    </div>
  );

  return (
    <div 
      className="rounded-2xl border p-4 shadow hover:shadow-lg transition cursor-pointer"
      onClick={handleClick}
    >
      <h3 className="text-lg font-semibold mb-1">{displayCase.name}</h3>
      <p className="text-sm text-muted-foreground mb-2">
        Created on {formatDate(displayCase.createdAt)}
      </p>

      {displayCase.tags && displayCase.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {displayCase.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-muted rounded-full text-muted-foreground"
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
                {card.imageUrl ? (
                  <img 
                    src={card.imageUrl} 
                    alt={card.playerName || "Card image"} 
                    className="h-28 w-20 object-cover rounded shadow-sm border border-gray-200"
                  />
                ) : (
                  // Fallback if image is not available
                  <div 
                    className="h-28 w-20 bg-gray-200 flex items-center justify-center text-sm text-gray-500 rounded shadow-sm border border-gray-300"
                  >
                    {card.playerName?.substring(0, 10) || "Card"}
                  </div>
                )}
              </div>
            ))
          ) : displayCase.cardIds && displayCase.cardIds.length > 0 ? (
            // Fallback to showing card ID placeholders when no card data is found
            displayCase.cardIds.slice(0, 3).map((cardId) => (
              <div key={cardId} className="mr-2">
                {renderCardPlaceholder(cardId)}
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
            <div className="flex items-center justify-center h-28 w-20 bg-muted rounded-lg border border-gray-200">
              <span className="text-sm text-muted-foreground">
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
      </div>
    </div>
  );
} 