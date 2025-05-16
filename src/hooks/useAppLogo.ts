import { useState, useEffect } from 'react';

// Import both logos with explicit relative paths
import mainLogo from '../assets/logos/logo-icon.png';
import fallbackLogo from '../assets/logos/2672ae7d-995c-4ff4-afc6-2920fc2f4f0f.png';

/**
 * Custom hook to handle logo loading with fallbacks
 * This ensures the app always has a logo, even in production
 */
export function useAppLogo() {
  const [logoUrl, setLogoUrl] = useState<string>(mainLogo);
  const [logoError, setLogoError] = useState<boolean>(false);
  
  useEffect(() => {
    // Test if the main logo loads properly
    const img = new Image();
    
    img.onload = () => {
      setLogoUrl(mainLogo);
      setLogoError(false);
      
      // Also update the document favicon to match
      updateFavicon(mainLogo);
    };
    
    img.onerror = () => {
      console.warn('Main logo failed to load, using fallback');
      setLogoUrl(fallbackLogo);
      setLogoError(true);
      
      // Try the fallback for favicon too
      updateFavicon(fallbackLogo);
    };
    
    // Trigger the load
    img.src = mainLogo;
  }, []);
  
  // Helper function to update favicon
  const updateFavicon = (imageUrl: string) => {
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
      favicon.setAttribute('href', imageUrl);
    } else {
      // Create a new favicon link if none exists
      const newFavicon = document.createElement('link');
      newFavicon.rel = 'icon';
      newFavicon.href = imageUrl;
      document.head.appendChild(newFavicon);
    }
  };
  
  return {
    logoUrl,
    logoError,
    mainLogo,
    fallbackLogo
  };
} 