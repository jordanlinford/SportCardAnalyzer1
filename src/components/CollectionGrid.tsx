import React from 'react';
import { Card } from '@/types/Card';
import { EmergencyDeleteButton } from '@/components/EmergencyDeleteButton';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink } from 'lucide-react';

interface CollectionGridProps {
  cards: Card[];
  onEditCard: (card: Card) => void;
  onUpdateCard?: (card: Card) => Promise<void>;
  updatingCardIds?: string[];
}

const CollectionGrid: React.FC<CollectionGridProps> = ({ 
  cards, 
  onEditCard, 
  onUpdateCard,
  updatingCardIds = []
}) => {
  const queryClient = useQueryClient();

  if (!cards || cards.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No cards in your collection yet. Add your first card!
      </div>
    );
  }

  const handleCardDeleted = () => {
    // Refetch cards after deletion
    queryClient.invalidateQueries({ queryKey: ["cards"] });
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className="relative group cursor-pointer"
          onClick={() => onEditCard(card)}
        >
          {/* Action buttons */}
          <div className="absolute top-2 right-2 z-10 flex space-x-1">
            <div onClick={(e) => e.stopPropagation()}>
              <EmergencyDeleteButton
                cardId={card.id}
                onDeleted={handleCardDeleted}
              />
            </div>
            
            {/* Update button */}
            {onUpdateCard && (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white"
                  onClick={() => onUpdateCard(card)}
                  disabled={updatingCardIds.includes(card.id)}
                >
                  {updatingCardIds.includes(card.id) ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            
            {/* eBay search button */}
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white"
                title="Check on eBay"
                onClick={() => {
                  // Create a full search string for eBay
                  const searchQuery = `${card.year} ${card.playerName} ${card.cardSet} ${card.variation || ''} ${card.cardNumber} ${card.condition || ''}`;
                  // Open eBay search in a new tab
                  window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&_sacat=0&LH_Complete=1&LH_Sold=1`, '_blank');
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {card.imageUrl ? (
            <>
              <img
                src={card.imageUrl}
                alt={`${card.playerName} ${card.year} ${card.cardSet}`}
                className="rounded-xl w-full shadow-md aspect-[2/3] object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white text-sm rounded-xl p-2">
                <div className="text-center p-3">
                  <div className="font-semibold mb-1">{card.playerName}</div>
                  <div className="text-xs mb-1">{card.year} {card.cardSet}</div>
                  {card.variation && (
                    <div className="text-xs mb-1">Variation: {card.variation}</div>
                  )}
                  {card.condition && (
                    <div className="text-xs mb-1">Condition: {card.condition}</div>
                  )}
                  <div className="text-xs mt-2 flex justify-between">
                    <span>Paid: ${(card.pricePaid || 0).toFixed(2)}</span>
                    <span>Value: ${(card.currentValue || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl w-full shadow-md aspect-[2/3] bg-gray-100 flex items-center justify-center">
              <div className="text-center p-4">
                <div className="font-semibold">{card.playerName}</div>
                <div className="text-xs text-gray-600">
                  {card.year} {card.cardSet}
                </div>
                {card.variation && (
                  <div className="text-xs text-gray-600">Var: {card.variation}</div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CollectionGrid; 