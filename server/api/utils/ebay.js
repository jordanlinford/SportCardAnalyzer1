// Helper functions for eBay-related operations

// Normalise incoming query strings
export function normalizeQuery(raw = '') {
  return raw
    .toUpperCase()
    // strip explicit grade numbers so we don't over-restrict ebay text search
    .replace(/\b(?:PSA|BGS|SGC|CGC)\s*\d{1,2}\b/g, '')
    .replace(/\b(?:GEM\s*MINT|RC|ROOKIE)\b/g, '')
    // keep the # symbol by turning it into a space-separated token instead of deleting it
    .replace(/[()]/g, ' ')
    .replace(/#/g, ' #')
    .replace(/\s+/g, ' ')
    .trim();
}

// Generate eBay URL for search
export function generateEbayUrl(query) {
  // Encode the search query for a URL
  const encodedQuery = encodeURIComponent(query);
  
  // Create a URL for eBay sold listings with the encoded query
  return `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sop=13&LH_Sold=1&LH_Complete=1`;
}

// Proxy eBay image URLs to bypass CORS/referer restrictions
export function proxyEbayImage(url = '') {
  if (!url || typeof url !== 'string') return '';
  
  try {
    // Only proxy eBay images
    if (!url.includes('ebayimg.com')) return url;
    
    // Convert to our proxy endpoint
    return `/api/ebay/image-proxy?url=${encodeURIComponent(url)}`;
  } catch (err) {
    console.warn('proxyEbayImage: failed', url.substring(0, 120), err.message);
    return url;
  }
}

// Helper function to detect card grade from title
export function detectGrade(title = '') {
  if (!title) return null;
  
  const gradeMatch = title.match(/\b(?:PSA|BGS|SGC|CGC)\s*(\d{1,2})\b/i);
  if (gradeMatch) {
    return {
      service: gradeMatch[1].toUpperCase(),
      grade: parseInt(gradeMatch[2], 10)
    };
  }
  
  return null;
} 