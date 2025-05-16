import React, { useState, useEffect } from 'react';
import { useDisplayCases } from '../hooks/display/useDisplayCases';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { CreateDisplayCaseModal } from '../components/display-cases/CreateDisplayCaseModal';
import DisplayCaseGrid from '../components/display-cases/DisplayCaseGrid';
import { useAuth } from '../context/AuthContext';
import { DisplayCase } from '../types/display-case';
import { Card } from '../types/Card';
import { Skeleton } from '../components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/config";

export default function DisplayCases() {
  const { displayCases, isLoading } = useDisplayCases();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showRealImages, setShowRealImages] = useState(false);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [displayCasesWithCards, setDisplayCasesWithCards] = useState<DisplayCase[]>([]);
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
        const displayCasesWithCardsPromises = (displayCases as DisplayCase[]).map(async (displayCase) => {
          if (!displayCase.cardIds?.length) {
            return displayCase;
          }

          const cards: Card[] = [];
          for (const cardId of displayCase.cardIds) {
            const cardDoc = await getDoc(doc(db, 'cards', cardId));
            if (cardDoc.exists()) {
              cards.push(cardDoc.data() as Card);
            }
          }

          return {
            ...displayCase,
            cards
          };
        });
        
        const result = await Promise.all(displayCasesWithCardsPromises);
        setDisplayCasesWithCards(result);
      } catch (error) {
        console.error("Error fetching card data:", error);
      } finally {
        setIsLoadingCards(false);
      }
    }
    
    fetchCardData();
  }, [displayCases, isLoading, showRealImages, user]);
  
  const isDisplayCasesLoading = isLoading || (showRealImages && isLoadingCards);
  const displayCasesToRender = showRealImages ? displayCasesWithCards : (displayCases ?? []);

  return (
    <div className="p-4">
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
          </div>
        </div>
      </div>

      {isDisplayCasesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6">
              <Skeleton className="h-48 w-full mb-4" />
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
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
        <DisplayCaseGrid displayCases={displayCasesToRender} />
      )}

      <CreateDisplayCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
} 