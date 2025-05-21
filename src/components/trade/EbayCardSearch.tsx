import { useState, useEffect } from 'react';
import { Search, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from '@/types/Card';
import axios from 'axios';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { API_URL } from '@/lib/firebase/config';

interface EbayCardSearchProps {
  onAddCard: (card: Card) => void;
}

interface ScrapedListing {
  title: string;
  price: number;
  shipping: number;
  totalPrice: number;
  date: string;
  dateSold: string;
  url: string;
  imageUrl: string;
  source: string;
}

interface GroupedListing {
  title: string;
  imageUrl?: string;
  averagePrice: number;
  listings: ScrapedListing[];
}

interface ScrapeResponse {
  success: boolean;
  listings: ScrapedListing[];
  count: number;
  query?: string;
  isSynthetic?: boolean;
}

export function EbayCardSearch({ onAddCard }: EbayCardSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [grading, setGrading] = useState('any');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<GroupedListing[]>([]);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      setSearchError('');
      setSearchResults([]);
      
      let fullQuery = searchQuery;
      if (grading !== 'any') {
        fullQuery += ` ${grading}`;
      }
      
      // Call the eBay scraping API
      const response = await fetch(`/api/ebay-search?q=${encodeURIComponent(fullQuery)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to search eBay: ${response.status} ${response.statusText}`);
      }
      
      const data: ScrapeResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.listings?.[0]?.title || 'Search failed');
      }
      
      if (data.listings.length === 0) {
        setSearchError('No results found. Try a different search query.');
        return;
      }
      
      // Process the listings to ensure images use the proxy
      const processedListings = data.listings.map((listing) => {
        if (listing.imageUrl && listing.imageUrl.includes('ebayimg.com')) {
          // Use the image proxy to avoid CORS issues
          listing.imageUrl = `/api/image-proxy?url=${encodeURIComponent(listing.imageUrl)}`;
        }
        return listing;
      });
      
      // Group and process the listings
      const groupedResults = processScrapedListings(processedListings);
      setSearchResults(groupedResults);
      
    } catch (error) {
      console.error('Error searching eBay:', error);
      setSearchError(error instanceof Error ? error.message : 'An error occurred while searching');
    } finally {
      setLoading(false);
    }
  };
  
  const processScrapedListings = (listings: ScrapedListing[]): GroupedListing[] => {
    // If no listings, return empty array
    if (!listings || listings.length === 0) return [];
    
    // Group listings by title similarity
    const groupedListings: GroupedListing[] = [];
    const processedTitles = new Set<string>();
    
    listings.forEach(listing => {
      // Skip if listing doesn't have a title or has been processed
      if (!listing.title || processedTitles.has(listing.title)) return;
      
      // Find similar listings
      const similarListings = listings.filter(l => 
        isSimilarTitle(listing.title, l.title)
      );
      
      // Calculate average price
      const totalPrice = similarListings.reduce((sum, l) => sum + l.price, 0);
      const averagePrice = totalPrice / similarListings.length;
      
      // Add to group
      groupedListings.push({
        title: listing.title,
        imageUrl: listing.imageUrl,
        averagePrice,
        listings: similarListings
      });
      
      // Mark as processed
      similarListings.forEach(l => processedTitles.add(l.title));
    });
    
    return groupedListings;
  };
  
  const isSimilarTitle = (title1: string, title2: string): boolean => {
    // Simple similarity check - in a real app this would be more sophisticated
    if (!title1 || !title2) return false;
    
    // Convert to lowercase
    const t1 = title1.toLowerCase();
    const t2 = title2.toLowerCase();
    
    // If one title contains the other, they're similar
    if (t1.includes(t2) || t2.includes(t1)) return true;
    
    // Check word overlap
    const words1 = t1.split(/\s+/);
    const words2 = t2.split(/\s+/);
    
    let matchCount = 0;
    for (const word of words1) {
      if (word.length > 3 && words2.includes(word)) matchCount++;
    }
    
    // If more than 50% of words match, consider them similar
    return matchCount > 0 && matchCount / Math.min(words1.length, words2.length) > 0.5;
  };
  
  const handleAddToTrade = (item: GroupedListing) => {
    try {
      // Use the first listing as a basis for the card
      const listing = item.listings[0];
      
      // Process image URL if it exists
      let imageUrl = item.imageUrl;
      if (imageUrl && imageUrl.includes('ebayimg.com') && !imageUrl.includes('/api/image-proxy')) {
        // Ensure we're using the image proxy
        imageUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      }
      
      // Create a card from the listing
      const card: Card = {
        id: `ebay-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
        playerName: extractPlayerName(listing.title),
        year: extractYear(listing.title),
        cardSet: extractCardSet(listing.title),
        cardNumber: extractCardNumber(listing.title),
        variation: extractVariation(listing.title),
        condition: extractGrade(listing.title),
        price: item.averagePrice,
        currentValue: item.averagePrice,
        imageUrl: imageUrl,
        ownerId: 'ebay',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'eBay'
      };
      
      // Add the card to the trade
      onAddCard(card);
      
      // Close the dialog
      setOpen(false);
      
      // Reset the search
      setSearchQuery('');
      setSearchResults([]);
      
    } catch (error) {
      console.error('Error adding card to trade:', error);
      toast.error('Failed to add card to trade. Please try again.');
    }
  };
  
  // Helper functions to extract card details from title
  const extractPlayerName = (title: string): string => {
    // This is a simple approach - in real app would use more sophisticated NER
    const words = title.split(/\s+/);
    return words.slice(0, 2).join(' ');
  };
  
  const extractYear = (title: string): string => {
    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? yearMatch[0] : '';
  };
  
  const extractCardSet = (title: string): string => {
    // Try to find common card set names
    const commonSets = ['Topps', 'Bowman', 'Prizm', 'Select', 'Donruss', 'Panini', 'Upper Deck', 'Fleer', 'Chrome'];
    
    for (const set of commonSets) {
      if (title.includes(set)) {
        // Try to get the full set name by looking at surrounding words
        const regex = new RegExp(`\\b\\w*\\s*${set}\\s*\\w*\\b`, 'i');
        const match = title.match(regex);
        if (match) return match[0];
        
        return set;
      }
    }
    
    return '';
  };
  
  const extractCardNumber = (title: string): string => {
    const numMatch = title.match(/#\s*(\d+)/);
    return numMatch ? numMatch[1] : '';
  };
  
  const extractVariation = (title: string): string => {
    // Common variations/parallels
    const variations = [
      'Refractor', 'Chrome', 'Gold', 'Silver', 'Black', 'Blue', 'Red', 'Green', 
      'Purple', 'Orange', 'Yellow', 'Pink', 'Atomic', 'Prizm', 'Holo', 'Holographic',
      'Parallel', 'SP', 'SSP', 'Auto', 'Autograph', 'Patch', 'Jersey', 'Relic', 
      'Insert', 'Rookie', 'RC', 'Base'
    ];
    
    for (const v of variations) {
      if (title.toLowerCase().includes(v.toLowerCase())) {
        return v;
      }
    }
    
    return '';
  };
  
  const extractGrade = (title: string): string => {
    const gradeMatch = title.match(/\b(PSA|BGS|SGC)\s*(\d+\.?\d*)/i);
    return gradeMatch ? `${gradeMatch[1]} ${gradeMatch[2]}` : 'Raw';
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };
  
  // Trim title for display
  const trimTitle = (title: string, maxLength: number = 40) => {
    return title.length > maxLength ? `${title.substring(0, maxLength)}...` : title;
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Search className="mr-2 h-4 w-4" />
          Add Cards from eBay
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Search eBay for Cards</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSearch} className="space-y-4 my-4">
          <div className="space-y-2">
            <Label htmlFor="searchQuery">Search for Cards</Label>
            <Input
              id="searchQuery"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. Jordan Love 2020 Donruss #304 PSA 10"
              required
            />
            <p className="text-xs text-gray-500">
              Enter a complete search like you would on eBay 
              (player name, year, card set, card number, etc.)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="grading">Grading Filter (Optional)</Label>
            <Select 
              value={grading} 
              onValueChange={setGrading}
            >
              <SelectTrigger id="grading">
                <SelectValue placeholder="Select grading" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Condition</SelectItem>
                <SelectItem value="PSA 10">PSA 10</SelectItem>
                <SelectItem value="PSA 9">PSA 9</SelectItem>
                <SelectItem value="PSA 8">PSA 8</SelectItem>
                <SelectItem value="BGS 9.5">BGS 9.5</SelectItem>
                <SelectItem value="BGS 9">BGS 9</SelectItem>
                <SelectItem value="Raw">Raw/Ungraded Only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Optional: Filter by card condition or grading.
              Including it in your search query also works.
            </p>
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>
          
          {searchError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p>{searchError}</p>
            </div>
          )}
        </form>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Search Results ({searchResults.length})</h3>
            <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto p-1">
              {searchResults.map((item, index) => (
                <div key={index} className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="grid grid-cols-[100px_1fr] gap-4 p-3">
                    <div className="h-32 overflow-hidden rounded-md bg-gray-100">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.title}
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=No+Image';
                          }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs text-center p-2">
                          No Image Available
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{trimTitle(item.title)}</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Similar listings: {item.listings.length}
                        </p>
                        <p className="text-base font-semibold mt-2">
                          {formatCurrency(item.averagePrice)}
                        </p>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="self-end mt-2"
                        onClick={() => handleAddToTrade(item)}
                      >
                        Add to Trade
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !loading && (
          <div className="text-center py-8 text-gray-500">
            Search for cards to see results
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 