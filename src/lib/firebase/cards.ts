import { collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "./config";
import { Card } from "@/types/Card";

// New function to sync cards with display cases based on tags
export async function syncCardWithDisplayCases(
  card: Card,
  userId: string
): Promise<{ syncedCount: number; displayCases: string[] }> {
  try {
    console.log("syncCardWithDisplayCases: Syncing card with display cases for user:", userId);
    
    // Get all display cases for the user
    const displayCaseRef = collection(db, "users", userId, "display_cases");
    const displayCaseSnap = await getDocs(displayCaseRef);
    
    const updatedDisplayCases: string[] = [];
    let syncCount = 0;
    
    // Check each display case
    for (const dcDoc of displayCaseSnap.docs) {
      const displayCase = dcDoc.data();
      const displayCaseId = dcDoc.id;
      
      // Skip if display case has no tags
      if (!displayCase.tags || !Array.isArray(displayCase.tags) || displayCase.tags.length === 0) {
        console.log(`syncCardWithDisplayCases: Display case ${displayCaseId} has no tags, skipping`);
        continue;
      }
      
      // Get current cardIds array or initialize it
      const cardIds = Array.isArray(displayCase.cardIds) ? [...displayCase.cardIds] : [];
      
      // Check if the card is already in the display case
      const cardInDisplayCase = cardIds.includes(card.id);
      
      // Check if any of the card's tags match the display case tags
      const hasMatchingTag = card.tags && card.tags.length > 0 && 
                            card.tags.some((tag: string) => displayCase.tags.includes(tag));
      
      // Determine if we need to make changes
      let needsUpdate = false;
      
      if (hasMatchingTag && !cardInDisplayCase) {
        // Card has matching tags but is not in the display case - add it
        console.log(`syncCardWithDisplayCases: Adding card ${card.id} to display case ${displayCaseId}`);
        cardIds.push(card.id);
        needsUpdate = true;
        syncCount++;
        updatedDisplayCases.push(displayCaseId);
      } else if (!hasMatchingTag && cardInDisplayCase) {
        // Card is in the display case but no longer has matching tags - remove it
        console.log(`syncCardWithDisplayCases: Removing card ${card.id} from display case ${displayCaseId}`);
        const updatedCardIds = cardIds.filter(id => id !== card.id);
        if (updatedCardIds.length !== cardIds.length) {
          cardIds.length = 0; // Clear the array
          cardIds.push(...updatedCardIds); // Add the filtered items
          needsUpdate = true;
          syncCount++;
          updatedDisplayCases.push(displayCaseId);
        }
      } else {
        console.log(`syncCardWithDisplayCases: No changes needed for display case ${displayCaseId}`);
      }
      
      // If we need to update the display case, do so
      if (needsUpdate) {
        // Update the display case
        const dcRef = doc(db, "users", userId, "display_cases", displayCaseId);
        await updateDoc(dcRef, {
          cardIds,
          updatedAt: new Date()
        });
        
        console.log(`syncCardWithDisplayCases: Updated display case ${displayCaseId}`);
        
        // Also update the public version if it exists
        try {
          if (displayCase.isPublic) {
            const publicRef = doc(db, "public_display_cases", displayCaseId);
            const publicSnap = await getDoc(publicRef);
            
            if (publicSnap.exists()) {
              await updateDoc(publicRef, {
                cardIds,
                updatedAt: new Date()
              });
              console.log(`syncCardWithDisplayCases: Updated public display case ${displayCaseId}`);
            }
          }
        } catch (error) {
          console.error(`syncCardWithDisplayCases: Error updating public display case ${displayCaseId}:`, error);
          // Continue with other display cases even if one fails
        }
      }
    }
    
    return { syncedCount: syncCount, displayCases: updatedDisplayCases };
  } catch (error) {
    console.error("syncCardWithDisplayCases: Error syncing card with display cases:", error);
    return { syncedCount: 0, displayCases: [] };
  }
}

export async function addCard(cardData: Partial<Card>): Promise<string> {
  try {
    if (!cardData.ownerId) {
      throw new Error("Owner ID is required");
    }
    
    console.log("addCard: Adding card for user", cardData.ownerId, cardData);
    
    // Ensure we're consistent with the path we use
    const cardsRef = collection(db, "users", cardData.ownerId, "collection");
    
    // Ensure tags is an array
    if (!cardData.tags || !Array.isArray(cardData.tags)) {
      cardData.tags = [];
    }
    
    const docRef = await addDoc(cardsRef, {
      ...cardData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    console.log("addCard: Card added successfully with ID", docRef.id);
    
    // Also add to global cards collection for easier querying
    try {
      const globalCardRef = doc(db, "cards", docRef.id);
      await setDoc(globalCardRef, {
        ...cardData,
        id: docRef.id,
        ownerId: cardData.ownerId, // Ensure ownerId is explicitly set
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log("addCard: Card added to global collection with ID", docRef.id);
    } catch (globalError) {
      console.error("addCard: Error adding card to global collection:", globalError);
      // Don't fail if global addition fails
    }
    
    // Now sync this card with display cases based on tags
    try {
      // Need to add the ID to the card object for syncing
      const cardWithId: Card = {
        ...(cardData as Card),
        id: docRef.id
      };
      
      const { syncedCount, displayCases } = await syncCardWithDisplayCases(
        cardWithId,
        cardData.ownerId
      );
      
      if (syncedCount > 0) {
        console.log(`addCard: Card automatically added to ${syncedCount} display cases:`, displayCases);
      }
    } catch (syncError) {
      console.error("addCard: Error syncing card with display cases:", syncError);
      // Don't fail the card addition if sync fails
    }
    
    return docRef.id;
  } catch (error) {
    console.error("addCard: Error adding card:", error);
    throw error;
  }
}

export async function getCards(userId: string): Promise<Card[]> {
  try {
    console.log("getCards: Fetching cards for user", userId);
    
    // Try both potential paths where cards might be stored
    const cardPaths = [
      collection(db, "users", userId, "cards"),
      collection(db, "users", userId, "collection")
    ];
    
    let cards: Card[] = [];
    
    // Try first path - cards collection
    console.log("getCards: Trying path users/{uid}/cards");
    try {
      const cardsSnapshot = await getDocs(cardPaths[0]);
      console.log(`getCards: Found ${cardsSnapshot.docs.length} cards in users/${userId}/cards`);
      
      const cardsFromFirstPath = cardsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`getCards: Processing card ${doc.id} from cards path:`, data);
        
        // Ensure tags are properly initialized as an array
        if (!data.tags || !Array.isArray(data.tags)) {
          console.log("getCards: Fixing missing or invalid tags for card", doc.id);
          data.tags = [];
        }
        
        return {
          ...data,
          id: doc.id,
          tags: data.tags || [],
        } as Card;
      });
      
      cards = [...cards, ...cardsFromFirstPath];
    } catch (error) {
      console.error("getCards: Error fetching from users/{uid}/cards path:", error);
    }
    
    // Always try second path too, and merge cards from both paths
    console.log("getCards: Also trying path users/{uid}/collection");
    try {
      const collectionSnapshot = await getDocs(cardPaths[1]);
      console.log(`getCards: Found ${collectionSnapshot.docs.length} cards in users/${userId}/collection`);
      
      const cardsFromSecondPath = collectionSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`getCards: Processing card ${doc.id} from collection path:`, data);
        
        // Ensure tags are properly initialized as an array
        if (!data.tags || !Array.isArray(data.tags)) {
          console.log("getCards: Fixing missing or invalid tags for card", doc.id);
          data.tags = [];
        }
        
        return {
          ...data,
          id: doc.id,
          tags: data.tags || [],
        } as Card;
      });
      
      // Merge all cards, avoiding duplicates by id
      cardsFromSecondPath.forEach(card => {
        if (!cards.some(existingCard => existingCard.id === card.id)) {
          cards.push(card);
        }
      });
    } catch (error) {
      console.error("getCards: Error fetching from users/{uid}/collection path:", error);
    }
    
    // Validate data before returning
    const validCards = cards.filter(card => {
      if (!card.playerName) {
        console.warn(`getCards: Card ${card.id} missing playerName, skipping`);
        return false;
      }
      return true;
    });
    
    console.log(`getCards: Found ${validCards.length} valid cards total from both paths`);
    
    // Debug card values
    validCards.forEach(card => {
      if (card.currentValue || card.price || card.pricePaid) {
        console.log(`getCards: Card ${card.id} has values:`, {
          playerName: card.playerName,
          currentValue: card.currentValue,
          price: card.price,
          pricePaid: card.pricePaid
        });
      }
    });
    
    return validCards;
  } catch (error) {
    console.error("getCards: Error fetching cards:", error);
    throw error;
  }
}

export async function deleteCard(cardId: string, userId: string): Promise<void> {
  try {
    console.log("deleteCard: Deleting card", cardId, "for user", userId);
    
    let cardData: any = null;
    let wasDeleted = false;
    
    // First, try to get the card data (we need it for removing from display cases)
    try {
      // Check the collection path first (our primary location)
      const collectionDocRef = doc(db, "users", userId, "collection", cardId);
      const collectionSnapshot = await getDoc(collectionDocRef);
      
      if (collectionSnapshot.exists()) {
        cardData = collectionSnapshot.data();
        console.log("deleteCard: Found card in collection path:", cardData.playerName);
        
        // Delete from collection path
        await deleteDoc(collectionDocRef);
        console.log("deleteCard: Deleted card from collection path");
        wasDeleted = true;
      }
    } catch (error) {
      console.error("deleteCard: Error with collection path:", error);
    }
    
    // Try the cards path if not found or not deleted from collection
    if (!wasDeleted) {
      try {
        const cardsDocRef = doc(db, "users", userId, "cards", cardId);
        const cardsSnapshot = await getDoc(cardsDocRef);
        
        if (cardsSnapshot.exists()) {
          if (!cardData) {
            cardData = cardsSnapshot.data();
            console.log("deleteCard: Found card in cards path:", cardData.playerName);
          }
          
          // Delete from cards path
          await deleteDoc(cardsDocRef);
          console.log("deleteCard: Deleted card from cards path");
          wasDeleted = true;
        }
      } catch (error) {
        console.error("deleteCard: Error with cards path:", error);
      }
    }
    
    if (!wasDeleted) {
      throw new Error(`Card not found or could not be deleted: ${cardId}`);
    }
    
    // Now remove this card from all display cases it might be in
    try {
      console.log("deleteCard: Checking display cases for card references");
      
      // First check display_cases collection (newer path)
      const displayCaseRef = collection(db, "users", userId, "display_cases");
      const displayCasesSnapshot = await getDocs(displayCaseRef);
      
      let displayCasesUpdated = 0;
      
      // Check each display case
      for (const dcDoc of displayCasesSnapshot.docs) {
        const displayCase = dcDoc.data();
        
        // Skip if display case has no cardIds
        if (!displayCase.cardIds || !Array.isArray(displayCase.cardIds)) {
          continue;
        }
        
        // Check if this display case contains the deleted card
        if (displayCase.cardIds.includes(cardId)) {
          console.log(`deleteCard: Removing card from display case: ${dcDoc.id}`);
          
          // Remove the card ID
          const updatedCardIds = displayCase.cardIds.filter(id => id !== cardId);
          
          // Update the display case
          const dcRef = doc(db, "users", userId, "display_cases", dcDoc.id);
          await updateDoc(dcRef, {
            cardIds: updatedCardIds,
            updatedAt: new Date()
          });
          
          displayCasesUpdated++;
          
          // Also update public version if it exists and is public
          if (displayCase.isPublic) {
            try {
              // Try updating in public_display_cases collection
              const publicRef = doc(db, "public_display_cases", dcDoc.id);
              const publicSnap = await getDoc(publicRef);
              
              if (publicSnap.exists()) {
                await updateDoc(publicRef, {
                  cardIds: updatedCardIds,
                  updatedAt: new Date()
                });
                console.log(`deleteCard: Updated public display case ${dcDoc.id}`);
              }
            } catch (error) {
              console.error(`deleteCard: Error updating public display case ${dcDoc.id}:`, error);
            }
          }
        }
      }
      
      // Also check the legacy displayCases collection
      try {
        const legacyQuery = query(
          collection(db, "displayCases"),
          where("userId", "==", userId)
        );
        const legacySnapshot = await getDocs(legacyQuery);
        
        // Process legacy display cases
        for (const dcDoc of legacySnapshot.docs) {
          const displayCase = dcDoc.data();
          
          if (!displayCase.cardIds || !Array.isArray(displayCase.cardIds)) {
            continue;
          }
          
          if (displayCase.cardIds.includes(cardId)) {
            console.log(`deleteCard: Removing card from legacy display case: ${dcDoc.id}`);
            
            const updatedCardIds = displayCase.cardIds.filter(id => id !== cardId);
            
            await updateDoc(doc(db, "displayCases", dcDoc.id), {
              cardIds: updatedCardIds,
              updatedAt: new Date()
            });
            
            displayCasesUpdated++;
            
            // Also check for public reference
            try {
              const publicRef = doc(db, "public_display_cases", dcDoc.id);
              const publicSnap = await getDoc(publicRef);
              
              if (publicSnap.exists()) {
                await updateDoc(publicRef, {
                  cardIds: updatedCardIds,
                  updatedAt: new Date()
                });
                console.log(`deleteCard: Updated public display case from legacy reference ${dcDoc.id}`);
              }
            } catch (err) {
              console.error(`deleteCard: Error updating public display case from legacy:`, err);
            }
          }
        }
      } catch (legacyError) {
        console.error("deleteCard: Error checking legacy displayCases:", legacyError);
      }
      
      if (displayCasesUpdated > 0) {
        console.log(`deleteCard: Removed card from ${displayCasesUpdated} display cases`);
      } else {
        console.log("deleteCard: Card was not in any display cases");
      }
      
    } catch (error) {
      console.error("deleteCard: Error removing card from display cases:", error);
      // Don't fail the delete operation if display case cleanup fails
    }
    
    console.log("deleteCard: Card delete operation completed successfully");
  } catch (error) {
    console.error("deleteCard: Error deleting card:", error);
    throw error;
  }
}

export interface SavedSearch {
  id: string;
  playerName: string;
  year?: string;
  cardSet?: string;
  variation?: string;
  cardNumber?: string;
  condition: string;
  price: number | null;
  savedAt: string;
}

export async function getUserSavedSearches(uid: string): Promise<SavedSearch[]> {
  const q = query(collection(db, `users/${uid}/saved_searches`));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as SavedSearch[];
}

export async function deleteSavedSearch(uid: string, searchId: string): Promise<void> {
  const docRef = doc(db, `users/${uid}/saved_searches`, searchId);
  await deleteDoc(docRef);
}

export async function searchCards(searchQuery: string): Promise<Card[]> {
  const cardsRef = collection(db, 'cards');
  const q = query(
    cardsRef,
    where('playerName', '>=', searchQuery),
    where('playerName', '<=', searchQuery + '\uf8ff')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Card[];
} 