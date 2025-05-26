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
  const csvFileInputRef = React.useRef<HTMLInputElement>(null);

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
        
        const backendURL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
        const healthCheck = await axios.get<HealthCheckResponse>(`${backendURL}/api/health`);
        
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

      // Create a more accurate search string that includes ALL card details
      const fullSearchString = `${card.year} ${card.playerName} ${card.cardSet} ${card.variation || ''} ${card.cardNumber || ''} ${card.condition || ''}`.trim();
      console.log("Full search string:", fullSearchString);
      
      // Use the backend URL from environment variable with fallback to localhost
      const backendURL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
      
      // Call the scraper API to get latest sales data
      interface ScrapeResponse {
        success: boolean;
        listings: {
          date: string;
          price: number;
          totalPrice?: number;
        }[];
      }
      
      console.log(`Fetching data for: ${card.playerName} ${card.year} ${card.cardSet}`);
      
      try {
        // Send request to backend server
        const response = await axios.post<ScrapeResponse>(
          `${backendURL}/api/text-search`, 
          { query: fullSearchString },
          {
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );
        
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
            
            // Update the card with the new value
            if (averagePrice > 0) {
              const oldValue = card.currentValue || 0;
              await CardService.updateCard(user.uid, card.id, {
                currentValue: averagePrice,
                updatedAt: new Date().toISOString(),
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
      // Update multiple cards in sequence
      const cardsToUpdate = filteredCards.filter(card => 
        card.playerName && card.year && card.cardSet
      );
      
      if (cardsToUpdate.length === 0) {
        toast.info('No cards with complete information found to update');
        setIsUpdatingValues(false);
        return;
      }
      
      toast.info(`Updating values for ${cardsToUpdate.length} cards...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Update cards one by one to avoid overwhelming the server
      for (const card of cardsToUpdate) {
        try {
          // Add to updating IDs list
          setUpdatingCardIds(prev => [...prev, card.id]);
          
          // Wait a bit between requests to be nice to the server
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          await handleUpdateSingleCard(card);
          successCount++;
        } catch (error) {
          console.error(`Error updating card ${card.id}:`, error);
          errorCount++;
        } finally {
          // Remove from updating IDs list
          setUpdatingCardIds(prev => prev.filter(id => id !== card.id));
        }
      }
      
      // Final status update
      if (successCount > 0) {
        toast.success(`Updated values for ${successCount} cards`);
      }
      
      if (errorCount > 0) {
        toast.error(`Failed to update ${errorCount} cards`);
      }
      
      // Refresh cards data
      await retryFetchCards();
    } catch (err: any) {
      console.error('Batch update error', err);
      toast.error(err?.message || 'Failed to update collection');
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

  // CSV Export
  const handleExportCSV = () => {
    if (cards.length === 0) {
      toast.info('No cards to export');
      return;
    }
    const headers = [
      'playerName',
      'year',
      'cardSet',
      'cardNumber',
      'variation',
      'condition',
      'pricePaid',
      'currentValue',
      'tags'
    ];
    const rows = cards.map(card => headers.map(h => {
      const val: any = (card as any)[h];
      if (Array.isArray(val)) return `"${val.join(',')}"`;
      if (val === undefined || val === null) return '';
      return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `collection_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import
  const handleImportClick = () => {
    csvFileInputRef.current?.click();
  };

  const handleCSVFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error('You must be logged in to import cards');
      return;
    }
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = lines[0].split(',').map(h => h.trim());
      const requiredCols = ['playerName', 'year', 'cardSet'];
      for (const col of requiredCols) {
        if (!header.includes(col)) {
          toast.error(`Missing required column: ${col}`);
          return;
        }
      }
      const cardsToCreate: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        const values = row.match(/\"([^\"]*)\"|[^,]+/g) || []; // basic CSV splitting
        const record: any = {};
        header.forEach((h, idx) => {
          let val = values[idx] || '';
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).replace(/""/g, '"');
          }
          if (h === 'tags') {
            record[h] = val ? val.split(',').map((t: string) => t.trim()) : [];
          } else if (h === 'pricePaid' || h === 'currentValue') {
            record[h] = val ? parseFloat(val) : undefined;
          } else {
            record[h] = val;
          }
        });
        cardsToCreate.push(record);
      }

      if (cardsToCreate.length === 0) {
        toast.info('No cards found in CSV');
        return;
      }
      toast.info(`Importing ${cardsToCreate.length} cards...`);
      await CardService.batchCreateCards(user.uid, cardsToCreate as any);
      toast.success('Cards imported successfully');
      retryFetchCards();
    } catch (err: any) {
      console.error('CSV import error', err);
      toast.error(err?.message || 'Failed to import CSV');
    } finally {
      e.target.value = '';
    }
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
          <Button onClick={handleExportCSV} variant="outline">Export CSV</Button>
          <Button onClick={handleImportClick} variant="outline">Import CSV</Button>
          <input
            type="file"
            accept=".csv,text/csv"
            ref={csvFileInputRef}
            onChange={handleCSVFileChange}
            className="hidden"
            aria-label="Import CSV file"
          />
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