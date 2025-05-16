import { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { Card } from "@/types/Card";
import { NewCommentSection } from "@/components/display-cases/NewCommentSection";
import LikeButton from "@/components/display/LikeButton";
import { EnhancedShareButton } from "@/components/display/EnhancedShareButton";
import { MessageSellerButton } from "@/components/display/MessageSellerButton";
import { SyncDisplayCase } from '@/components/display-cases/SyncDisplayCase';
import { DirectFixer } from '@/components/display-cases/DirectFixer';
import { ensurePublicDisplayCase } from '@/utils/displayCaseUtils';
import DisplayCaseCardGrid from '@/components/display-cases/DisplayCaseCardGrid';

// Define a proper interface for DisplayCase
interface DisplayCase {
  id: string;
  name: string;
  description?: string;
  userId?: string;
  cardIds?: string[];
  isPublic?: boolean;
  background?: string;
  createdAt: Date;
  updatedAt: Date;
  likes?: number;
  comments?: any[];
}

export default function SimplePublicDisplayCase() {
  console.log("SimplePublicDisplayCase component mounting");
  const { publicId } = useParams<{ publicId: string }>();
  console.log("PublicId from URL params:", publicId);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  console.log("Current user:", user ? `ID: ${user.uid}` : "Not logged in");
  
  const [displayCase, setDisplayCase] = useState<DisplayCase | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);

  // Load the display case
  useEffect(() => {
    async function loadDisplayCase() {
      console.log("loadDisplayCase function called, publicId:", publicId);
      if (!publicId) {
        console.error("No publicId provided in URL");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const displayCaseRef = doc(db, "public_display_cases", publicId);
        console.log(`Attempting to load public display case with ID: ${publicId}`);
        const displayCaseSnap = await getDoc(displayCaseRef);
        
        if (!displayCaseSnap.exists()) {
          console.log("Public display case not found, attempting auto-recovery");
          
          // Try to auto-recover the display case
          if (user) {
            try {
              console.log("User is authenticated, attempting recovery with user ID:", user.uid);
              const recovered = await ensurePublicDisplayCase(publicId, user.uid);
              console.log("Recovery attempt result:", recovered);
              
              if (recovered) {
                console.log("Successfully recovered display case, reloading");
                // Reload the display case
                const refreshedSnap = await getDoc(displayCaseRef);
                if (refreshedSnap.exists()) {
                  console.log("Recovered display case loaded successfully");
                  const data = refreshedSnap.data();
                  console.log("Display case data:", data);
                  
                  const displayCaseData: DisplayCase = {
                    id: refreshedSnap.id,
                    name: data.name || "Untitled Display Case",
                    description: data.description,
                    userId: data.userId,
                    cardIds: data.cardIds || [],
                    isPublic: data.isPublic !== false,
                    background: data.background || "default",
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date(),
                    likes: data.likes || 0,
                    comments: data.comments || []
                  };
                  
                  setDisplayCase(displayCaseData);
                  
                  // Check if current user is the owner
                  if (user && displayCaseData.userId === user.uid) {
                    setIsOwner(true);
                  }
                  
                  // Auto-load cards
                  await loadCardsForDisplayCase(displayCaseData);
                  setIsLoading(false);
                  return;
                }
              } else {
                console.log("Recovery attempt failed");
              }
            } catch (err) {
              console.error("Auto-recovery failed:", err);
            }
          } else {
            console.log("User not authenticated, cannot attempt recovery");
          }
          
          setIsLoading(false);
          return;
        }
        
        console.log("Public display case found, loading data");
        const data = displayCaseSnap.data();
        console.log("Display case data from Firestore:", data);
        
        const displayCaseData: DisplayCase = {
          id: displayCaseSnap.id,
          name: data.name || "Untitled Display Case",
          description: data.description,
          userId: data.userId,
          cardIds: data.cardIds || [],
          isPublic: data.isPublic !== false,
          background: data.background || "default",
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          likes: data.likes || 0,
          comments: data.comments || []
        };
        
        setDisplayCase(displayCaseData);
        console.log("Display case set to state:", displayCaseData);
        
        // Check if current user is the owner
        if (user && displayCaseData.userId === user.uid) {
          console.log("Current user is the owner of this display case");
          setIsOwner(true);
        }
        
        // Load cards if there are any card IDs
        await loadCardsForDisplayCase(displayCaseData);
      } catch (error) {
        console.error("Error loading display case:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    async function loadCardsForDisplayCase(displayCaseData: DisplayCase) {
      console.log("Loading cards for display case, cardIds:", displayCaseData.cardIds);
      if (displayCaseData.cardIds && displayCaseData.cardIds.length > 0) {
        const cardPromises = displayCaseData.cardIds.map(async (cardId: string) => {
          // Skip example cards
          if (cardId === 'card1' || cardId === 'card2' || cardId === 'card3') {
            return null;
          }
          
          try {
            // Try to get the card from the cards collection
            const cardRef = doc(db, "cards", cardId);
            const cardSnap = await getDoc(cardRef);
            
            if (cardSnap.exists()) {
              return { id: cardSnap.id, ...cardSnap.data() } as Card;
            }
            
            // If card not in main collection, try user's collection
            if (displayCaseData.userId) {
              const userCardRef = doc(db, "users", displayCaseData.userId, "collection", cardId);
              const userCardSnap = await getDoc(userCardRef);
              
              if (userCardSnap.exists()) {
                return { id: userCardSnap.id, ...userCardSnap.data() } as Card;
              }
            }
            
            console.warn(`Card ${cardId} not found`);
            return null;
          } catch (err) {
            console.error(`Error loading card ${cardId}:`, err);
            return null;
          }
        });
        
        const loadedCards = await Promise.all(cardPromises);
        const validCards = loadedCards.filter(Boolean) as Card[];
        console.log(`Loaded ${validCards.length} valid cards out of ${displayCaseData.cardIds.length} card IDs`);
        setCards(validCards);
      } else {
        console.log("No card IDs in display case");
      }
    }
    
    loadDisplayCase();
  }, [publicId, user]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <h2 className="text-xl font-medium mb-2">Loading Display Case</h2>
          <p className="text-sm text-gray-500">Please wait...</p>
        </div>
      </div>
    );
  }

  if (!displayCase) {
    return (
      <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-xl shadow-sm">
        <h1 className="text-xl font-bold mb-4">Display Case Not Found</h1>
        <p className="text-gray-600 mb-4">
          This display case doesn't exist or may have been removed.
        </p>
        <p className="text-gray-600 mb-4">
          Attempted to load display case with ID: {publicId || "No ID found in URL"}
        </p>
        
        {publicId && user && (
          <div className="mt-8 p-4 border border-amber-200 bg-amber-50 rounded-md">
            <h3 className="font-semibold mb-2">Fix Missing Display Case</h3>
            <p className="text-sm mb-4">
              If you're the owner of this display case, we can try to recover it from your private collection.
            </p>
            <Button
              onClick={async () => {
                if (!publicId) return;
                setIsFixing(true);
                setFixResult(null);
                try {
                  console.log("Attempting to recover display case with ID:", publicId);
                  const result = await ensurePublicDisplayCase(publicId, user.uid);
                  console.log("Recovery result:", result);
                  
                  if (result) {
                    setFixResult("Display case recovered! Refreshing page...");
                    setTimeout(() => window.location.reload(), 1500);
                  } else {
                    setFixResult("Couldn't recover display case. Make sure you've created it and added cards.");
                  }
                } catch (error) {
                  console.error("Error fixing display case:", error);
                  setFixResult(`Error: ${String(error)}`);
                } finally {
                  setIsFixing(false);
                }
              }}
              disabled={isFixing}
            >
              {isFixing ? "Attempting to recover..." : "Recover My Display Case"}
            </Button>
            
            <Button
              onClick={() => {
                console.log("Returning to display cases list");
                navigate("/display-cases");
              }}
              className="ml-2"
              variant="outline"
            >
              View All Display Cases
            </Button>
            
            {fixResult && (
              <div className={`mt-3 p-2 text-sm rounded ${fixResult.includes("Error") || fixResult.includes("Couldn't") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {fixResult}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Display Case Header */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">{displayCase.name}</h1>
          {displayCase.description && (
            <p className="text-gray-500 max-w-2xl mx-auto">{displayCase.description}</p>
          )}
        </div>

        <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
          <span>Created: {displayCase.createdAt.toLocaleDateString()}</span>
          <LikeButton displayCaseId={displayCase.id} />
        </div>

        <div className="flex justify-center space-x-2">
          <EnhancedShareButton 
            publicId={displayCase.id} 
            title={displayCase.name}
          />
          {displayCase.userId && (
            <MessageSellerButton 
              sellerId={displayCase.userId} 
              displayCaseId={displayCase.id}
              sellerName="Owner"
            />
          )}
        </div>
      </div>

      {/* Cards Display */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Cards</h2>
        </div>

        {cards.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-3xl mb-2">📭</div>
            <h3 className="text-xl font-medium mb-2">Empty Display Case</h3>
            <p className="text-gray-500 mb-4 max-w-md mx-auto">
              This display case doesn't contain any cards from the owner's collection.
            </p>
            
            {isOwner ? (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg max-w-md mx-auto">
                <p className="text-amber-800 mb-2 font-medium">You own this display case</p>
                <p className="text-amber-700 text-sm mb-4">
                  Add cards from your collection to showcase them here.
                </p>
                <div className="space-y-2">
                  <Button 
                    onClick={() => window.location.href = `/display-cases/${publicId}`}
                    size="sm"
                    className="w-full"
                  >
                    Manage This Display Case
                  </Button>
                  
                  <Button 
                    onClick={() => window.location.href = "/collection"}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    Go To My Collection
                  </Button>

                  <div className="pt-4 mt-4 border-t border-amber-200">
                    <details className="text-left">
                      <summary className="cursor-pointer text-amber-800 font-medium text-sm">Troubleshooting Options</summary>
                      <div className="mt-3 space-y-2">
                        <p className="text-amber-700 text-xs mb-2">
                          If you've already added cards to your display case but they're not showing here, try these options:
                        </p>
                        <Button 
                          onClick={async () => {
                            if (!publicId || !user) return;
                            try {
                              setIsLoading(true);
                              // Direct approach - sync cards from private to public
                              const privateRef = doc(db, "users", user.uid, "display_cases", publicId);
                              const privateSnap = await getDoc(privateRef);
                              
                              if (privateSnap.exists() && privateSnap.data().cardIds?.length) {
                                const cardIds = privateSnap.data().cardIds;
                                console.log("Found cards in private display case:", cardIds);
                                
                                // Update public display case
                                const publicRef = doc(db, "public_display_cases", publicId);
                                await updateDoc(publicRef, {
                                  cardIds: cardIds,
                                  updatedAt: new Date()
                                });
                                
                                console.log("Updated public display case with cards from private case");
                                // Reload the page
                                window.location.reload();
                              } else {
                                alert("No cards found in your private display case. Add cards in the Manage Display Case page first.");
                              }
                            } catch (error) {
                              console.error("Error syncing cards:", error);
                              alert("Error syncing cards: " + String(error));
                            } finally {
                              setIsLoading(false);
                            }
                          }} 
                          size="sm"
                          variant="secondary"
                          className="w-full text-xs"
                        >
                          Force Sync Cards From Private Case
                        </Button>
                        
                        <Button 
                          onClick={() => {
                            if (!publicId) return;
                            // Direct link to display case with debug mode
                            window.location.href = `/display-cases/${publicId}?debug=true`;
                          }}
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                        >
                          Debug Display Case
                        </Button>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            ) : user ? (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
                <p className="text-blue-800 text-sm mb-4">
                  This collector hasn't added any cards to their display case yet.
                </p>
                <Button 
                  onClick={() => window.location.href = "/display-cases"}
                  size="sm"
                  variant="outline"
                >
                  Browse Other Display Cases
                </Button>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg max-w-md mx-auto">
                <p className="text-gray-700 text-sm mb-4">
                  This collector hasn't added any cards to their display case yet.
                </p>
                <p className="text-gray-500 text-xs">
                  Sign in to create your own display cases and showcase your collection.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <DisplayCaseCardGrid cards={cards} />
            <div className="block md:hidden text-xs text-gray-400 mt-2 text-center">
              Tap cards to view details
            </div>
          </>
        )}
      </div>

      {/* Comments Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <NewCommentSection displayCaseId={displayCase.id} />
      </div>
    </div>
  );
} 