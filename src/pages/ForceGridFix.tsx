import { useEffect, useRef } from 'react';

/**
 * This component uses direct DOM manipulation to enforce grid layout
 * It will find all grids on the page and force them to display 4 columns
 */
export function ForceGridFix() {
  useEffect(() => {
    // Create a style element and append it to the head
    const styleElement = document.createElement('style');
    styleElement.id = 'force-grid-styles';
    styleElement.innerHTML = `
      /* Display case grid styles */
      .display-case-grid, 
      .display-card-grid {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        gap: 1rem !important;
        width: 100% !important;
      }

      /* Responsive breakpoints */
      @media (max-width: 1023px) {
        .display-case-grid,
        .display-card-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }
      }

      @media (max-width: 767px) {
        .display-case-grid,
        .display-card-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }

      @media (max-width: 639px) {
        .display-case-grid,
        .display-card-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }

      /* Force grid containers to be full width */
      [class*="container"] {
        max-width: 100% !important;
      }
    `;

    // Append style element to head
    document.head.appendChild(styleElement);

    // Scan all grid elements on the page and enforce layout
    function enforceGridLayout() {
      setTimeout(() => {
        // Find display case grids and card grids
        const displayCaseGrids = document.querySelectorAll('.display-case-grid');
        const displayCardGrids = document.querySelectorAll('.display-card-grid');
        
        console.log("GridFixer: Found", displayCaseGrids.length, "display case grids and", displayCardGrids.length, "card grids");
        
        // Apply to display case grids
        displayCaseGrids.forEach(grid => {
          const htmlGrid = grid as HTMLElement;
          htmlGrid.style.cssText = `
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 1rem !important;
            width: 100% !important;
          `;
        });
        
        // Apply to card grids
        displayCardGrids.forEach(grid => {
          const htmlGrid = grid as HTMLElement;
          htmlGrid.style.cssText = `
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 1rem !important;
            width: 100% !important;
          `;
        });
      }, 500); // Delay to ensure DOM is fully loaded
    }

    // Call once at startup
    enforceGridLayout();

    // Set up MutationObserver to watch for DOM changes
    const observer = new MutationObserver((mutations) => {
      // If DOM has changed, enforce grid layout again
      enforceGridLayout();
    });

    // Start observing the document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // Clean up
    return () => {
      observer.disconnect();
      const styleEl = document.getElementById('force-grid-styles');
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
}

export default ForceGridFix; 