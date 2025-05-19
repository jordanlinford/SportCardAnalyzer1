import React, { useState, useEffect } from 'react';
import CollectionGrid from '../components/CollectionGrid';
import { AddCardModal } from '../components/AddCardModal';
import { useCards } from '@/hooks/useCards';
import { Card as AppCard } from '@/types/Card';
import CollectionTable from '../components/CollectionTable';
import { EditCardModal } from '../components/EditCardModal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { CardService } from '@/services/CardService';
import axios from 'axios';
import { API_URL } from '@/lib/firebase/config';
import { collection, addDoc, Timestamp, getDocs } from 'firebase/firestore';

const CollectionPage: React.FC = () => {
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<AppCard | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isUpdatingValues, setIsUpdatingValues] = useState(false);
  const [updatingCardIds, setUpdatingCardIds] = useState<string[]>([]);
  const { user } = useAuth();

  const { data: cards = [], isLoading, error, retryFetchCards } = useCards();

  interface UpdateResp {
    success: boolean;
    updatedCount?: number;
    errorCount?: number;
    message?: string;
  }

  useEffect(() => {
    console.log("CollectionPage: Cards data loaded", {
      count: cards.length,
      loading: isLoading,
      error: error?.message
    });

    // Debug first few cards if any exist
    if (cards.length > 0) {
      console.log("CollectionPage: Sample card data:", 
        cards.slice(0, 2).map(card => ({
          id: card.id,
          player: card.playerName,
          values: {
            currentValue: card.currentValue,
            price: card.price,
            pricePaid: card.pricePaid
          }
        }))
      );
    }
  }, [cards, isLoading, error]);

  // Extract all unique tags from cards
  const allTags = Array.from(
    new Set(cards.flatMap((card: AppCard) => (card.tags || [])))
  ).sort();

  // Filter cards by tag if a tag filter is selected
  const filteredCards = tagFilter
    ? cards.filter((card: AppCard) => card.tags?.includes(tagFilter))
    : cards;

  const handleOpenAddCardModal = () => setIsAddCardModalOpen(true);
  const handleCloseAddCardModal = () => setIsAddCardModalOpen(false);

  // Handler for editing a card (works for both views)
  const handleEditCard = (card: AppCard) => setEditingCard(card);

  // New function to update a single card's value
  const handleUpdateSingleCard = async (card: AppCard) => {
    if (!user) {
      toast.error("You must be logged in to update card values");
      return;
    }

    // Add the card ID to the updating list
    setUpdatingCardIds(prev => [...prev, card.id]);
    toast.info(`Updating value for ${card.playerName}...`);

    try {
      // First, check if the scraper server is running
      try {
        interface HealthCheckResponse {
          status: string;
          message?: string;
        }
        
        const healthCheck = await axios.get<HealthCheckResponse>('http://localhost:3001/api/health');
        if (!healthCheck.data || healthCheck.data.status !== 'ok') {
          toast.error("eBay scraper server is not responding properly. Make sure it's running.");
          setUpdatingCardIds(prev => prev.filter(id => id !== card.id));
          return;
        }
        console.log("Scraper server health check passed:", healthCheck.data);
      } catch (error) {
        console.error("Scraper server health check failed:", error);
        toast.error("Cannot connect to the eBay scraper server. Make sure it's running on port 3001.");
        setUpdatingCardIds(prev => prev.filter(id => id !== card.id));
        return;
      }

      // Skip cards without required search fields
      if (!card.playerName || !card.year || !card.cardSet) {
        console.log(`Skipping card ${card.id} due to missing search fields`);
        toast.info(`Cannot update ${card.playerName || 'card'} - missing required search fields.`);
        setUpdatingCardIds(prev => prev.filter(id => id !== card.id));
        return;
      }

      // Prepare search parameters for the scraper API
      const searchParams = {
        playerName: card.playerName,
        year: card.year,
        cardSet: card.cardSet,
        cardNumber: card.cardNumber,
        variation: card.variation,
        grade: getFormattedGrade(card.condition)
      };

      // Log the exact search parameters for debugging
      console.log("Search parameters being sent to eBay scraper:", searchParams);
      
      // Create a more accurate search string that includes ALL card details
      const fullSearchString = `${card.year} ${card.playerName} ${card.cardSet} ${card.variation || ''} ${card.cardNumber} ${card.condition}`.trim();
      console.log("Full search string that would be used manually:", fullSearchString);

      // Call the scraper API to get latest sales data
      interface ScrapeResponse {
        success: boolean;
        listings: {
          date: string;
          price: number;
          totalPrice?: number;
        }[];
        count: number;
      }
      
      console.log(`Fetching data for: ${card.playerName} ${card.year} ${card.cardSet}`);
      
      try {
        // Add the fullSearchString to the parameters
        const enhancedParams = {
          ...searchParams,
          fullSearchString: fullSearchString, // Add this for more accurate searching
          useFullSearch: true // Tell the scraper to prioritize the full search string
        };

        // Use the absolute URL with the correct port instead of a relative URL
        const response = await axios.post<ScrapeResponse>(`${API_URL.replace(/\/$/, '')}/api/text-search`, { query: fullSearchString });
        
        console.log(`Response for ${card.playerName}: success=${response.data.success}, listings=${response.data.listings?.length || 0}`);
        
        if (response.data.success && response.data.listings && response.data.listings.length > 0) {
          // Sort by date, newest first
          const sortedListings = response.data.listings.sort((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });
          
          // Get average of the 3 most recent sales
          const recentSales = sortedListings.slice(0, 3);
          const totalPrice = recentSales.reduce((sum: number, listing) => 
            sum + (listing.totalPrice || listing.price || 0), 0);
          
          if (recentSales.length > 0 && totalPrice > 0) {
            const averagePrice = totalPrice / recentSales.length;
            console.log(`Found value for ${card.playerName}: $${averagePrice} (from ${recentSales.length} recent sales)`);
            
            // Always update if significantly different (1% difference is enough)
            // Removed the strict validation for single card updates
            if (averagePrice > 0) {
              const oldValue = card.currentValue || 0;
              await CardService.updateCard(user.uid, card.id, {
                currentValue: averagePrice,
              });
              toast.success(`Updated ${card.playerName} value from $${oldValue.toFixed(2)} to $${averagePrice.toFixed(2)}`);
              retryFetchCards();
            } else {
              toast.info(`No update needed for ${card.playerName}`);
            }
          } else {
            console.log(`No valid sales data for ${card.playerName} - totalPrice: ${totalPrice}, recentSales: ${recentSales.length}`);
            toast.info(`No recent sales data found for ${card.playerName}`);
          }
        } else {
          console.log(`No listings found for ${card.playerName}`);
          toast.info(`No sales listings found for ${card.playerName}`);
        }
      } catch (error) {
        console.error(`Error fetching data for ${card.playerName}:`, error);
        toast.error(`Error updating ${card.playerName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error processing card ${card.id}:`, error);
      toast.error(`Error updating ${card.playerName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Remove card from updating list
      setUpdatingCardIds(prev => prev.filter(id => id !== card.id));
    }
  };

  // NEW: Delegate collection update to backend
  const handleServerUpdate = async () => {
    if (!user) {
      toast.error('You must be logged in to update card values');
      return;
    }

    setIsUpdatingValues(true);
    try {
      const resp = await axios.post<UpdateResp>(`${API_URL.replace(/\/$/, '')}/api/update-collection/${user.uid}`);
      if (resp.data.success) {
        toast.success(`Updated values for ${resp.data.updatedCount || 0} cards`);
        await retryFetchCards();
      } else {
        toast.error(resp.data.message || 'Failed to update collection');
      }
    } catch (err: any) {
      console.error('Server update error', err);
      toast.error(err?.message || 'Server error');
    } finally {
      setIsUpdatingValues(false);
    }
  };

  // Add this helper function at the top of the CollectionPage component, right after the useState declarations
  const getFormattedGrade = (condition: string | undefined): string => {
    if (!condition) return 'raw';
    
    // Handle "Raw" condition
    if (condition.toLowerCase() === 'raw') return 'raw';
    
    // Handle PSA, BGS, SGC formats
    if (condition.toLowerCase().includes('psa') || 
        condition.toLowerCase().includes('bgs') || 
        condition.toLowerCase().includes('sgc')) {
      return condition; // Return full grading info for standard graded cards
    }
    
    // Otherwise, just return the condition as-is
    return condition;
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2">Loading your collection...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>Error loading collection: {error.message}</p>
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">My Collection {cards.length > 0 && `(${cards.length} cards)`}</h1>
        <div className="flex gap-2">
          <Button 
            onClick={handleServerUpdate} 
            disabled={isUpdatingValues || cards.length === 0}
            variant={cards.length === 0 ? "outline" : "secondary"}
          >
            {isUpdatingValues ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
                Updating All...
              </>
            ) : (
              "Update All Card Values"
            )}
          </Button>
        <Button onClick={handleOpenAddCardModal}>+ Add Card</Button>
        </div>
      </div>

      {/* Tag filter */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            className={`px-3 py-1 text-sm rounded-full border ${!tagFilter ? 'bg-blue-600 text-white' : 'bg-white'}`}
            onClick={() => setTagFilter(null)}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`px-3 py-1 text-sm rounded-full border ${tagFilter === tag ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => setTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 text-sm rounded border ${viewMode === 'table' ? 'bg-gray-200' : 'bg-white'}`}
            onClick={() => setViewMode('table')}
          >
            Table View
          </button>
          <button
            className={`px-3 py-1 text-sm rounded border ${viewMode === 'grid' ? 'bg-gray-200' : 'bg-white'}`}
            onClick={() => setViewMode('grid')}
          >
            Grid View
          </button>
        </div>
      </div>

      {/* Card Display */}
      {viewMode === 'table' ? (
        <CollectionTable 
          cards={filteredCards} 
          onEditCard={handleEditCard} 
          onUpdateCard={handleUpdateSingleCard}
          updatingCardIds={updatingCardIds}
        />
      ) : (
        <CollectionGrid 
          cards={filteredCards} 
          onEditCard={handleEditCard} 
          onUpdateCard={handleUpdateSingleCard}
          updatingCardIds={updatingCardIds}
          isModalOpen={isAddCardModalOpen || !!editingCard}
        />
      )}

      {/* Add Card Modal */}
      {isAddCardModalOpen && (
        <AddCardModal isOpen={isAddCardModalOpen} onClose={handleCloseAddCardModal} onCardAdded={handleCloseAddCardModal} />
      )}

      {/* Edit Card Modal */}
      {editingCard && (
        <EditCardModal 
          card={editingCard} 
          isOpen={!!editingCard} 
          onClose={() => setEditingCard(null)}
          onCardUpdated={() => setEditingCard(null)}
          onCardDeleted={() => setEditingCard(null)}
        />
      )}
    </div>
  );
};

export default CollectionPage; 