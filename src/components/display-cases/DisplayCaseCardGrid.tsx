import React, { useRef, useEffect } from 'react';
import { Card } from '../../types/Card';

interface DisplayCaseCardGridProps {
  cards: Card[];
}

/**
 * A specialized grid component for cards in display cases that enforces a 4-column layout
 * using direct DOM manipulation after render
 */
export const DisplayCaseCardGrid: React.FC<DisplayCaseCardGridProps> = ({ cards }) => {
  const gridRef = useRef<HTMLDivElement>(null);

  // Use effect to enforce 4-column layout after component renders
  useEffect(() => {
    if (gridRef.current) {
      console.log("DisplayCaseCardGrid: Enforcing 4-column layout");
      const grid = gridRef.current;
      
      // Apply direct styling with !important
      grid.style.cssText = `
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        width: 100% !important;
        gap: 1rem !important;
      `;
      
      // For better mobile experience, add additional styles if needed
      const handleResize = () => {
        if (window.innerWidth < 768) {
          grid.style.cssText = `
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            width: 100% !important;
            gap: 1rem !important;
          `;
        } else if (window.innerWidth < 1024) {
          grid.style.cssText = `
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            width: 100% !important;
            gap: 1rem !important;
          `;
        } else {
          grid.style.cssText = `
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            width: 100% !important;
            gap: 1rem !important;
          `;
        }
      };
      
      // Call immediately
      handleResize();
      
      // Add resize listener
      window.addEventListener('resize', handleResize);
      
      // Clean up
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [cards]); // Re-apply when cards change

  if (!cards || cards.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No cards in this display case.
      </div>
    );
  }

  return (
    <div 
      ref={gridRef}
      className="display-card-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '1rem',
        width: '100%'
      }}
    >
      {cards.map((card: Card) => (
        <div key={card.id} className="relative group">
          {card.imageUrl ? (
            <>
              <img 
                src={card.imageUrl} 
                alt={`${card.playerName} ${card.year} ${card.cardSet}`}
                className="rounded-xl w-full shadow-md aspect-[2/3] object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center text-white text-sm rounded-xl p-2">
                <div className="text-center">
                  <div className="font-semibold">{card.playerName}</div>
                  <div className="text-xs">{card.year} {card.cardSet}</div>
                  {card.price && (
                    <div className="text-xs mt-1">${card.price.toLocaleString()}</div>
                  )}
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
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default DisplayCaseCardGrid; 