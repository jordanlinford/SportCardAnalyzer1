import React, { useRef, useEffect } from 'react';
import { DisplayCase } from '../../types/display-case';
import DisplayCaseCard from './DisplayCaseCard';

interface DisplayCaseGridProps {
  displayCases: DisplayCase[];
}

/**
 * A specialized grid component for display cases that enforces a 4-column layout
 * using direct DOM manipulation after render
 */
export const DisplayCaseGrid: React.FC<DisplayCaseGridProps> = ({ displayCases }) => {
  const gridRef = useRef<HTMLDivElement>(null);

  // Use effect to enforce 4-column layout after component renders
  useEffect(() => {
    if (gridRef.current) {
      console.log("DisplayCaseGrid: Enforcing 4-column layout");
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
  }, [displayCases]); // Re-apply when display cases change

  if (!displayCases || displayCases.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        You haven't created any display cases yet.
      </div>
    );
  }

  return (
    <div 
      ref={gridRef} 
      className="display-case-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '1rem',
        width: '100%'
      }}
    >
      {displayCases.map((displayCase) => (
        <DisplayCaseCard key={displayCase.id} displayCase={displayCase} />
      ))}
    </div>
  );
};

export default DisplayCaseGrid; 