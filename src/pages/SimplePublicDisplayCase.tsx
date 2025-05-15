import { useState, useEffect } from 'react';
import { useParams } from "react-router-dom";
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
import { DisplayCaseMetaTags } from '@/components/display-cases/DisplayCaseMetaTags';
import { HelmetProvider } from 'react-helmet-async';
import { DisplayCase } from '@/types/display-case';

export default function SimplePublicDisplayCase() {
  const { publicId } = useParams<{ publicId: string }>();
  const { user } = useAuth();
  const [displayCase, setDisplayCase] = useState<DisplayCase | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [firstCardImage, setFirstCardImage] = useState<string | undefined>();

  useEffect(() => {
    async function loadDisplayCase() {
      if (!publicId) return;

      try {
        const displayCaseRef = doc(db, 'public_display_cases', publicId);
        const displayCaseSnap = await getDoc(displayCaseRef);

        if (!displayCaseSnap.exists()) {
          console.log("Display case not found");
          setIsLoading(false);
          return;
        }

        const data = displayCaseSnap.data();
        const displayCaseData: DisplayCase = {
          id: displayCaseSnap.id,
          name: data.name || "Untitled Display Case",
          description: data.description,
          userId: data.userId,
          cardIds: data.cardIds || [],
          tags: data.tags || [],
          theme: data.theme || 'wood',
          isPublic: data.isPublic !== false,
          createdAt: data.createdAt?.toDate() || new Date(),
          likes: data.likes || 0,
          comments: data.comments || [],
          visits: data.visits || 0,
          publicId: publicId
        };
        
        setDisplayCase(displayCaseData);
        
        // Check if current user is the owner
        if (user && displayCaseData.userId === user.uid) {
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

    loadDisplayCase();
  }, [publicId, user]);

  async function loadCardsForDisplayCase(displayCase: DisplayCase) {
    if (!displayCase.cardIds?.length) return;

    try {
      const cards: Card[] = [];
      for (const cardId of displayCase.cardIds) {
        const cardRef = doc(db, 'cards', cardId);
        const cardSnap = await getDoc(cardRef);
        if (cardSnap.exists()) {
          const cardData = cardSnap.data() as Card;
          cards.push({ ...cardData, id: cardSnap.id });
        }
      }
      setCards(cards);
      
      // Set the first card's image for meta tags
      if (cards.length > 0 && cards[0].imageUrl) {
        setFirstCardImage(cards[0].imageUrl);
      }
    } catch (error) {
      console.error("Error loading cards:", error);
    }
  }

  if (isLoading) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  if (!displayCase) {
    return <div className="text-center mt-10">Display case not found.</div>;
  }

  return (
    <HelmetProvider>
      <DisplayCaseMetaTags displayCase={displayCase} firstCardImage={firstCardImage} />
      <div className="p-4 space-y-6 max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">{displayCase.name}</h1>
            {displayCase.description && (
              <p className="text-gray-500 max-w-2xl mx-auto">{displayCase.description}</p>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>Created: {displayCase.createdAt.toLocaleDateString()}</span>
            <span>Theme: {displayCase.theme || "Default"}</span>
            <LikeButton displayCaseId={displayCase.id} />
          </div>

          <div className="mt-4 flex justify-center space-x-2">
            {displayCase?.publicId && (
              <EnhancedShareButton 
                publicId={displayCase.publicId} 
                title={displayCase.name}
              />
            )}
            {displayCase?.userId && (
              <MessageSellerButton 
                sellerId={displayCase.userId} 
                displayCaseId={displayCase.id}
                sellerName="Owner"
              />
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <NewCommentSection displayCaseId={displayCase.id} />
        </div>
      </div>
    </HelmetProvider>
  );
} 