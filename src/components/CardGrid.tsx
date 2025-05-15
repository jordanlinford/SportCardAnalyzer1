import React from 'react';
import { Card } from '@/types/Card';

interface CardGridProps {
  cards: Card[];
  onCardClick?: (card: Card) => void;
}

export default function CardGrid({ cards, onCardClick }: CardGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((card) => (
        <div 
          key={card.id} 
          onClick={() => onCardClick && onCardClick(card)}
          className="relative aspect-[3/4] rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer touch-manipulation"
          role="button"
          tabIndex={0}
          aria-label={`Card: ${card.playerName || 'Unknown player'}`}
        >
          {card.imageUrl ? (
            <img 
              src={card.imageUrl} 
              alt={card.playerName || 'Card image'} 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center p-2">
              <span className="text-xs sm:text-sm text-gray-500 text-center line-clamp-3">
                {card.playerName || card.id}
              </span>
            </div>
          )}
          {card.currentValue && (
            <div className="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-1.5 py-0.5 m-1 rounded">
              ${card.currentValue.toFixed(2)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 