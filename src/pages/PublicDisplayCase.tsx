import { DirectFixer } from '@/components/display-cases/DirectFixer';
import { useParams } from "react-router-dom";
import { useDisplayCase } from "@/hooks/useDisplayCase";
import { ShareButton } from "@/components/ShareButton";
import LikeButton from "@/components/display/LikeButton";
import { CommentSection } from "@/components/display-cases/CommentSection";
import { Card } from "@/types/Card";
import { DisplayCaseComment } from "@/lib/firebase/displayCases";
import { MessageSellerButton } from "@/components/display/MessageSellerButton";
import { EnhancedShareButton } from "@/components/display/EnhancedShareButton";
import { DisplayCaseDebugging } from '@/components/display-cases/DisplayCaseDebugging';
import { SyncDisplayCase } from '@/components/display-cases/SyncDisplayCase';
import { CardDebugger } from '@/components/display-cases/CardDebugger';
import { useState, useEffect, useCallback } from 'react';
import { ensurePublicDisplayCase } from '@/utils/displayCaseUtils';
import { Button } from "@/components/ui/button";
import { doc, getDoc, updateDoc, collection, getDocs, query, where, increment } from 'firebase/firestore';
import { db } from "@/lib/firebase/config";
import { DisplayCaseLoading } from '@/components/display-cases/DisplayCaseLoading';
import { useAuth } from "@/context/AuthContext";
import DisplayCaseCardGrid from '@/components/display-cases/DisplayCaseCardGrid';

// Fallback cards to show when no real cards can be loaded
const fallbackCards: Card[] = [
  {
    id: "card1",
    playerName: "Example Player 1",
    year: "2023",
    cardSet: "Example Set",
    cardNumber: "",
    tags: ["Basketball", "2023"],
    imageUrl: "https://placehold.co/300x420/e2e8f0/1e293b?text=Card+1",
    ownerId: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "card2",
    playerName: "Example Player 2", 
    year: "2023",
    cardSet: "Example Set",
    cardNumber: "",
    tags: ["Baseball", "2023"],
    imageUrl: "https://placehold.co/300x420/e2e8f0/1e293b?text=Card+2",
    ownerId: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "card3",
    playerName: "Example Player 3",
    year: "2022",
    cardSet: "Premium Set",
    cardNumber: "",
    tags: ["Football", "2022"],
    imageUrl: "https://placehold.co/300x420/e2e8f0/1e293b?text=Card+3",
    ownerId: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export default function PublicDisplayCase() {
  const { publicId } = useParams<{ publicId: string }>();
  console.log("Received publicId from URL:", publicId);
  
  const { user } = useAuth();
  const { displayCase, cards, isLoading } = useDisplayCase(publicId);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [reloadFlag, setReloadFlag] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  const [loadingFix, setLoadingFix] = useState(false);
  const [fixAttempted, setFixAttempted] = useState(false);
  const [usingFallbackCards, setUsingFallbackCards] = useState(false);
  const [showDebugTools, setShowDebugTools] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Auto-recovery: When the page loads and no display case is found, try to recover it
  useEffect(() => {
    if (publicId && !isLoading && !displayCase && !isRecovering) {
      setIsRecovering(true);
      console.log("Display case not found, attempting auto-recovery");
      // Set a timeout to prevent hanging in recovery state
      const timeoutId = setTimeout(() => {
        console.log("Recovery timeout reached - stopping recovery");
        setIsRecovering(false);
      }, 5000); // 5 second timeout
      
      ensurePublicDisplayCase(publicId, user?.uid)
        .then(success => {
          clearTimeout(timeoutId); // Clear the timeout if we get a response
          if (success) {
            console.log("Successfully recovered display case, reloading page");
            // Reload the page to see the recovered display case
            window.location.reload();
          } else {
            console.log("Could not recover display case");
            setIsRecovering(false);
          }
        })
        .catch(error => {
          clearTimeout(timeoutId); // Clear the timeout if we get an error
          console.error("Error during auto-recovery:", error);
          setIsRecovering(false);
        })
        .finally(() => {
          // Final safety to make sure we never hang
          clearTimeout(timeoutId);
          setIsRecovering(false);
        });
    }
  }, [publicId, isLoading, displayCase, isRecovering, user?.uid]);

  // Add loading timeout check
  useEffect(() => {
    // If we've been loading for more than 8 seconds, set the timeout flag
    let timer: NodeJS.Timeout | null = null;
    
    if (isLoading) {
      timer = setTimeout(() => {
        console.log("Loading timeout reached, showing recovery options");
        setLoadingTimeout(true);
      }, 8000); // 8 seconds
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading]);

  // Force a re-fetch every 3 seconds if we have no cards but have cardIds
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (displayCase?.cardIds?.length && cards.length === 0 && reloadFlag < 3) {
      console.log(`Auto-refresh attempt ${reloadFlag + 1}/3: Display case has cardIds but no cards loaded`);
      timer = setTimeout(() => {
        console.log("Auto-refreshing page to try loading cards again...");
        setReloadFlag(prev => prev + 1);
      }, 3000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [displayCase, cards, reloadFlag]);

  // Show fallback cards if we can't load real ones
  useEffect(() => {
    // If we have a display case but no cards, prepare to use fallback
    if (displayCase && cards.length === 0 && !fixAttempted) {
      setUsingFallbackCards(true);
    }
  }, [displayCase, cards, fixAttempted]);
  
  const fixDisplayCase = async () => {
    if (!displayCase || !publicId) return;
    
    setLoadingFix(true);
    
    try {
      // Try to update the display case with some example card IDs
      const docRef = doc(db, "public_display_cases", publicId);
      
      await updateDoc(docRef, {
        cardIds: ["card1", "card2", "card3"]
      });
      
      console.log("Display case updated with example card IDs");
      setFixAttempted(true);
      
      // Force reload the page to see the changes
      window.location.reload();
    } catch (error) {
      console.error("Failed to update display case:", error);
    } finally {
      setLoadingFix(false);
    }
  };

  const handleManualRecovery = async () => {
    if (!publicId) return;
    
    setIsRecovering(true);
    console.log("Manually triggering display case recovery");
    
    const timeoutId = setTimeout(() => {
      console.log("Manual recovery timeout reached - stopping recovery");
      setIsRecovering(false);
    }, 8000); // 8 second timeout
    
    try {
      const success = await ensurePublicDisplayCase(publicId, user?.uid);
      clearTimeout(timeoutId);
      if (success) {
        console.log("Successfully recovered display case, reloading page");
        window.location.reload();
      } else {
        console.log("Could not recover display case");
        setIsRecovering(false);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error during manual recovery:", error);
      setIsRecovering(false);
    } finally {
      clearTimeout(timeoutId);
      setIsRecovering(false);
    }
  };

  const handleView = useCallback(async () => {
    if (!displayCase) return;
    
    try {
      const displayCaseRef = doc(db, "public_display_cases", displayCase.id);
      await updateDoc(displayCaseRef, {
        visits: increment(1)
      });
    } catch (error) {
      console.error("Error updating view count:", error);
    }
  }, [displayCase]);

  // Debug output
  console.log("PublicDisplayCase rendering with publicId:", publicId);
  if (displayCase) {
    console.log("Display case found:", displayCase);
    console.log("Card IDs in display case:", displayCase.cardIds || []);
    console.log("Cards loaded:", cards.length);
  }
  
  // Show loading or recovering state
  if (isLoading) {
    // Show timeout message if loading takes too long
    if (loadingTimeout) {
      return (
        <div className="text-center mt-10 p-6 max-w-lg mx-auto bg-white rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Taking Longer Than Expected</h2>
          <p className="text-gray-500 mb-4">
            We're having trouble loading this display case. Would you like to try to fix it?
          </p>
          <Button 
            onClick={handleManualRecovery} 
            disabled={isRecovering}
            className="mb-4"
          >
            {isRecovering ? "Attempting to Fix..." : "Try to Fix Display Case"}
          </Button>
          {publicId && user && (
            <div className="mt-6 border-t pt-4">
              <h3 className="font-medium mb-2">Advanced Options</h3>
              <DirectFixer displayCaseId={publicId} />
            </div>
          )}
        </div>
      );
    }
    
    return <DisplayCaseLoading
      publicId={publicId}
      isLoading={isLoading}
      isRecovering={isRecovering}
      onManualFix={handleManualRecovery}
    />;
  }
  
  if (isRecovering) {
    return (
      <div className="text-center mt-10">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent inline-block mb-2"></div>
        <p>Attempting to recover display case...</p>
      </div>
    );
  }

  // If no display case was found
  if (!displayCase) {
    return (
      <div className="text-center mt-10 p-6 max-w-lg mx-auto bg-white rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Display Case Not Found</h2>
        <p className="text-gray-500 mb-4">
          This display case either doesn't exist or hasn't been shared publicly.
        </p>
        {publicId && (
          <div className="mt-6 border-t pt-4">
            <button
              onClick={handleManualRecovery}
              className="text-sm text-blue-600 underline mb-4 block"
              disabled={isRecovering}
            >
              🔧 Manually Attempt Recovery
            </button>
            
            {user ? (
              <>
                <h3 className="font-medium mb-2">Advanced Options</h3>
                <DirectFixer displayCaseId={publicId} />
              </>
            ) : (
              <p className="text-sm text-gray-500">
                You need to be logged in for additional options to fix this display case.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Use either real cards or fallback cards
  const displayCards = cards.length > 0 ? cards : (usingFallbackCards ? fallbackCards : []);

  useEffect(() => {
    if (displayCase) {
      handleView();
    }
  }, [displayCase, handleView]);

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

        <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
          <span>Created: {displayCase.createdAt.toLocaleDateString()}</span>
          <span>Theme: {displayCase.background || "Default"}</span>
          <LikeButton displayCaseId={displayCase.id} />
        </div>

        <div className="flex justify-center space-x-4">
          <EnhancedShareButton 
            publicId={displayCase.publicId} 
            title={displayCase.name}
          />
          <MessageSellerButton 
            sellerId={displayCase.userId} 
            displayCaseId={displayCase.id}
            sellerName="Owner"
          />
          <span className="inline-flex items-center text-gray-500 text-sm">👁️ {displayCase.visits || 0} views</span>
        </div>
        
        {cards.length === 0 && !usingFallbackCards && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-amber-700 mb-2">No cards found in this display case. Would you like to add example cards?</p>
            {user ? (
              <Button 
                onClick={fixDisplayCase} 
                variant="outline" 
                size="sm" 
                disabled={loadingFix}
              >
                {loadingFix ? "Adding cards..." : "Add Example Cards"}
              </Button>
            ) : (
              <p className="text-xs text-amber-600">Log in to add example cards or fix this display case.</p>
            )}
          </div>
        )}
        
        {usingFallbackCards && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-700 text-sm">
              Showing example cards since no real cards could be loaded.
            </p>
          </div>
        )}
      </div>

      {/* Cards Display */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Cards</h2>
          {cards.length === 0 && publicId && user && (
            <button 
              onClick={() => setShowAdvancedTools(!showAdvancedTools)}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              {showAdvancedTools ? "Hide Tools" : "Fix Empty Display Case"}
            </button>
          )}
        </div>
        
        {displayCards.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-3xl mb-2">📭</div>
            <h3 className="text-xl font-medium mb-2">Empty Display Case</h3>
            <p className="text-gray-500 mb-4 max-w-md mx-auto">
              This display case doesn't contain any cards from the owner's collection.
            </p>
            
            {/* Display diagnostic info if display case has cardIds but no cards */}
            {displayCase.cardIds && displayCase.cardIds.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md text-sm mx-auto max-w-md">
                <p className="font-medium text-yellow-800 mb-1">
                  Display case has {displayCase.cardIds.length} card IDs but no cards could be loaded
                </p>
                <p className="text-yellow-700">
                  This could be due to the cards being saved incorrectly or missing from the database.
                </p>
                {user ? (
                  <div className="mt-3">
                    <CardDebugger 
                      displayCaseId={displayCase.id}
                      cardIds={displayCase.cardIds}
                    />
                    <button
                      onClick={handleManualRecovery}
                      className="mt-3 text-sm text-blue-600 underline"
                      disabled={isRecovering}
                    >
                      🔧 Attempt Recovery
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-600">
                    Log in to view debugging tools or fix this display case.
                  </p>
                )}
              </div>
            )}
            
            {publicId && showAdvancedTools && user && (
              <div className="space-y-6 max-w-md mx-auto mt-4">
                <SyncDisplayCase displayCaseId={publicId} />
                <DirectFixer displayCaseId={publicId} />
                <DisplayCaseDebugging displayCaseId={publicId} />
              </div>
            )}
          </div>
        ) : (
          <>
            <DisplayCaseCardGrid cards={displayCards} />
            <div className="block md:hidden text-xs text-gray-400 mt-2 text-center">
              Tap cards to view details
            </div>
          </>
        )}
      </div>

      {/* Comments Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <CommentSection displayCaseId={displayCase.id} />
      </div>

      {/* Only show advanced debug tools to logged in users */}
      {user && (
        <div className="bg-white rounded-xl shadow-md p-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Display Case Tools</h2>
            <button 
              onClick={() => setShowDebugTools(!showDebugTools)}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              {showDebugTools ? "Hide Advanced Tools" : "Show Advanced Tools"}
            </button>
          </div>
          
          {publicId && showDebugTools && (
            <div className="space-y-4">
              <button
                onClick={handleManualRecovery}
                className="block w-full p-2 text-sm text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 mb-4"
                disabled={isRecovering}
              >
                🔧 Manually Attempt Recovery
              </button>
              <DisplayCaseDebugging displayCaseId={publicId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
} 