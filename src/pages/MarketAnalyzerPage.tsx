import { useState, useEffect, useRef } from "react";
import { 
  Search, 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Calculator, 
  BadgePercent, 
  Plus, 
  RefreshCw,
  LineChart,
  Info,
  DatabaseIcon,
  ImageOff,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
// @ts-ignore -- ApexCharts has incomplete type definitions
import ReactApexChart from 'react-apexcharts';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useCards } from '@/hooks/useCards';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext'; // Add auth context
import { useUserSubscription } from "@/hooks/useUserSubscription";
import { nanoid } from 'nanoid';
import { useQueryClient } from '@tanstack/react-query';
import { CardService } from '@/services/CardService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';

// Import eBay scraper utilities
import { 
  ScrapedListing, 
  TargetCard, 
  GroupedListing,
  groupVariationSales,
  calculateMarketMetrics,
  predictFuturePrices,
  generateRecommendation,
  analyzeSalesData,
  formatCurrency,
  calculateOverallMarketScore,
  calculateGradingProfit
} from '@/utils/ebayScraper';

// Types
interface CardResult {
  id: string;
  playerName: string;
  year: string;
  cardSet: string;
  grade: string;
  condition: string;
  variation?: string;
  averagePrice: number;
  lastSold: string;
  listings: ScrapedListing[];
  imageUrl?: string;
  title?: string;
  totalSales?: number; // Add this property to fix linter error
}

interface MarketScores {
  volatility: number;
  trend: number;
  demand: number;
}

interface PriceData {
  date: string;
  price: number;
}

// Extended TargetCard with cardNumber
interface ExtendedTargetCard extends TargetCard {
  cardNumber?: string;
}

// Augment GroupedListing with listings for our internal use
interface GroupedListingWithListings extends GroupedListing {
  listings: ScrapedListing[];
}

// Add a new component for handling images with better error detection
interface CardImageProps {
  src: string;
  alt: string;
  className?: string;
}

// Helper function to enhance image URLs for better resolution
const enhanceImageUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return '';
  
  try {
    // Convert webp to jpg (ebay images often work better as jpg)
    if (url.endsWith('.webp')) {
      url = url.replace('.webp', '.jpg');
    }
    
    // Ensure HTTPS
    if (url.startsWith('http:')) {
      url = url.replace('http:', 'https:');
    }
    
    // Handle relative URLs
    if (url.startsWith('/')) {
      url = `https://www.ebay.com${url}`;
    }
    
    // Enhance eBay image URLs to get higher resolution versions
    if (url.includes('i.ebayimg.com')) {
      // Replace various size indicators with larger versions
      url = url
        .replace('s-l64', 's-l500')
        .replace('s-l96', 's-l500')
        .replace('s-l140', 's-l500')
        .replace('s-l225', 's-l500')
        .replace('s-l300', 's-l500');
    }
    
    // Add cache busting for retries - use a single query parameter
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}t=${Date.now()}`;
    
    return url;
  } catch (e) {
    console.error('Error enhancing image URL:', e);
    return url; // Return original URL if enhancement fails
  }
};

// Simple and resilient card image component
const CardImage = ({ src, alt, className = "" }: CardImageProps) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retries, setRetries] = useState(0);
  const [imageSrc, setImageSrc] = useState<string>('');
  const originalSrc = useRef<string>(src || '');
  
  // Use a reliable fallback image
  const fallbackImage = 'https://placehold.co/300x420?text=No+Image';
  
  // Helper to enhance and add params using URL API
  const buildImageUrl = (base: string, retryNum = 0) => {
    try {
      // Enhance the URL (webp->jpg, https, etc)
      let enhanced = enhanceImageUrl(base);
      // Use URL API for param manipulation
      const urlObj = new URL(enhanced, window.location.origin);
      if (retryNum > 0) {
        urlObj.searchParams.set('retry', retryNum.toString());
      } else {
        urlObj.searchParams.delete('retry');
      }
      urlObj.searchParams.set('t', Date.now().toString());
      // If the original src was absolute, preserve it
      if (/^https?:\/\//.test(base)) {
        return urlObj.href;
      } else {
        // For relative URLs, remove origin
        return urlObj.pathname + urlObj.search;
      }
    } catch (e) {
      // Fallback to original
      return base;
    }
  };
  
  // When the src prop changes, reset our state and enhance the URL
  useEffect(() => {
    if (src) {
      setError(false);
      setLoaded(false);
      setRetries(0);
      originalSrc.current = src;
      setImageSrc(buildImageUrl(src));
    } else {
      setError(true);
    }
  }, [src]);
  
  // Handle image load error with retries
  const handleError = () => {
    console.error(`Error loading image (attempt ${retries + 1}):`, imageSrc);
    if (retries < 2) {
      setRetries(retries + 1);
      setImageSrc(buildImageUrl(originalSrc.current, retries + 1));
    } else {
      // After 3 failures, show fallback
      console.error('Failed to load image after 3 attempts:', src);
      setError(true);
    }
  };
  
  // If there's no source or an error occurred, show the fallback
  if (!src || error) {
    return (
      <div className={`relative overflow-hidden rounded-lg bg-gray-100 ${className}`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
          <ImageOff className="h-10 w-10 text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">{alt || "Image Unavailable"}</span>
        </div>
        <img
          src={fallbackImage}
          alt={alt || "Card Image"}
          className="w-full h-full object-cover opacity-60"
          onLoad={() => console.log("Fallback image loaded successfully")}
          onError={() => console.error("Even fallback image failed to load")}
        />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg bg-gray-100 ${className}`}>
      {/* Always visible loading spinner until image loads */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}
      
      <img
        src={imageSrc}
        alt={alt || "Card"}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => {
          console.log('Image loaded successfully:', imageSrc);
          setLoaded(true);
        }}
        onError={handleError}
      />
    </div>
  );
};

// Helper functions
/**
 * Extract listings from grouped results
 */
function extractListingsFromGroup(group: GroupedListing): ScrapedListing[] {
  // If the group has listings property, use it
  if (group && 'listings' in group && Array.isArray(group.listings)) {
    return group.listings;
  }
  
  // Otherwise return an empty array
  return [];
}

/**
 * Generate price data series from listings
 */
function generatePriceDataFromListings(groupedListings: GroupedListing[]): PriceData[] {
  if (!groupedListings || groupedListings.length === 0) return [];
  
  const firstGroup = groupedListings[0];
  if (!firstGroup) return [];
  
  // Extract listings safely
  let listings: ScrapedListing[] = [];
  
  // Check if listings exist on the group
  if (firstGroup && 'listings' in firstGroup && Array.isArray(firstGroup.listings)) {
    listings = firstGroup.listings;
  } else if (Array.isArray(firstGroup)) {
    // If the group itself is an array of listings (for compatibility)
    listings = firstGroup as unknown as ScrapedListing[];
  }
  
  // If no listings found, return empty array
  if (listings.length === 0) return [];
  
  // Convert to price data points
  const priceData: PriceData[] = listings.map((listing: ScrapedListing) => ({
    date: listing.dateSold || listing.date?.split('T')[0] || new Date().toISOString().split('T')[0],
    price: listing.totalPrice || listing.price || 0
  })).filter(data => data.price > 0); // Ensure we only include valid prices
  
  // Sort by date, oldest first for chart display
  return priceData.sort((a: PriceData, b: PriceData) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

// Add the following type definitions at the top of the file
interface CardVariation {
  id: string;
  title: string;
  imageUrl?: string;
  averagePrice: number;
  listings: any[];
}

// Add imports
import { API_URL } from "@/lib/firebase/config";

console.log("[MarketAnalyzerPage] API_URL:", API_URL);

export default function MarketAnalyzerPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserSubscription();
  const { addCard } = useCards(); // still available elsewhere
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Form state
  const [playerName, setPlayerName] = useState("");
  const [cardYear, setCardYear] = useState("");
  const [cardSet, setCardSet] = useState("");
  const [cardVariation, setCardVariation] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [grading, setGrading] = useState("any");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearched, setIsSearched] = useState(false);
  
  // Add isLoadingAnalysis state
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  
  // Add search query state for the new single search field
  const [searchQuery, setSearchQuery] = useState("");
  
  // Results state
  const [results, setResults] = useState<CardResult[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardResult | null>(null);
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [marketScores, setMarketScores] = useState<MarketScores>({ volatility: 0, trend: 0, demand: 0 });
  const [predictions, setPredictions] = useState({ days30: 0, days60: 0, days90: 0 });
  const [pricePaid, setPricePaid] = useState<string>("");
  const [timeRange, setTimeRange] = useState<string>("30d");
  const [marketMetrics, setMarketMetrics] = useState<ReturnType<typeof calculateMarketMetrics> | null>(null);
  
  // Store original listings for filtering later
  const originalListings = useRef<ScrapedListing[]>([]);
  
  // Add a new state to track the step process
  const [analysisStep, setAnalysisStep] = useState<'search' | 'validate' | 'analyze'>('search');

  // Add state for grouped variations
  const [cardVariations, setCardVariations] = useState<Array<{
    id: string;
    title: string;
    originalTitle: string;
    imageUrl: string;
    count: number;
    averagePrice: number;
    sample: ScrapedListing[];
    minPrice: number;
    maxPrice: number;
  }>>([]);
  
  // Add error state
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // Add these new state variables to the MarketAnalyzerPage component
  const [overallMarketScore, setOverallMarketScore] = useState<number>(50);
  const [psa9Data, setPsa9Data] = useState<any>(null);
  const [psa10Data, setPsa10Data] = useState<any>(null);
  const [gradingProfitData, setGradingProfitData] = useState<any>(null);
  const [isLoadingGradedData, setIsLoadingGradedData] = useState<boolean>(false);

  // Add the missing recommendation state to fix the error
  const [recommendation, setRecommendation] = useState<{ action: string; reason: string; details: string } | null>(null);

  // ... after other useState declarations near searchQuery state
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Prompt to complete details
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [draftCard, setDraftCard] = useState<any | null>(null);

  // Process scraped listings using our utility functions
  const processScrapedListings = (scrapedListings: ScrapedListing[], targetCard: TargetCard) => {
    // Store original listings for filtering by date range later
    originalListings.current = scrapedListings;
    
    console.log(`Processing ${scrapedListings.length} scraped listings`);
    
    // Ensure we have listings to process
    if (!scrapedListings || scrapedListings.length === 0) {
      console.log("No listings to process");
      setResults([]);
      setIsLoading(false);
      setIsSearched(true);
      setAnalysisStep('search');
      setSearchError("No listings found for your search criteria. Try broadening your search.");
      return;
    }
    
    // Clean up listings to ensure proper price data
    const cleanedListings = scrapedListings.map(listing => {
      // Ensure price is a valid number
      const price = typeof listing.price === 'number' ? listing.price : 
                   typeof listing.price === 'string' ? parseFloat(listing.price) : 0;
                   
      // Ensure shipping is a valid number
      const shipping = typeof listing.shipping === 'number' ? listing.shipping : 
                     typeof listing.shipping === 'string' ? parseFloat(listing.shipping) : 0;
                       
      // Calculate total price
      const totalPrice = price + shipping;
      
      // Ensure date formats are standardized for processing
      if (listing.date) {
        // Try to ensure date is in string format
        try {
          if (typeof listing.date === 'object') {
            // Try to convert object to ISO string 
            const dateObj = new Date(listing.date as any);
            if (!isNaN(dateObj.getTime())) {
              listing.date = dateObj.toISOString();
            }
          }
          
          // If it's a string with a T (ISO format), get just the date part
          if (typeof listing.date === 'string' && listing.date.includes('T')) {
            const datePart = listing.date.split('T')[0]; 
            listing.date = datePart;
          }
        } catch (e) {
          // If any error in date conversion, default to today
          listing.date = new Date().toISOString().split('T')[0];
        }
      } else {
        // Default to today if missing
        listing.date = new Date().toISOString().split('T')[0];
      }
      
      // Set dateSold if missing
      if (!listing.dateSold) {
        listing.dateSold = typeof listing.date === 'string' ? 
                               listing.date.split('T')[0] : 
                               new Date().toISOString().split('T')[0];
      }
      
      return {
        ...listing,
        price: isNaN(price) ? 0 : price,
        shipping: isNaN(shipping) ? 0 : shipping,
        totalPrice: isNaN(totalPrice) ? price : totalPrice,
        date: listing.date || new Date().toISOString(),
        dateSold: listing.dateSold || (listing.date ? listing.date.toString().split('T')[0] : new Date().toISOString().split('T')[0])
      };
    });
    
    // Group listings by title similarity
    const groupedVariations = groupListingsByTitleSimilarity(cleanedListings);
    console.log(`Grouped into ${groupedVariations.length} variations`);
    
    // Convert groups to displayable format
    const variationOptions = groupedVariations.map((group, index) => {
      // Calculate average price for this group
      const avgPrice = calculateAveragePrice(group);
      
      // Generate a descriptive title for this group
      const baseTitle = group[0]?.title || 'Unknown Card';
      
      // Detect variation types based on the first listing's title
      let variationTitle = extractVariationType(group[0]);
      
      // If no specific variation is detected, just use the base title
      if (!variationTitle) {
        variationTitle = limitTitleLength(baseTitle, 60);
      }
      
      return {
        id: `variation-${index}`,
        title: variationTitle,
        originalTitle: baseTitle,
        imageUrl: group[0]?.imageUrl || '',
        count: group.length,
        averagePrice: avgPrice,
        sample: group.slice(0, 5), // Keep a few examples of this variation
        minPrice: Math.min(...group.map(l => l.totalPrice || l.price || 0)),
        maxPrice: Math.max(...group.map(l => l.totalPrice || l.price || 0))
      };
    });
    
    // Sort variations by number of listings (most common first)
    const sortedVariations = variationOptions.sort((a, b) => b.count - a.count);
    
    // Merge duplicates by title to avoid splitting the same card across groups
    const mergedVariations = mergeDuplicateVariations(sortedVariations);
    
    console.log("Setting cardVariations and analysis step to 'validate'");
    setCardVariations(mergedVariations);
    setIsLoading(false);
    setIsSearched(true);
    setAnalysisStep('validate'); // Move to validation step
  };

  // Group listings by title similarity
  const groupListingsByTitleSimilarity = (listings: ScrapedListing[]): ScrapedListing[][] => {
    if (!listings || listings.length === 0) return [];
    
    console.log(`Grouping ${listings.length} listings by similarity`);
    
    // SPECIAL CASE: Check if we're dealing with raw cards
    const isRawSearch = grading.toLowerCase() === 'raw';
    
    // First, group listings based on common patterns
    const groups: ScrapedListing[][] = [];
    const processed = new Set<number>();
    
    // First pass: Group cards by key attributes
    for (let i = 0; i < listings.length; i++) {
      if (processed.has(i)) continue;
      
      const currentListing = listings[i];
      const currentTitle = currentListing.title.toLowerCase();
      const currentPrice = currentListing.totalPrice || currentListing.price || 0;
      
      const currentGroup: ScrapedListing[] = [currentListing];
      processed.add(i);
      
      // For each unprocessed listing, check if it's similar
      for (let j = i + 1; j < listings.length; j++) {
        if (processed.has(j)) continue;
        
        const compareListing = listings[j];
        const compareTitle = compareListing.title.toLowerCase();
        const comparePrice = compareListing.totalPrice || compareListing.price || 0;
        
        // Special case for raw cards - be more lenient
        if (isRawSearch) {
          // For raw cards, mainly group by price similarity
          const priceSimilarity = Math.abs(currentPrice - comparePrice) / Math.max(currentPrice, comparePrice);
          
          // If prices are within 40% of each other and have similar titles
          if (priceSimilarity < 0.4 && areSimilarRawCardTitles(currentTitle, compareTitle)) {
            currentGroup.push(compareListing);
            processed.add(j);
          }
        } else {
          // For graded cards, normal similarity check
          const similarity = calculateTitleSimilarity(currentTitle, compareTitle);
          
          // Calculate price similarity as percentage difference
          const maxPrice = Math.max(currentPrice, comparePrice);
          let priceSimilarity = 1.0;
          if (maxPrice > 0) {
            priceSimilarity = Math.abs(currentPrice - comparePrice) / maxPrice;
          }
          
          // If titles are similar and prices are within 50% of each other
          if (similarity > 0.6 && priceSimilarity < 0.5) {
            currentGroup.push(compareListing);
            processed.add(j);
          }
        }
      }
      
      // Add the group if it has at least one listing
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
    }
    
    // Sort groups by size (largest first)
    groups.sort((a, b) => b.length - a.length);
    
    return groups;
  };

  // Check if two raw card titles are similar
  const areSimilarRawCardTitles = (title1: string, title2: string): boolean => {
    // Access the component state variable directly
    const playerNameState = playerName.toLowerCase();
    const playerParts = playerNameState.split(' ');
    
    // First check that both have the player name
    const title1HasPlayer = playerParts.every((part: string) => title1.includes(part.toLowerCase()));
    const title2HasPlayer = playerParts.every((part: string) => title2.includes(part.toLowerCase()));
    
    if (!title1HasPlayer || !title2HasPlayer) {
      return false;
    }
    
    // Check for year match
    if (cardYear) {
      if (title1.includes(cardYear) !== title2.includes(cardYear)) {
        return false;
      }
    }
    
    // Check for card set match
    if (cardSet) {
      const cardSetLower = cardSet.toLowerCase();
      const set1HasSet = title1.includes(cardSetLower);
      const set2HasSet = title2.includes(cardSetLower);
      
      if (set1HasSet !== set2HasSet) {
        return false;
      }
    }
    
    // Check for significant variations
    const variationTerms = ['auto', 'autograph', 'canvas', 'parallel', 'press proof', 
                           'gold', 'silver', 'red', 'blue', 'pink', 'green'];
    
    for (const term of variationTerms) {
      if (title1.includes(term) !== title2.includes(term)) {
        return false;
      }
    }
    
    // If we got here, the raw cards are similar enough
    return true;
  };

  // Calculate how similar two titles are (0-1)
  const calculateTitleSimilarity = (title1: string, title2: string): number => {
    const words1 = title1.split(/\s+/);
    const words2 = title2.split(/\s+/);
    
    // Count matching words
    let matches = 0;
    for (const word1 of words1) {
      if (word1.length < 2) continue; // Skip very short words
      
      for (const word2 of words2) {
        if (word1 === word2) {
          matches++;
          break;
        }
      }
    }
    
    // Calculate similarity score (0-1)
    const totalWords = Math.max(words1.length, words2.length);
    return matches / totalWords;
  };

  // Helper function to calculate average price
  const calculateAveragePrice = (listings: ScrapedListing[]): number => {
    if (!listings || listings.length === 0) return 0;
    
    const sum = listings.reduce((total, listing) => 
      total + (listing.totalPrice || listing.price || 0), 0);
    
    return sum / listings.length;
  };
  
  // NEW: Helper to merge duplicate variation entries that share the same title
  const mergeDuplicateVariations = (variations: Array<{
    id: string;
    title: string;
    originalTitle: string;
    imageUrl: string;
    count: number;
    averagePrice: number;
    sample: ScrapedListing[];
    minPrice: number;
    maxPrice: number;
  }>) => {
    const merged = new Map<string, typeof variations[number]>();

    variations.forEach((v) => {
      const key = v.title.trim().toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, { ...v });
      } else {
        const existing = merged.get(key)!;
        const combinedSample = [...existing.sample, ...v.sample];
        const combinedCount = existing.count + v.count;
        const combinedMin = Math.min(existing.minPrice, v.minPrice);
        const combinedMax = Math.max(existing.maxPrice, v.maxPrice);
        const combinedAvg = calculateAveragePrice(combinedSample);

        merged.set(key, {
          ...existing,
          count: combinedCount,
          averagePrice: combinedAvg,
          sample: combinedSample.slice(0, 5), // keep sample reasonably small
          minPrice: combinedMin,
          maxPrice: combinedMax,
        });
      }
    });

    return Array.from(merged.values());
  };
  
  // Helper function to limit title length
  const limitTitleLength = (title: string, maxLength: number): string => {
    if (!title) return '';
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };
  
  const extractVariationType = (listing: ScrapedListing): string => {
    if (!listing || !listing.title) return '';
    
    try {
      // Attempt to extract meaningful variation information
      const title = listing.title.toLowerCase();
      
      // Check if this is a rookie card
      if (title.includes('rookie') || title.includes(' rc ') || title.includes(' rc#') || 
          title.includes('rated rookie') || title.includes('rookie card')) {
        return 'Rookie Card';
      }
      
      // Look for parallel/variation indicators
      const parallelPatterns = [
        { pattern: /\b(gold|silver|bronze|ruby|emerald|sapphire)\b/, name: (match: string): string => `${match.charAt(0).toUpperCase() + match.slice(1)} Parallel` },
        { pattern: /\b(blue|red|green|purple|yellow|orange|black|white|pink)\b/, name: (match: string): string => `${match.charAt(0).toUpperCase() + match.slice(1)} Parallel` },
        { pattern: /\b(shimmer|glitter|shine|sparkle|disco)\b/, name: (match: string): string => `${match.charAt(0).toUpperCase() + match.slice(1)} Parallel` },
        { pattern: /\b(prizm|mosaic|optic|select)\b/, name: (match: string): string => `${match.charAt(0).toUpperCase() + match.slice(1)} Card` },
        { pattern: /\brefractor\b/, name: (): string => 'Refractor' },
        { pattern: /\bauto(graph)?\b/, name: (): string => 'Autograph Card' },
        { pattern: /\bmemo(rabilia)?\b/, name: (): string => 'Memorabilia Card' },
        { pattern: /\bpatch\b/, name: (): string => 'Patch Card' },
        { pattern: /\bjersey\b/, name: (): string => 'Jersey Card' },
        { pattern: /\binscription\b/, name: (): string => 'Inscription Card' },
        { pattern: /\b(1\/1|one of one)\b/, name: (): string => 'One-of-One Card' },
        { pattern: /\binsertion\b|\binsert\b/, name: (): string => 'Insert Card' },
        { pattern: /\bshort print\b|\bsp\b/, name: (): string => 'Short Print Card' }
      ];
      
      for (const { pattern, name } of parallelPatterns) {
        const match = title.match(pattern);
        if (match) {
          return name(match[1] || match[0]);
        }
      }
      
      // If we couldn't identify a specific variation, keep the truncated title
      return limitTitleLength(listing.title, 40);
      
    } catch (error) {
      console.error('Error extracting variation type:', error);
      return listing.title ? limitTitleLength(listing.title, 40) : '';
    }
  };
  
  // Update price data when time range or selected card changes
  useEffect(() => {
    if (isSearched && selectedCard && marketMetrics) {
      // If we have results, regenerate the price data for the new time range
      const targetCard: TargetCard = {
        playerName: selectedCard.playerName,
        year: selectedCard.year,
        cardSet: selectedCard.cardSet,
        variation: selectedCard.variation,
        grade: selectedCard.grade,
      };
      
      // For real data, we just need to filter the existing listings by date
      if (originalListings.current.length > 0) {
        const groupedListings = groupVariationSales(originalListings.current, targetCard);
        const chartData = generatePriceDataFromListings(groupedListings);
        setPriceData(chartData);
      }
    }
  }, [timeRange, isSearched, selectedCard, marketMetrics]);

  // Update the chart render condition to force display even with problematic data
  useEffect(() => {
    if (selectedCard && marketMetrics) {
      console.log("Force rendering price history chart with available data");
      
      // Get available listings
      const validListings = selectedCard.listings?.filter(l => l.price > 0) || [];
      
      // If we have at least 1 listing, ensure we show the chart
      if (validListings.length > 0) {
        // Create a simple, guaranteed-to-work data format
        const forcedPriceData: PriceData[] = [];
        
        validListings.forEach((listing, index) => {
          // Create a valid date string regardless of the listing format
          const today = new Date();
          const daysAgo = index * 3; // Space out points by 3 days
          const dateObj = new Date(today);
          dateObj.setDate(today.getDate() - daysAgo);
          
          // Create a guaranteed valid date string
          const dateStr = dateObj.toISOString().split('T')[0];
          
          // Use actual price when available
          const price = listing.totalPrice || listing.price || 0;
          
          if (price > 0) {
            forcedPriceData.push({
              date: dateStr,
              price: price
            });
          }
        });
        
        if (forcedPriceData.length > 0) {
          console.log(`Generated ${forcedPriceData.length} forced data points for chart`);
          setPriceData(forcedPriceData);
        }
      }
    }
  }, [selectedCard, marketMetrics]);

  // Add a reset function to clear all state
  const resetSearch = () => {
    setIsSearched(false);
    setResults([]);
    setSelectedCard(null);
    setCardVariations([]);
    setPriceData([]);
    setMarketMetrics(null);
    setMarketScores({ volatility: 0, trend: 0, demand: 0 });
    setPredictions({ days30: 0, days60: 0, days90: 0 });
    setAnalysisStep('search');
    
    // Optionally clear form fields too
    // Uncomment if you want to clear the form as well
    // setPlayerName("");
    // setCardYear("");
    // setCardSet("");
    // setCardVariation("");
    // setCardNumber("");
    // setGrading("any");
  };

  // Helper function to find the best image from a set of listings
  const findBestImage = (listings: ScrapedListing[]): string => {
    // Default fallback image
    const fallbackImage = 'https://placehold.co/500x700/e1e1e1/4a4a4a?text=No+Image+Available';
    
    // Handle no listings case
    if (!listings || !Array.isArray(listings) || listings.length === 0) {
      console.log('No listings provided to findBestImage');
      return fallbackImage;
    }
    
    console.log('Finding best image from', listings.length, 'listings');
    
    // Try to find a valid image URL
    for (const listing of listings) {
      if (listing && listing.imageUrl && typeof listing.imageUrl === 'string') {
        const url = listing.imageUrl.trim();
        console.log('Checking image URL:', url);
        
        // Basic validation
        if (url && url !== '' && !url.includes('undefined') && !url.includes('null')) {
          try {
            // Just check if it's a valid URL format
            new URL(url);
            console.log('Found valid image URL:', url);
            return enhanceImageUrl(url);
          } catch (e) {
            console.log(`Invalid URL format in listing: ${url}`);
            // Continue to next listing
          }
        }
      }
    }
    
    // If no valid URLs found, return fallback
    console.log('No valid image URLs found in listings');
    return fallbackImage;
  };

  // Modify this to handle types properly
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent empty search
    if (!searchQuery.trim()) {
      setSearchError("Please enter a search query.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSearchError("");
    setResults([]);
    setCardVariations([]);
    
    try {
      console.log(`Searching for: ${searchQuery}`);

      // Create search payload
      const payload: {
        playerName: string;
        query: string;
        negKeywords: string[];
        grade?: string;
        conditionFilter?: string;
      } = {
        playerName: searchQuery,
        query: searchQuery,
        negKeywords: ["lot", "reprint", "digital", "case", "break"],
      };

      // Add grade if specified
      if (grading && grading !== "any") {
        payload.grade = grading;
      }

      // Add condition filter for ungraded cards
      if (grading === "ungraded") {
        payload.conditionFilter = "ungraded";
        // Add negative keywords for graded cards
        payload.negKeywords = [
          ...payload.negKeywords,
          "PSA",
          "BGS",
          "SGC",
          "CGC",
          "graded",
          "slabbed",
          "beckett",
        ];
      }

      // Always use the test server URL when in development
      console.log('Using API URL:', API_URL);
      const apiUrl = API_URL;
      
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/text-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch card data");
      }

      console.log(`Got ${data.listings?.length || 0} listings from server`);
      console.log(`Got ${data.groupedListings?.length || 0} variations from server`);
      
      // Log a sample listing to inspect
      if (data.listings && data.listings.length > 0) {
        console.log('Sample listing:', data.listings[0]);
      }
      
      // Log a sample group to inspect
      if (data.groupedListings && data.groupedListings.length > 0) {
        console.log('Sample group:', data.groupedListings[0]);
      }
      
      // Save original listings for future reference
      originalListings.current = data.listings || [];

      // Process the listings
      if (data.listings && data.listings.length > 0) {
        // If the server provides grouped listings, use them directly
        if (data.groupedListings && data.groupedListings.length > 0) {
          console.log("Using server-provided grouped listings");
          
          // Convert server groupings to our format
          const variations = data.groupedListings.map((group: any, index: number) => {
            let imageUrl = group.representativeImageUrl;
            if (!imageUrl) {
              imageUrl = findBestImage(group.listings || []);
            }
            console.log(`Variation ${index} image:`, imageUrl);
            
            return {
              id: group.id || `variation-${index}`,
              title: group.title || `Variation ${index + 1}`,
              originalTitle: group.title || `Variation ${index + 1}`,
              imageUrl: imageUrl,
              count: group.count || group.listings?.length || 0,
              averagePrice: group.averagePrice || calculateAveragePrice(group.listings || []),
              sample: group.listings?.slice(0, 5) || [],
              minPrice: Math.min(...(group.listings || []).map((l: any) => l.totalPrice || l.price || 0)),
              maxPrice: Math.max(...(group.listings || []).map((l: any) => l.totalPrice || l.price || 0))
            };
          });
          
          const mergedVariations = mergeDuplicateVariations(variations);
          setCardVariations(mergedVariations);
          
          // Use the first variation for initial analysis
          if (mergedVariations.length > 0) {
            const bestImageUrl = mergedVariations[0].imageUrl;
            console.log('Best image URL for first variation:', bestImageUrl);
            
            // Create a basic result for the results panel
            const cardResult: CardResult = {
              id: nanoid(),
              playerName: searchQuery,
              year: "",
              cardSet: "",
              grade: grading || "Any",
              condition: grading === "ungraded" ? "raw" : "graded",
              averagePrice: mergedVariations[0].averagePrice,
              lastSold: data.listings[0]?.dateSold || new Date().toISOString().split("T")[0],
              listings: mergedVariations[0].sample,
              imageUrl: bestImageUrl,
              title: mergedVariations[0].title,
            };
            
            setResults([cardResult]);
          }
        } else {
          // Fall back to client-side grouping if server doesn't provide groups
          console.log("Server didn't provide grouped listings, grouping on client");
          processScrapedListings(data.listings, {
            playerName: searchQuery,
            year: "",
            cardSet: "",
            variation: "",
            grade: grading || "Any"
          });
        }
        
        setIsSearched(true);
        setAnalysisStep('validate');
        
        // Scroll to results
        setTimeout(() => {
          document.getElementById("results")?.scrollIntoView({
            behavior: "smooth",
          });
        }, 500);
      } else {
        throw new Error("No listings found");
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchError(
        error instanceof Error
          ? error.message
          : "An error occurred while searching for card data"
      );
      
      // Clear results and variations on error
      setResults([]);
      setCardVariations([]);
      setPriceData([]);
      
      setIsSearched(true);
      setAnalysisStep('search');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Completely rewritten function to handle price history data extraction
  const extractPriceHistory = (listings: ScrapedListing[], isRaw: boolean, avgPrice: number) => {
    console.log("Extracting price history with improved handling", { listingCount: listings.length, isRaw });
    
    // Set a minimum number of data points to consider valid
    const MIN_DATA_POINTS = 2;
    
    // Early return if insufficient listings 
    if (!listings || listings.length < MIN_DATA_POINTS) {
      console.log("Insufficient listings for price history");
      setPriceData([]);
      return;
    }
    
    try {
      // Safe date parsing with multiple fallbacks
      const parseDate = (input: any): string => {
        if (!input) return new Date().toISOString().split('T')[0];
        
        try {
          // Handle string dates
          if (typeof input === 'string') {
            // If already in ISO format with 'T', just extract the date part
            if (input.includes('T')) {
              return input.split('T')[0];
            }
            
            // Try to parse the string date
            const dateObj = new Date(input);
            if (!isNaN(dateObj.getTime())) {
              return dateObj.toISOString().split('T')[0];
            }
          }
          
          // Handle date objects
          if (input instanceof Date) {
            return input.toISOString().split('T')[0];
          }
          
          // If we're here, we couldn't parse the date
          return new Date().toISOString().split('T')[0];
        } catch (error) {
          console.warn("Date parsing error:", error);
          return new Date().toISOString().split('T')[0];
        }
      };
      
      // Extract price points with safe date handling
      let pricePoints: PriceData[] = [];
      
      for (const listing of listings) {
        // Get a valid price (use totalPrice if available, otherwise price)
        const price = listing.totalPrice || listing.price || 0;
        
        // Skip invalid prices
        if (price <= 0) continue;
        
        // Get the best date available with fallbacks
        const dateStr = 
          parseDate(listing.dateSold) || 
          parseDate(listing.date) || 
          new Date().toISOString().split('T')[0];
        
        pricePoints.push({
          date: dateStr,
          price: price
        });
      }
      
      // If we have enough points after filtering, use them
      if (pricePoints.length >= MIN_DATA_POINTS) {
        // Sort by date for proper chronological display
        pricePoints.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateA - dateB;
        });
        
        console.log(`Using ${pricePoints.length} real data points for price history`);
        setPriceData(pricePoints);
      } else {
        // Not enough data points after filtering
        console.log("Not enough valid price points after filtering");
        setPriceData([]);
      }
    } catch (error) {
      console.error("Error processing price history:", error);
      setPriceData([]);
    }
  };
  
  // Update the analyzeVariation function to use the new extractPriceHistory function
  const analyzeVariation = (variationId: string) => {
    setIsLoadingAnalysis(true);
    setSearchError(null);
    
    // Find the selected variation
    const selectedVariation = cardVariations.find(v => v.id === variationId);
    
    if (!selectedVariation) {
      console.error('Selected variation not found:', variationId);
      setSearchError('Error loading variation data');
      setIsLoadingAnalysis(false);
      return;
    }
    
    console.log('Analyzing variation:', selectedVariation.title);
    console.log('Variation image URL:', selectedVariation.imageUrl);
    
    // Create a card result for the selected variation
    const cardResult: CardResult = {
      id: nanoid(),
      playerName: searchQuery,
      year: "",
      cardSet: "",
      grade: grading,
      condition: grading === "ungraded" ? "raw" : "graded",
      variation: selectedVariation.title,
      averagePrice: selectedVariation.averagePrice,
      lastSold: selectedVariation.sample[0]?.dateSold || new Date().toISOString().split("T")[0],
      listings: selectedVariation.sample,
      imageUrl: selectedVariation.imageUrl,
      title: selectedVariation.title
    };
    
    console.log('Card result created with image URL:', cardResult.imageUrl);

    // Set the selected card and extract price data for the variation
    setSelectedCard(cardResult);
    
    // Generate price history data points - properly handling type issues
    const isRaw = grading === "ungraded";
    extractPriceHistory(selectedVariation.sample, isRaw, selectedVariation.averagePrice);
    
    // Calculate market metrics
    const metrics = calculateMarketMetrics(selectedVariation.sample);
    setMarketMetrics(metrics);
    
    // Calculate market scores based on metrics
    // metrics.volatility is already 0-100 where higher = more volatile (worse).
    // Turn it into a "stability" score (lower volatility → higher score).
    const volatilityScore = Math.max(0, Math.min(100, 100 - metrics.volatility));
    const trendScore = Math.max(0, Math.min(100, 50 + (metrics.trend * 50)));
    
    // Use the salesCount from metrics instead of salesPerDay
    const demandScore = metrics.salesCount > 10 ? 75 : (metrics.salesCount > 5 ? 50 : 25);
    
    setMarketScores({
      volatility: Math.round(volatilityScore),
      trend: Math.round(trendScore),
      demand: Math.round(demandScore)
    });
    
    // Generate price predictions based on current metrics
    const pricePredictions = predictFuturePrices(selectedVariation.sample, selectedVariation.averagePrice);
    setPredictions(pricePredictions);
    
    // Generate recommendation based on metrics
    const rec = generateRecommendation(metrics);
    setRecommendation(rec);
    
    // Calculate the overall market score
    const overall = calculateOverallMarketScore(metrics);
    setOverallMarketScore(overall);
    
    // Move to analysis step
    setAnalysisStep('analyze');
    setIsLoadingAnalysis(false);
    
    // Scroll to analysis
    setTimeout(() => {
      document.getElementById("analysis")?.scrollIntoView({
        behavior: "smooth",
      });
    }, 100);
  };

  // Add the missing loadGradedVersions function (simplified version)
  const loadGradedVersions = async () => {
    if (!selectedCard) return;
    
    setIsLoadingGradedData(true);
    setGradingProfitData(null);
    
    try {
      // Create search payload for graded versions
      const payload = {
        playerName: searchQuery,
        query: `${searchQuery} PSA 9 PSA 10`,
        negKeywords: ["lot", "reprint", "digital", "case", "break", "raw", "ungraded"],
        grade: "PSA 9 PSA 10"
      };

      // Use the same API endpoint but with different parameters
      const apiUrl = API_URL;
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/text-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch graded card data");
      }

      // Process the listings to separate PSA 9 and PSA 10
      const psa9Listings = data.listings.filter((listing: ScrapedListing) => 
        listing.title?.toLowerCase().includes('psa 9')
      );
      
      const psa10Listings = data.listings.filter((listing: ScrapedListing) => 
        listing.title?.toLowerCase().includes('psa 10')
      );

      // Calculate average prices
      const psa9Price = calculateAveragePrice(psa9Listings);
      const psa10Price = calculateAveragePrice(psa10Listings);
      const rawPrice = selectedCard.averagePrice;

      // Calculate potential profits
      const psa9Profit = psa9Price - rawPrice;
      const psa10Profit = psa10Price - rawPrice;

      // Calculate profits after grading costs
      const gradingCost = 30; // PSA grading cost
      const psa9ProfitAfterCosts = psa9Profit - gradingCost;
      const psa10ProfitAfterCosts = psa10Profit - gradingCost;

      // Generate recommendation
      let recommendation = "Based on current market data, ";
      
      if (psa9ProfitAfterCosts > 0 && psa10ProfitAfterCosts > 0) {
        recommendation += "grading this card could be profitable. The potential return on investment is positive for both PSA 9 and PSA 10 grades.";
      } else if (psa9ProfitAfterCosts > 0) {
        recommendation += "grading this card could be profitable if you expect a PSA 9 grade. PSA 10 grades may not be profitable after grading costs.";
      } else if (psa10ProfitAfterCosts > 0) {
        recommendation += "grading this card could be profitable if you expect a PSA 10 grade. PSA 9 grades may not be profitable after grading costs.";
      } else {
        recommendation += "grading this card may not be profitable at current market prices. Consider holding the raw card or waiting for market conditions to improve.";
      }

      // Set the grading profit data
      setGradingProfitData({
        rawPrice,
        psa9Price,
        psa10Price,
        psa9Profit,
        psa10Profit,
        psa9ProfitAfterCosts,
        psa10ProfitAfterCosts,
        recommendation
      });

    } catch (error) {
      console.error("Error loading graded versions:", error);
      toast.error("Failed to load graded card data. Please try again.");
    } finally {
      setIsLoadingGradedData(false);
    }
  };
  
  // Add a simplified handleAddToCollection function
  const handleAddToCollection = async () => {
    if (!selectedCard) return;
    
    // Make sure user is logged in
    if (!user) {
      toast.error("You need to be logged in to add cards to your collection");
      return;
    }
    
    try {
      // Create a card object from the selected card data
      const newCard = {
        playerName: selectedCard.playerName || searchQuery,
        year: selectedCard.year || "",
        cardSet: selectedCard.cardSet || "",
        cardNumber: cardNumber || "",
        condition: selectedCard.grade || 'Raw',
        imageUrl: selectedCard.imageUrl || '',
        currentValue: selectedCard.averagePrice || 0,
        pricePaid: parseFloat(pricePaid || '0') || 0,
        variation: selectedCard.variation || '',
        ownerId: user.uid,
        tags: [] // Add empty tags array
      };
      
      // Ensure required fields present
      if (!newCard.playerName || !newCard.year || !newCard.cardSet) {
        setDraftCard(newCard);
        setFixDialogOpen(true);
        return;
      }
      
      // Add the card via CardService so we wait for Firestore write
      await CardService.createCard(user.uid, newCard);
      
      // Show a success toast
      toast.success("Card added to collection successfully!");
      
      // Invalidate cached cards query so Collection refreshes
      queryClient.invalidateQueries({ queryKey: ['cards', user.uid] });
      
      // Navigate to the collection page
      navigate('/collection');
    } catch (error) {
      console.error("Error adding card to collection:", error);
      toast.error("Failed to add card to collection");
    }
  };

  // Create a render function for card images 
  const renderCardImage = (imageUrl: string, title: string, size = 'medium') => {
    console.log(`Rendering card image for ${title}:`, imageUrl);
    
    // Define size classes
    const sizeClasses = {
      small: 'h-24 w-20',
      medium: 'h-48 w-36',
      large: 'h-64 w-48'
    };
    
    const sizeClass = sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.medium;
    
    return (
      <CardImage
        src={imageUrl}
        alt={`${title} Card Image`}
        className={`${sizeClass} mx-auto`}
      />
    );
  };

  // ... add new function below handleSearch
  const handleImageSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      setSearchError('Please choose an image file to search.');
      return;
    }
    try {
      setIsLoading(true);
      setSearchError('');
      setResults([]);
      setCardVariations([]);

      console.log('Searching by image:', imageFile.name);
      const apiUrl = API_URL;
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/image-search/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = await response.json();

      if (!data.listings || data.listings.length === 0) {
        throw new Error('No listings found for this image');
      }

      // Use same processing as text
      originalListings.current = data.listings;
      if (data.groupedListings && data.groupedListings.length > 0) {
        // Convert server groupings to variation format and merge duplicates
        const variations = data.groupedListings.map((group: any, index: number) => {
          let imageUrl = group.representativeImageUrl;
          if (!imageUrl) {
            imageUrl = findBestImage(group.listings || []);
          }
          return {
            id: group.id || `variation-${index}`,
            title: group.title || `Variation ${index + 1}`,
            originalTitle: group.title || `Variation ${index + 1}`,
            imageUrl,
            count: group.count || group.listings?.length || 0,
            averagePrice: group.averagePrice || calculateAveragePrice(group.listings || []),
            sample: group.listings?.slice(0, 5) || [],
            minPrice: Math.min(...(group.listings || []).map((l: any) => l.totalPrice || l.price || 0)),
            maxPrice: Math.max(...(group.listings || []).map((l: any) => l.totalPrice || l.price || 0)),
          };
        });

        const mergedVariations = mergeDuplicateVariations(variations);
        setCardVariations(mergedVariations);
        setIsSearched(true);
        setAnalysisStep('validate');
      } else {
        processScrapedListings(data.listings, { playerName: 'Image Search', year: '', cardSet: '', variation: '', grade: grading || 'Any' });
      }
    } catch (err: any) {
      console.error('Image search error:', err);
      setSearchError(err.message || 'Failed to search by image');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to persist draftCard once user fills
  const saveDraftCard = async () => {
    if (!draftCard) return;
    try {
      await CardService.createCard(user!.uid, draftCard);
      toast.success('Card added to collection successfully!');
      queryClient.invalidateQueries({ queryKey: ['cards', user!.uid] });
      setFixDialogOpen(false);
      navigate('/collection');
    } catch (err) {
      console.error('Error saving card:', err);
      toast.error('Failed to save card');
    }
  };

  // Render the component...
  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">Market Analyzer</h1>
      
      {/* Search Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search for Cards
          </CardTitle>
          <CardDescription>Search eBay sold listings for sports card market data</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="searchQuery">Search for Cards</Label>
              <Input
                id="searchQuery"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Jordan Love 2020 Donruss #304 PSA 10"
              />
              <p className="text-xs text-gray-500">
                Enter a complete search like you would on eBay 
                (player name, year, card set, card number, etc.)
              </p>
            </div>
              
            {/* Grading dropdown removed to simplify search.  Users can type "PSA 10", "raw", etc. directly in the search box. */}
            
            <div className="space-y-2">
              <Label htmlFor="imageUpload">Or search by card image</Label>
              <Input 
                id="imageUpload" 
                type="file" 
                accept="image/*" 
                capture="environment" 
                onChange={(e) => setImageFile(e.target.files?.[0] || null)} 
              />
              <Button type="button" variant="secondary" disabled={!imageFile || isLoading} onClick={handleImageSearch}>
                {isLoading ? (
                  <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Searching...</>
                ) : (
                  <> <Search className="mr-2 h-4 w-4" />Search by Image</>
                )}
              </Button>
            </div>
            
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
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

            {searchError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                <p>{searchError}</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Results Section - STEP 1: VALIDATION */}
      {isSearched && analysisStep === 'validate' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Step 1: Select Correct Card Variation
              </CardTitle>
              <CardDescription>
                {cardVariations.length > 0 
                  ? `Found ${cardVariations.length} different card variations. Select the correct one to analyze.`
                  : 'No card variations found. Try a different search.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading variations...</span>
                </div>
              ) : cardVariations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cardVariations.map((variation) => (
                    <div 
                      key={variation.id}
                      className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => analyzeVariation(variation.id)}
                    >
                      <div className="aspect-w-3 aspect-h-4 mb-1">
                        <CardImage 
                          src={variation.imageUrl || "https://via.placeholder.com/300?text=No+Image"} 
                          alt={variation.title}
                          className="rounded-md"
                        />
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-2 mt-1">{variation.title}</h3>
                      <div className="text-xs text-gray-500 line-clamp-1" title={variation.originalTitle}>
                        {limitTitleLength(variation.originalTitle, 40)}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-500">{variation.count} sales</span>
                        <span className="text-lg font-bold">${variation.averagePrice.toFixed(2)}</span>
                      </div>
                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>Range: ${variation.minPrice.toFixed(2)} - ${variation.maxPrice.toFixed(2)}</span>
                      </div>
                      <Button 
                        className="w-full mt-2" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAnalysisStep('analyze');
                          setTimeout(() => {
                            analyzeVariation(variation.id);
                          }, 50);
                        }}
                      >
                        Select & Analyze
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-10">
                  <p className="text-gray-500">No cards found matching your criteria.</p>
                  <p className="text-sm mt-2">Try adjusting your search parameters or using broader terms.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Section - STEP 2: ANALYSIS */}
      {isSearched && analysisStep === 'analyze' && selectedCard && marketMetrics && (
        <div className="space-y-2">
          {/* Card Selection Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {limitTitleLength(selectedCard.title || '', 80)}
              </CardTitle>
              <CardDescription>
                Analyzing {selectedCard.listings.length} sales for this card
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="md:w-1/5">
                  <div className="aspect-w-3 aspect-h-4 mb-3">
                    <CardImage 
                      src={selectedCard.imageUrl || "https://via.placeholder.com/300?text=No+Image"} 
                      alt={selectedCard.title || 'Card image'}
                      className="rounded-md"
                    />
                  </div>
                </div>
                <div className="md:w-4/5">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {selectedCard.grade && (
                      <div>
                        <p className="text-sm text-gray-500">Grade</p>
                        <p className="font-medium">{selectedCard.grade}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-500">Average Price</p>
                      <p className="font-bold text-lg">${marketMetrics.averagePrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Sold</p>
                      <p className="font-medium">{selectedCard.lastSold?.split('T')[0]}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Sales Count</p>
                      <p className="font-medium">{selectedCard.listings.length}</p>
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      // Only change the analysis step, don't clear the data
                      setAnalysisStep('validate');
                      // Reset the selected card and analytics data
                      setSelectedCard(null);
                      setPriceData([]);
                      setMarketMetrics(null);
                      setMarketScores({ volatility: 0, trend: 0, demand: 0 });
                      setPredictions({ days30: 0, days60: 0, days90: 0 });
                    }}
                  >
                    Back to Variations
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Price History
              </CardTitle>
              <CardDescription>
                {priceData.length > 0 
                  ? `${priceData.length} sales over the past ${priceData.length > 30 ? '90' : priceData.length} days` 
                  : 'No price history available'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {priceData.length > 1 ? (
                  <ReactApexChart
                    options={{
                      chart: {
                        type: 'line',
                        zoom: { enabled: false },
                        animations: { enabled: true },
                        toolbar: { show: false },
                        fontFamily: 'inherit',
                      },
                      stroke: { 
                        curve: 'smooth',
                        width: 3,
                      },
                      xaxis: {
                        type: 'datetime',
                        labels: {
                          datetimeUTC: false,
                          format: 'MMM dd',
                          formatter: function(value) {
                            // Simple formatting that guarantees values
                            try {
                              const date = new Date(value);
                              if (!isNaN(date.getTime())) {
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              }
                              return '';
                            } catch (e) {
                              return '';
                            }
                          }
                        },
                        tooltip: {
                          enabled: true
                        }
                      },
                      yaxis: {
                        labels: {
                          formatter: (value) => `$${value.toFixed(2)}`
                        },
                        forceNiceScale: true,
                        min: (function() {
                          if (priceData.length === 0) return 0;
                          const min = Math.min(...priceData.map(d => d.price));
                          // Get a slightly lower value for better visualization
                          return Math.floor(min * 0.9);
                        })(),
                        max: (function() {
                          if (priceData.length === 0) return 100;
                          const max = Math.max(...priceData.map(d => d.price));
                          // Get a slightly higher value for better visualization
                          return Math.ceil(max * 1.1);
                        })()
                      },
                      dataLabels: { enabled: false },
                      markers: { 
                        size: 5,
                        hover: { 
                          size: 7,
                          sizeOffset: 3
                        },
                        strokeWidth: 0,
                        discrete: [],
                        shape: 'circle'
                      },
                      grid: {
                        show: true,
                        borderColor: '#f1f1f1',
                        row: {
                          colors: ['transparent', 'transparent'],
                          opacity: 0.5
                        }
                      },
                      tooltip: {
                        x: {
                          format: 'MMM dd, yyyy'
                        },
                        y: {
                          formatter: function(value) {
                            return `$${value.toFixed(2)}`;
                          }
                        },
                        marker: { show: true },
                      },
                      theme: { mode: 'light' }
                    }}
                    series={[
                      {
                        name: 'Price',
                        data: priceData.map(point => {
                          // Extremely simplified conversion to avoid date issues
                          try {
                            // Hard-coded approach that won't fail
                            const timestamp = new Date(point.date).getTime() || Date.now();
                            const validPrice = point.price > 0 ? point.price : marketMetrics?.averagePrice || 0;
                            
                            return {
                              x: timestamp,
                              y: validPrice
                            };
                          } catch (e) {
                            // Emergency fallback point if everything fails
                            return {
                              x: Date.now() - Math.random() * 7776000000, // Random date in past 90 days
                              y: marketMetrics?.averagePrice || 0
                            };
                          }
                        })
                      }
                    ]}
                    type="line"
                    height={250}
                    width="100%"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <DatabaseIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No price data</h3>
                      <p className="mt-1 text-sm text-gray-500">Not enough sales data available for this card.</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Market Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Market Scores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Market Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Volatility</span>
                      <span className="text-sm font-medium">{marketScores?.volatility || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, marketScores?.volatility || 0)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Trend</span>
                      <span className="text-sm font-medium">{marketScores?.trend || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          (marketScores?.trend || 0) > 50 ? 'bg-green-500' : 'bg-red-500'
                        }`} 
                        style={{ width: `${Math.min(100, marketScores?.trend || 0)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Demand</span>
                      <span className="text-sm font-medium">{marketScores?.demand || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, marketScores?.demand || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 grid grid-cols-2 gap-2 text-center">
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs text-gray-500">Avg. Price</p>
                    <p className="text-lg font-bold">${marketMetrics?.averagePrice?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs text-gray-500">Sales Count</p>
                    <p className="text-lg font-bold">{marketMetrics?.salesCount || 0}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs text-gray-500">Min Price</p>
                    <p className="text-lg font-bold">${marketMetrics?.minPrice?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs text-gray-500">Max Price</p>
                    <p className="text-lg font-bold">${marketMetrics?.maxPrice?.toFixed(2) || "0.00"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Price Prediction */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Price Prediction
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="flex justify-between">
                      <p className="text-sm">Current Price</p>
                      <p className="font-bold">${marketMetrics?.averagePrice?.toFixed(2) || "0.00"}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="flex justify-between mb-1">
                      <p className="text-sm">30 Days</p>
                      <p className="font-bold">${predictions?.days30?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Estimate</span>
                      <span className={(predictions?.days30 || 0) > (marketMetrics?.averagePrice || 0) ? 'text-green-600' : 'text-red-600'}>
                        {(predictions?.days30 || 0) > (marketMetrics?.averagePrice || 0) ? '↑' : '↓'} 
                        {Math.abs(((predictions?.days30 || 0) / Math.max(0.01, marketMetrics?.averagePrice || 1) - 1) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="flex justify-between mb-1">
                      <p className="text-sm">60 Days</p>
                      <p className="font-bold">${predictions?.days60?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Estimate</span>
                      <span className={(predictions?.days60 || 0) > (marketMetrics?.averagePrice || 0) ? 'text-green-600' : 'text-red-600'}>
                        {(predictions?.days60 || 0) > (marketMetrics?.averagePrice || 0) ? '↑' : '↓'} 
                        {Math.abs(((predictions?.days60 || 0) / Math.max(0.01, marketMetrics?.averagePrice || 1) - 1) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="flex justify-between mb-1">
                      <p className="text-sm">90 Days</p>
                      <p className="font-bold">${predictions?.days90?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Estimate</span>
                      <span className={(predictions?.days90 || 0) > (marketMetrics?.averagePrice || 0) ? 'text-green-600' : 'text-red-600'}>
                        {(predictions?.days90 || 0) > (marketMetrics?.averagePrice || 0) ? '↑' : '↓'} 
                        {Math.abs(((predictions?.days90 || 0) / Math.max(0.01, marketMetrics?.averagePrice || 1) - 1) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ROI Calculator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  ROI Calculator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pricePaid">Price Paid</Label>
                    <div className="flex items-center">
                      <span className="mr-2 text-gray-600 font-medium">$</span>
                      <Input 
                        id="pricePaid" 
                        value={pricePaid} 
                        onChange={(e) => {
                          // Only allow valid numeric input with up to 2 decimal places
                          const value = e.target.value;
                          // Match empty string or valid decimal number
                          const regex = /^(\d*\.?\d{0,2})?$/;
                          if (regex.test(value)) {
                            setPricePaid(value);
                          }
                        }} 
                        placeholder="0.00"
                        type="text"
                        inputMode="decimal"
                        aria-label="Price paid (dollars)"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="flex justify-between">
                      <p className="text-sm">Current Market Value</p>
                      <p className="font-bold">${marketMetrics?.averagePrice?.toFixed(2) || "0.00"}</p>
                    </div>
                  </div>
                  
                  {pricePaid && !isNaN(parseFloat(pricePaid)) && (
                    <>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between">
                          <p className="text-sm">Current Return</p>
                          <p className={`font-bold ${marketMetrics?.averagePrice > parseFloat(pricePaid) ? 'text-green-600' : 'text-red-600'}`}>
                            ${(marketMetrics?.averagePrice - parseFloat(pricePaid)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between">
                          <p className="text-sm">ROI %</p>
                          <p className={`font-bold ${marketMetrics?.averagePrice > parseFloat(pricePaid) ? 'text-green-600' : 'text-red-600'}`}>
                            {((marketMetrics?.averagePrice / parseFloat(pricePaid) - 1) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between">
                          <p className="text-sm">90-Day Projected ROI</p>
                          <p className={`font-bold ${(predictions?.days90 || 0) > parseFloat(pricePaid || '0') ? 'text-green-600' : 'text-red-600'}`}>
                            {(() => {
                              // Get the price paid as a number, with a minimum value to prevent division by zero
                              const pricePaidNum = Math.max(0.01, parseFloat(pricePaid || '0'));
                              
                              // Get the 90-day prediction or default to 0
                              const prediction90 = predictions?.days90 || 0;
                              
                              // Calculate ROI percentage
                              const roiPercent = ((prediction90 / pricePaidNum) - 1) * 100;
                              
                              // Handle invalid values
                              if (isNaN(roiPercent) || !isFinite(roiPercent) || pricePaidNum <= 0.01) {
                                return "N/A";
                              }
                              
                              // Format the result
                              return `${roiPercent > 0 ? '+' : ''}${roiPercent.toFixed(1)}%`;
                            })()}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add the Grading Profit Calculator section with a button to load data */}
          {isSearched && analysisStep === 'analyze' && selectedCard && marketMetrics && (
            <Card className="mt-6 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Grading Profit Calculator
                </CardTitle>
                <CardDescription>
                  {gradingProfitData ? 
                    "Estimated profits if this raw card was graded" : 
                    "See potential value if this raw card was professionally graded"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!gradingProfitData && !isLoadingGradedData ? (
                  <div className="text-center p-6">
                    <Button onClick={loadGradedVersions}>
                      Check Grading Profit Potential
                    </Button>
                    <p className="mt-4 text-sm text-gray-500">
                      This will fetch data on PSA 9 and PSA 10 graded versions of this card to estimate potential profits
                    </p>
                  </div>
                ) : isLoadingGradedData ? (
                  <div className="flex justify-center p-6">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading graded card data...</span>
                  </div>
                ) : gradingProfitData ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h3 className="font-semibold">Current Raw Price</h3>
                          <p className="text-xs text-gray-500">Ungraded market value</p>
                        </div>
                        <span className="text-lg font-bold">${gradingProfitData.rawPrice.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div>
                          <h3 className="font-semibold">PSA 9 Value</h3>
                          <p className="text-xs text-gray-500">Average sale price</p>
                        </div>
                        <div className="mt-2 flex justify-between items-center">
                          <span className="text-lg font-bold">${gradingProfitData.psa9Price.toFixed(2)}</span>
                          <span className={`text-sm ${gradingProfitData.psa9Profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {gradingProfitData.psa9Profit > 0 ? '+' : ''}{gradingProfitData.psa9Profit.toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <p className="text-xs text-gray-500">Profit after grading: ${gradingProfitData.psa9ProfitAfterCosts.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div>
                          <h3 className="font-semibold">PSA 10 Value</h3>
                          <p className="text-xs text-gray-500">Average sale price</p>
                        </div>
                        <div className="mt-2 flex justify-between items-center">
                          <span className="text-lg font-bold">${gradingProfitData.psa10Price.toFixed(2)}</span>
                          <span className={`text-sm ${gradingProfitData.psa10Profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {gradingProfitData.psa10Profit > 0 ? '+' : ''}{gradingProfitData.psa10Profit.toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <p className="text-xs text-gray-500">Profit after grading: ${gradingProfitData.psa10ProfitAfterCosts.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-start">
                        <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                        <div>
                          <h3 className="font-semibold">Grading Recommendation</h3>
                          <p className="text-sm mt-1">
                            {gradingProfitData.recommendation}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            Assumptions: PSA grading cost $30, 60% chance of PSA 9, 20% chance of PSA 10
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Recommendation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgePercent className="h-5 w-5" />
                Market Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pricePaid && !isNaN(parseFloat(pricePaid)) ? (
                <>
                  {(() => {
                    const roi = ((marketMetrics?.averagePrice / parseFloat(pricePaid)) - 1) * 100;
                    const recommendation = generateRecommendation(marketMetrics, roi);
                    
                    const actionColors: Record<string, string> = {
                      'BUY': 'bg-green-100 text-green-800',
                      'SELL': 'bg-red-100 text-red-800',
                      'HOLD': 'bg-blue-100 text-blue-800',
                      'WATCH': 'bg-yellow-100 text-yellow-800'
                    };
                    
                    return (
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className={`text-center p-4 rounded-lg ${actionColors[recommendation.action] || 'bg-gray-100'}`}>
                          <p className="text-lg font-bold">{recommendation.action}</p>
                        </div>
                        <div>
                          <p className="text-gray-700">{recommendation.reason}</p>
                          <p className="text-sm text-gray-500 mt-2">
                            Based on current market metrics: Trend {marketMetrics?.trend}%, 
                            Volatility {marketMetrics?.volatility}%, 
                            Demand {marketMetrics?.demand}%, 
                            and your ROI of {roi.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center p-4">
                  <p className="text-gray-500">Enter a purchase price in the ROI Calculator to get a personalized recommendation.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Button className="flex-1" onClick={handleAddToCollection}>
              <Plus className="mr-2 h-4 w-4" />
              Add Card to Collection
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                resetSearch();
                // Clear form fields when starting new search
                setPlayerName("");
                setCardYear("");
                setCardSet("");
                setCardVariation("");
                setCardNumber("");
                setGrading("any");
              }}
            >
              <Search className="mr-2 h-4 w-4" />
              New Search
            </Button>
          </div>
        </div>
      )}

      {/* Dialog to complete missing card details */}
      <Dialog open={fixDialogOpen} onOpenChange={setFixDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Complete card details</DialogTitle>
          </DialogHeader>
          {draftCard && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Player Name *</Label>
                <Input value={draftCard.playerName || ''} onChange={e=>setDraftCard({...draftCard, playerName:e.target.value})} />
              </div>
              <div>
                <Label>Year *</Label>
                <Input value={draftCard.year || ''} onChange={e=>setDraftCard({...draftCard, year:e.target.value})} />
              </div>
              <div>
                <Label>Card Set *</Label>
                <Input value={draftCard.cardSet || ''} onChange={e=>setDraftCard({...draftCard, cardSet:e.target.value})} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={()=>setFixDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveDraftCard} disabled={!draftCard?.playerName || !draftCard?.year || !draftCard?.cardSet}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}