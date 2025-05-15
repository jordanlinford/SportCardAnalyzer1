import React, { useState, useEffect } from 'react';
import { useDisplayCases } from '@/hooks/display/useDisplayCases';
import { CreateDisplayCaseModal } from '@/components/display-cases/CreateDisplayCaseModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { DisplayCaseDebugger } from '@/components/display-cases/DisplayCaseDebugger';
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Card } from "@/types/Card";
import { useAuth } from "@/context/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function DisplayCases() {
  const { displayCases, isLoading } = useDisplayCases();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  const [showRealImages, setShowRealImages] = useState(true);
  const [displayCasesWithCards, setDisplayCasesWithCards] = useState<any[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Fetch display cases with their card images
  useEffect(() => {
    if (!showRealImages || !user?.uid || isLoading || !displayCases?.length) {
      return;
    }
    
    async function fetchCardData() {
      setIsLoadingCards(true);
      
      try {
        // Process each display case to fetch its cards
        const displayCasesWithCardsPromises = displayCases?.map(async (displayCase) => {
          // Skip if no card IDs
          if (!displayCase.cardIds || !Array.isArray(displayCase.cardIds) || displayCase.cardIds.length === 0) {
            return { ...displayCase, cards: [] };
          }
          
          // Try to fetch each card
          const cardPromises = displayCase.cardIds.map(async (cardId) => {
            // First try collection path
            try {
              if (user?.uid) {
                const cardDoc = await getDoc(doc(db, "users", user.uid, "collection", cardId));
                if (cardDoc.exists()) {
                  return { 
                    id: cardDoc.id,
                    ...cardDoc.data(),
                    tags: cardDoc.data().tags || []
                  } as Card;
                }
              }
            } catch (err) {
              // Silently fail
            }
            
            // Then try cards path
            try {
              if (user?.uid) {
                const cardDoc = await getDoc(doc(db, "users", user.uid, "cards", cardId));
                if (cardDoc.exists()) {
                  return { 
                    id: cardDoc.id,
                    ...cardDoc.data(),
                    tags: cardDoc.data().tags || []
                  } as Card;
                }
              }
            } catch (err) {
              // Silently fail
            }
            
            return null;
          });
          
          const cards = (await Promise.all(cardPromises)).filter(Boolean) as Card[];
          
          return {
            ...displayCase,
            cards
          };
        });
        
        const result = await Promise.all(displayCasesWithCardsPromises || []);
        setDisplayCasesWithCards(result || []);
      } catch (error) {
        console.error("Error fetching card data:", error);
      } finally {
        setIsLoadingCards(false);
      }
    }
    
    fetchCardData();
  }, [displayCases, isLoading, showRealImages, user]);
  
  const isDisplayCasesLoading = isLoading || (showRealImages && isLoadingCards);
  const displayCasesToRender = showRealImages ? displayCasesWithCards : displayCases;

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-8 gap-4 sm:gap-0">
        <h1 className="text-xl sm:text-2xl font-bold">Display Cases</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center space-x-2 mr-0 sm:mr-4">
            <Checkbox 
              id="show-real-images" 
              checked={showRealImages}
              onCheckedChange={(checked) => setShowRealImages(!!checked)}
            />
            <Label htmlFor="show-real-images" className="ml-2 text-sm sm:text-base">Show real card images</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsCreateModalOpen(true)} className="h-9 px-3 py-1 text-sm sm:px-4 sm:py-2 sm:text-base">
              Create New
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowDebugger(!showDebugger)}
              className="h-9 px-3 py-1 text-sm sm:px-4 sm:py-2 sm:text-base"
            >
              {showDebugger ? "Hide Debugger" : "Debug Tools"}
            </Button>
          </div>
        </div>
      </div>

      {showDebugger && (
        <div className="mb-4 sm:mb-6">
          <DisplayCaseDebugger />
        </div>
      )}

      {isDisplayCasesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-36 sm:h-48 rounded-lg" />
          ))}
        </div>
      ) : displayCasesToRender?.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-600 mb-3 sm:mb-4">
            No display cases yet
          </h2>
          <p className="text-gray-500 mb-4 sm:mb-6 text-sm sm:text-base">
            Create your first display case to showcase your favorite cards
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            Create Display Case
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {displayCasesToRender?.map((displayCase) => (
            <div
              key={displayCase.id}
              className="bg-white dark:bg-background-dark rounded-xl sm:rounded-2xl shadow-md sm:shadow-lg border border-primary/20 sm:border-2 dark:border-secondary/30 p-3 sm:p-6 hover:shadow-xl transition-shadow cursor-pointer touch-manipulation"
              onClick={() => navigate(`/display-cases/${displayCase.id}`)}
            >
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <div>
                  <h2 className="text-base sm:text-xl font-heading font-bold text-primary dark:text-secondary mb-0 sm:mb-1">{displayCase.name}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 font-body mt-1 line-clamp-2">{displayCase.description}</p>
                  <div className="flex items-center space-x-3 sm:space-x-4 mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
                    <span className="flex items-center">❤️ {displayCase.likes || 0}</span>
                    <span className="flex items-center">💬 {displayCase.comments?.length || 0}</span>
                    <span className="flex items-center">👁️ {displayCase.visits || 0}</span>
                  </div>
                </div>
              </div>
              
              {showRealImages && displayCase.cards ? (
                // New Implementation with real card images
                <div className="grid grid-cols-2 gap-2">
                  {displayCase.cards.slice(0, 4).map((card: Card) => (
                    <div key={card.id} className="rounded-lg sm:rounded-xl aspect-[3/4] flex items-center justify-center overflow-hidden">
                      {card.imageUrl ? (
                        <img 
                          src={card.imageUrl} 
                          alt={card.playerName} 
                          className="w-full h-full object-cover rounded-lg sm:rounded-xl"
                          loading="lazy"
                        />
                      ) : (
                        <div className="bg-gray-100 dark:bg-gray-800 w-full h-full flex items-center justify-center p-2">
                          <span className="text-xs text-gray-500 text-center">{card.playerName || `Card ${card.id}`}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {displayCase.cards.length < 4 && [...Array(4 - displayCase.cards.length)].map((_, i) => (
                    <div key={`empty-${i}`} className="bg-gray-100 dark:bg-gray-800 rounded-lg sm:rounded-xl aspect-[3/4] flex items-center justify-center">
                      <span className="text-xs text-gray-500">Empty</span>
                    </div>
                  ))}
                </div>
              ) : (
                // Original Implementation
                <div className="grid grid-cols-2 gap-2">
                  {displayCase.cardIds?.slice(0, 4).map((cardId: string) => (
                    <div key={cardId} className="bg-gray-100 dark:bg-gray-800 rounded-lg sm:rounded-xl p-2 aspect-[3/4] flex items-center justify-center">
                      <span className="text-xs text-gray-500">Card {cardId}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateDisplayCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
} 