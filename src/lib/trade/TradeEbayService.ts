import { Card } from '../../types/Card';

interface EbayListing {
  title: string;
  price: number;
  shipping: number;
  totalPrice: number;
  dateSold: string;
  imageUrl: string;
  url: string;
  source: string;
}

/**
 * Updates a card's value based on eBay market data
 */
export async function updateCardValue(card: Card): Promise<Card> {
  try {
    // If the card already has a current value, return it
    if (card.currentValue) {
      return card;
    }

    // Fetch eBay market data
    const listings = await fetchCardMarketData(card);
    
    if (listings.length === 0) {
      // If no listings found, use the card's price or a default value
      card.currentValue = card.price || 0;
      return card;
    }
    
    // Calculate average price from recent sales
    const totalPrice = listings.reduce((sum, listing) => sum + listing.totalPrice, 0);
    const averagePrice = totalPrice / listings.length;
    
    // Update card value
    card.currentValue = averagePrice;
    
    // Update image URL if not already set
    if (!card.imageUrl && listings[0]?.imageUrl) {
      // Make sure image URLs are properly formatted
      let imageUrl = listings[0].imageUrl;
      
      // If this is an eBay image URL, handle it through our proxy to avoid CORS issues
      if (imageUrl.includes('ebayimg.com')) {
        // Use our backend proxy to serve the image
        imageUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      }
      
      card.imageUrl = imageUrl;
    }
    
    return card;
  } catch (error) {
    console.error('Error updating card value:', error);
    // Return card with original value or 0
    card.currentValue = card.price || 0;
    return card;
  }
}

/**
 * Fetches eBay market data for a card
 */
async function fetchCardMarketData(card: Card): Promise<EbayListing[]> {
  try {
    // Construct search query
    const query = buildSearchQuery(card);
    
    // Call backend API to fetch eBay data
    const response = await fetch(`/api/ebay-search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch eBay data');
    }
    
    const data = await response.json();
    
    // Process the listings to ensure image URLs are properly formatted
    const processedListings = (data.listings || []).map((listing: EbayListing) => {
      if (listing.imageUrl && listing.imageUrl.includes('ebayimg.com')) {
        // Use the image proxy to avoid CORS issues
        listing.imageUrl = `/api/image-proxy?url=${encodeURIComponent(listing.imageUrl)}`;
      }
      return listing;
    });
    
    return processedListings;
  } catch (error) {
    console.error('Error fetching eBay data:', error);
    return [];
  }
}

/**
 * Builds a search query for eBay based on card details
 */
function buildSearchQuery(card: Card): string {
  const parts = [
    card.playerName,
    card.year,
    card.cardSet,
    card.cardNumber && `#${card.cardNumber}`,
    card.condition,
    'card'
  ];
  
  // Filter out undefined/null values and join with spaces
  return parts.filter(Boolean).join(' ');
} 