import { useState } from 'react';
import { Card } from "@/types/Card";
import { Button } from "@/components/ui/button";
import { useCards } from '@/hooks/useCards';
import { calculateCardMarketValue } from '@/lib/trade/TradeAnalyzer';
import { X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  side: "A" | "B";
  label?: string;
  selectedCards: Card[];
  onUpdate: (cards: Card[]) => void;
}

export function TradeInputSection({ side, label, selectedCards, onUpdate }: Props) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { data: userCards = [], isLoading } = useCards();
  const sideLabel = label || (side === "A" ? "You Give" : "You Receive");
  
  // Calculate the total value of selected cards
  const totalValue = selectedCards.reduce((sum, card) => 
    sum + calculateCardMarketValue(card), 0);
  
  // Handle adding a card to this side of the trade
  const handleAddCard = (card: Card) => {
    // Don't add duplicate cards
    if (selectedCards.some(c => c.id === card.id)) return;
    
    onUpdate([...selectedCards, card]);
  };
  
  // Handle removing a card from this side of the trade
  const handleRemoveCard = (cardId: string) => {
    onUpdate(selectedCards.filter(card => card.id !== cardId));
  };
  
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{sideLabel}</h2>
        <div className="text-right">
          <div className="text-sm text-gray-500">Total Value</div>
          <div className="font-bold text-lg">${totalValue.toFixed(2)}</div>
        </div>
      </div>
      
      {/* Selected cards display */}
      <div className="mb-4">
        {selectedCards.length === 0 ? (
          <div className="text-center py-8 text-gray-400 border border-dashed rounded-lg">
            No cards selected
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {selectedCards.map(card => (
              <div key={card.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center">
                  {card.imageUrl && (
                    <img 
                      src={card.imageUrl} 
                      alt={card.playerName}
                      className="w-12 h-16 object-cover rounded mr-3"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=No+Image';
                      }}
                    />
                  )}
                  <div>
                    <div className="font-medium">{card.playerName}</div>
                    <div className="text-sm text-gray-600">
                      {card.year} {card.cardSet} {card.cardNumber && `#${card.cardNumber}`}
                    </div>
                    <div className="text-sm text-gray-600">
                      {card.condition || 'Raw'}
                      {card.source === 'eBay' && ' • from eBay'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="mr-3 text-right">
                    <div className="font-medium">${calculateCardMarketValue(card).toFixed(2)}</div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleRemoveCard(card.id)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Card selector */}
      <div className="mt-4 space-y-2">
        {isPickerOpen ? (
          <div className="border rounded-lg p-3 mb-3 max-h-80 overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">Select from your collection</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsPickerOpen(false)}
              >
                Done
              </Button>
            </div>
            
            {isLoading ? (
              <div className="text-center py-4">Loading your cards...</div>
            ) : userCards.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No cards in your collection
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {userCards.map(card => (
                  <div 
                    key={card.id} 
                    className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-50
                      ${selectedCards.some(c => c.id === card.id) ? 'opacity-50' : ''}`
                    }
                    onClick={() => !selectedCards.some(c => c.id === card.id) && handleAddCard(card)}
                  >
                    <div className="flex items-center">
                      {card.imageUrl && (
                        <img 
                          src={card.imageUrl} 
                          alt={card.playerName}
                          className="w-10 h-14 object-cover rounded mr-3"
                        />
                      )}
                      <div>
                        <div className="font-medium">{card.playerName}</div>
                        <div className="text-sm text-gray-600">
                          {card.year} {card.cardSet} {card.cardNumber && `#${card.cardNumber}`}
                        </div>
                      </div>
                    </div>
                    <div>
                      ${calculateCardMarketValue(card).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <Button 
              variant="outline" 
              onClick={() => setIsPickerOpen(true)}
              className="w-full"
            >
              Add Cards from Collection
            </Button>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <h3 className="text-sm font-medium text-blue-800 mb-1">Need to find a card that's not in your collection?</h3>
              <p className="text-xs text-blue-700 mb-2">Use the Market Analyzer to evaluate cards and add them directly to this trade.</p>
              <Link to="/market-analyzer">
                <Button variant="outline" size="sm" className="w-full bg-white">
                  <span>Go to Market Analyzer</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 