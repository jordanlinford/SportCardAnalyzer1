import React, { useState } from 'react';
import { useAppLogo } from '@/hooks/useAppLogo';
// Import the actual logo image
import logoImage from '../assets/logos/logo-icon.png';
// Also import the alternate logo
import altLogoImage from '../assets/logos/2672ae7d-995c-4ff4-afc6-2920fc2f4f0f.png';

export default function ChartLogo() {
  const { logoUrl, logoError } = useAppLogo();
  const [imgError, setImgError] = useState(false);
  
  // If both the hook reports an error and the img itself fails,
  // fall back to the SVG logo
  if (logoError && imgError) {
    return (
      <svg 
        width="48" 
        height="48" 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="h-12 w-12 text-black dark:text-white"
      >
        <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <rect x="6" y="14" width="2.5" height="4" fill="currentColor" />
        <rect x="11" y="10" width="2.5" height="8" fill="currentColor" />
        <rect x="16" y="6" width="2.5" height="12" fill="currentColor" />
        <path d="M4 10L9 6L19 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  
  // Try to display the image with error handling
  return (
    <img 
      src={logoUrl} 
      alt="Sports Card Analyzer Logo" 
      className="h-12 w-auto" 
      onError={() => setImgError(true)}
    />
  );
}

// Export the alternate logo component for flexibility
export function AltLogo() {
  return (
    <img 
      src={altLogoImage} 
      alt="Sports Card Analyzer Logo" 
      className="h-12 w-auto" 
    />
  );
} 