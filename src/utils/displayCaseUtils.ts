import { db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "sonner";
import { DisplayCase } from "@/types/display-case";
import { Card } from "@/types/Card";

/**
 * Ensures a display case has a proper public version with the right cardIds
 * Call this when creating/updating a display case or when visiting a public display case that has issues
 */
export async function ensurePublicDisplayCase(displayCaseId: string, userId?: string) {
  console.log(`Starting ensurePublicDisplayCase for ID: ${displayCaseId}, userId: ${userId || 'none'}`);
  
  try {
    // First check if public version exists
    const publicRef = doc(db, "public_display_cases", displayCaseId);
    const publicDoc = await getDoc(publicRef);
    
    if (!publicDoc.exists()) {
      console.log("Public display case doesn't exist, finding private version");
      
      // Try to find the private version to use as a template
      let privateData = null;
      let privateOwner = null;
      
      // If we know the user ID, check their display cases directly
      if (userId) {
        try {
          const privateRef = doc(db, "users", userId, "display_cases", displayCaseId);
          const privateDoc = await getDoc(privateRef);
          
          if (privateDoc.exists()) {
            privateData = privateDoc.data();
            privateOwner = userId;
            console.log("Found private display case with provided user ID");
          }
        } catch (err) {
          console.log("Error fetching private display case:", err);
        }
      }
      
      // If we couldn't find it with the provided userId, try the legacy collection
      if (!privateData) {
        try {
          console.log("Checking legacy displayCases collection");
          const legacyRef = doc(db, "displayCases", displayCaseId);
          const legacyDoc = await getDoc(legacyRef);
          
          if (legacyDoc.exists()) {
            privateData = legacyDoc.data();
            privateOwner = privateData.userId || "system";
            console.log("Found display case in legacy collection");
          }
        } catch (err) {
          console.log("Error fetching from legacy collection:", err);
        }
      }
      
      // If we still couldn't find it, the display case doesn't exist or isn't shared correctly
      if (!privateData) {
        console.log("Could not find source display case to create public version");
        console.log("Returning false - no privateData found");
        return false;
      }
      
      // Fail fast if we don't have a user ID
      if (!privateOwner) {
        console.error("Cannot publish display case without user ID");
        console.log("Returning false - no privateOwner");
        return false;
      }
      
      // Only verify card existence if we have a known owner
      const verifiedCardIds = [];
      
      if (privateData.cardIds && Array.isArray(privateData.cardIds)) {
        console.log(`Verifying ${privateData.cardIds.length} cards...`);
        
        // If we have real card IDs, verify them
        if (privateData.cardIds.some(id => id && !id.startsWith('card'))) {
          for (const cardId of privateData.cardIds) {
            if (!cardId) continue;
            
            try {
              // Check in user collection first
              const userCardDoc = await getDoc(doc(db, "users", privateOwner, "collection", cardId));
              if (userCardDoc.exists()) {
                verifiedCardIds.push(cardId);
                continue;
              }
              
              // Then check main cards collection
              const cardDoc = await getDoc(doc(db, "cards", cardId));
              if (cardDoc.exists()) {
                verifiedCardIds.push(cardId);
                continue;
              }
              
              console.warn(`Card ${cardId} not found in user collection or main collection`);
            } catch (err) {
              console.warn(`Error verifying card ${cardId}:`, err);
            }
          }
        } else {
          // These are already fallback cards, no need to verify
          verifiedCardIds.push(...privateData.cardIds.filter(id => id));
        }
        
        console.log(`Verified ${verifiedCardIds.length} of ${privateData.cardIds.length} cards`);
      }
      
      // Create public version based on private data
      try {
        // Always include fallback cards if no real cards are verified
        const finalCardIds = verifiedCardIds.length > 0 
          ? verifiedCardIds 
          : (privateData.cardIds && privateData.cardIds.length > 0) 
            ? privateData.cardIds 
            : ["card1", "card2", "card3"];
            
        const publicData = {
          ...privateData,
          id: displayCaseId,
          publicId: displayCaseId,
          userId: privateOwner, // Ensure userId is always set
          isPublic: true,
          recovered: true, // Flag to indicate this was recovered
          cardIds: finalCardIds,
          createdAt: privateData.createdAt || new Date(),
          updatedAt: new Date()
        };
        
        await setDoc(publicRef, publicData);
        console.log("Created public display case from private data");
        toast.success("Display case is now available publicly");
        return true;
      } catch (error) {
        console.error("Failed to create public display case:", error);
        console.log("Returning false - error creating public display case");
        return false;
      }
    } else {
      // Public display case exists, ensure it has cardIds and userId
      const publicData = publicDoc.data();
      console.log("Public display case exists, checking data:", publicData);
      
      let needsUpdate = false;
      const updates: Record<string, any> = {
        recovered: true,
        updatedAt: new Date()
      };
      
      // If userId is missing, try to find it from the private version
      if (!publicData.userId) {
        console.warn("Public display case missing userId, attempting to fix");
        
        try {
          // Try legacy collection first
          const legacyRef = doc(db, "displayCases", displayCaseId);
          const legacyDoc = await getDoc(legacyRef);
          
          if (legacyDoc.exists() && legacyDoc.data().userId) {
            updates.userId = legacyDoc.data().userId;
            console.log("Found userId from legacy collection:", updates.userId);
            needsUpdate = true;
          } else if (userId) {
            // Use provided userId as fallback
            updates.userId = userId;
            console.log("Using provided userId:", updates.userId);
            needsUpdate = true;
          } else {
            console.error("Could not determine userId for public display case");
            // Continue with fallback cards
          }
        } catch (err) {
          console.error("Error updating userId:", err);
        }
      }
      
      // Check if cardIds are missing or empty
      if (!publicData.cardIds || publicData.cardIds.length === 0) {
        console.log("Public display case exists but has no card IDs");
        
        // Try to find the private version to get cardIds
        if (publicData.userId || updates.userId) {
          const ownerUserId = publicData.userId || updates.userId;
          
          try {
            const privateRef = doc(db, "users", ownerUserId, "display_cases", displayCaseId);
            const privateDoc = await getDoc(privateRef);
            
            if (privateDoc.exists() && privateDoc.data().cardIds?.length > 0) {
              // Use card IDs from private version, no need to verify for public view
              updates.cardIds = privateDoc.data().cardIds;
              console.log(`Found ${updates.cardIds.length} card IDs from private version`);
              needsUpdate = true;
            } else {
              console.log("Private version exists but has no card IDs");
            }
          } catch (err) {
            console.log("Error fetching private display case for cards:", err);
          }
          
          // If we still don't have cardIds, use fallback cards
          if (!updates.cardIds || updates.cardIds.length === 0) {
            console.log("Using fallback card IDs");
            updates.cardIds = ["card1", "card2", "card3"];
            needsUpdate = true;
          }
        } else {
          // Use fallback cards if no userId
          console.log("No userId available, using fallback cards");
          updates.cardIds = ["card1", "card2", "card3"];
          needsUpdate = true;
        }
      }
      
      // Apply updates if needed
      if (needsUpdate) {
        try {
          await updateDoc(publicRef, updates);
          console.log("Updated public display case with", Object.keys(updates).join(", "));
          return true;
        } catch (error) {
          console.error("Error updating public display case:", error);
          console.log("Returning false - error updating public display case");
          return false;
        }
      } else {
        console.log("Public display case is already properly configured");
        return true;
      }
    }
  } catch (error) {
    console.error("Error ensuring public display case:", error);
    console.log("Returning false due to caught exception");
    return false;
  }
}

/**
 * Creates a public version of a display case when the owner shares it
 * This should be called when a user explicitly shares their display case
 */
export async function publishDisplayCase(userId: string, displayCaseId: string) {
  if (!userId || !displayCaseId) {
    console.error("Cannot publish display case: missing userId or displayCaseId");
    return false;
  }
  
  try {
    // Get the private display case
    const privateRef = doc(db, "users", userId, "display_cases", displayCaseId);
    const privateDoc = await getDoc(privateRef);
    
    if (!privateDoc.exists()) {
      console.error(`Private display case ${displayCaseId} not found`);
      return false;
    }
    
    const privateData = privateDoc.data();
    
    // Create public version
    const publicRef = doc(db, "public_display_cases", displayCaseId);
    
    await setDoc(publicRef, {
      ...privateData,
      id: displayCaseId,
      publicId: displayCaseId,
      userId: userId,
      isPublic: true,
      createdAt: privateData.createdAt || new Date(),
      updatedAt: new Date()
    });
    
    // Update the private version's isPublic flag
    await updateDoc(privateRef, {
      isPublic: true,
      updatedAt: new Date()
    });
    
    console.log(`Successfully published display case ${displayCaseId}`);
    return true;
  } catch (error) {
    console.error("Error publishing display case:", error);
    return false;
  }
}

/**
 * Helper function to update the likes count in the display case document
 * This should be called by a Firebase function, not by client code directly
 */
export async function updateLikesCount(displayCaseId: string) {
  if (!displayCaseId) return false;
  
  try {
    // Count the likes in the likes collection
    const likesQuery = query(
      collection(db, 'likes'),
      where('displayCaseId', '==', displayCaseId)
    );
    
    const likesSnapshot = await getDocs(likesQuery);
    const likesCount = likesSnapshot.size;
    
    // Find the display case document
    const publicRef = doc(db, 'public_display_cases', displayCaseId);
    const publicDoc = await getDoc(publicRef);
    
    if (publicDoc.exists()) {
      // Update the likes count in the display case document
      await updateDoc(publicRef, {
        likes: likesCount,
        updatedAt: new Date()
      });
      console.log(`Updated likes count for display case ${displayCaseId} to ${likesCount}`);
      return true;
    } else {
      // Try legacy collection
      const legacyRef = doc(db, 'displayCases', displayCaseId);
      const legacyDoc = await getDoc(legacyRef);
      
      if (legacyDoc.exists()) {
        await updateDoc(legacyRef, {
          likes: likesCount,
          updatedAt: new Date()
        });
        console.log(`Updated likes count for legacy display case ${displayCaseId} to ${likesCount}`);
        return true;
      } else {
        console.log(`Display case ${displayCaseId} not found in any collection`);
        return false;
      }
    }
  } catch (error) {
    console.error(`Error updating likes count for display case ${displayCaseId}:`, error);
    return false;
  }
}

/**
 * Syncs updated card data to public display cases
 * Call this when a card is updated to ensure public display cases show the latest data
 */
export async function syncCardToPublicDisplayCases(cardId: string, userId: string): Promise<boolean> {
  if (!cardId || !userId) {
    console.error("syncCardToPublicDisplayCases: Missing cardId or userId");
    return false;
  }
  
  try {
    console.log(`syncCardToPublicDisplayCases: Syncing card ${cardId} for user ${userId}`);
    
    // First, get all display cases containing this card
    const userDisplayCasesRef = collection(db, "users", userId, "display_cases");
    const userDisplayCasesSnapshot = await getDocs(userDisplayCasesRef);
    
    let updatedCases = 0;
    
    // Check each display case
    for (const dcDoc of userDisplayCasesSnapshot.docs) {
      const displayCase = dcDoc.data();
      
      // Skip if display case is not public or has no cardIds
      if (!displayCase.isPublic || !displayCase.cardIds || !Array.isArray(displayCase.cardIds)) {
        continue;
      }
      
      // Check if this display case contains the card
      if (displayCase.cardIds.includes(cardId)) {
        // Check if there's a public version
        const publicRef = doc(db, "public_display_cases", dcDoc.id);
        const publicSnapshot = await getDoc(publicRef);
        
        if (publicSnapshot.exists()) {
          // Update the timestamp to force a refresh when users view the public display case
          await updateDoc(publicRef, {
            updatedAt: new Date()
          });
          
          updatedCases++;
          console.log(`syncCardToPublicDisplayCases: Updated public display case ${dcDoc.id}`);
        }
      }
    }
    
    // Also check legacy display cases
    try {
      const legacyQuery = query(
        collection(db, "displayCases"),
        where("userId", "==", userId),
        where("isPublic", "==", true)
      );
      const legacySnapshot = await getDocs(legacyQuery);
      
      for (const dcDoc of legacySnapshot.docs) {
        const displayCase = dcDoc.data();
        
        if (displayCase.cardIds && Array.isArray(displayCase.cardIds) && displayCase.cardIds.includes(cardId)) {
          const publicRef = doc(db, "public_display_cases", dcDoc.id);
          const publicSnapshot = await getDoc(publicRef);
          
          if (publicSnapshot.exists()) {
            await updateDoc(publicRef, {
              updatedAt: new Date()
            });
            
            updatedCases++;
            console.log(`syncCardToPublicDisplayCases: Updated legacy public display case ${dcDoc.id}`);
          }
        }
      }
    } catch (legacyError) {
      console.error("syncCardToPublicDisplayCases: Error checking legacy displayCases:", legacyError);
    }
    
    console.log(`syncCardToPublicDisplayCases: Updated ${updatedCases} public display cases`);
    return updatedCases > 0;
  } catch (error) {
    console.error("syncCardToPublicDisplayCases: Error syncing card:", error);
    return false;
  }
}

/**
 * Synchronizes the content from a private display case to its public version
 * This ensures that any changes to the private display case are reflected in the public version
 */
export async function syncPrivateToPublic(userId: string, displayCaseId: string): Promise<boolean> {
  try {
    console.log(`Synchronizing private display case ${displayCaseId} to public version`);
    
    // Get the private display case
    const privateRef = doc(db, "users", userId, "display_cases", displayCaseId);
    const privateDoc = await getDoc(privateRef);
    
    if (!privateDoc.exists()) {
      console.error(`Private display case ${displayCaseId} not found`);
      return false;
    }
    
    const privateData = privateDoc.data() as DisplayCase;
    
    // Skip if the display case is not public
    if (!privateData.isPublic) {
      console.log(`Display case ${displayCaseId} is not public, skipping sync`);
      return false;
    }
    
    // Log important data for debugging
    console.log(`Private display case data:`, {
      name: privateData.name,
      cardCount: privateData.cardIds?.length || 0,
      tags: privateData.tags,
      isPublic: privateData.isPublic
    });
    
    // Create a complete copy of the data for the public version
    const publicData = {
      // Base properties
      id: displayCaseId,
      publicId: displayCaseId,
      userId: userId,
      name: privateData.name || "", // Ensure name is never undefined
      description: privateData.description || "", // Ensure description is never undefined
      
      // Card data - explicitly copy to ensure it's included
      cardIds: [...(privateData.cardIds || [])],
      
      // Tags and visibility
      tags: [...(privateData.tags || [])],
      isPublic: true,
      
      // Stats
      likes: privateData.likes || 0,
      visits: privateData.visits || 0,
      comments: privateData.comments || [],
      
      // Timestamps
      createdAt: privateData.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    // Clean up any potentially undefined values
    // Convert all undefined values to null, which Firebase accepts
    const cleanedPublicData = Object.entries(publicData).reduce((cleaned, [key, value]) => {
      cleaned[key] = value === undefined ? null : value;
      return cleaned;
    }, {} as Record<string, any>);
    
    // Check if public version exists
    const publicRef = doc(db, "public_display_cases", displayCaseId);
    const publicDoc = await getDoc(publicRef);
    
    if (publicDoc.exists()) {
      // Update existing public display case with complete data replacement
      await setDoc(publicRef, cleanedPublicData, { merge: true });
      console.log(`Updated existing public display case ${displayCaseId} with ${publicData.cardIds.length} cards`);
    } else {
      // Create new public display case
      await setDoc(publicRef, cleanedPublicData);
      console.log(`Created new public display case ${displayCaseId} with ${publicData.cardIds.length} cards`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error synchronizing display case ${displayCaseId} to public:`, error);
    return false;
  }
}

/**
 * Synchronizes a display case with cards based on tags.
 * This ensures the display case includes all cards that match its tags,
 * and removes cards that no longer match.
 */
export async function syncDisplayCaseTags(userId: string, displayCaseId: string): Promise<void> {
  try {
    console.log(`Synchronizing display case ${displayCaseId} for user ${userId}`);
    
    // Get the display case
    const displayCaseRef = doc(db, "users", userId, "display_cases", displayCaseId);
    const displayCaseDoc = await getDoc(displayCaseRef);
    
    if (!displayCaseDoc.exists()) {
      console.error(`Display case ${displayCaseId} not found`);
      return;
    }
    
    const displayCase = displayCaseDoc.data() as DisplayCase;
    const displayCaseTags = displayCase.tags || [];
    const currentCardIds = displayCase.cardIds || [];
    
    console.log(`Display case ${displayCase.name} (${displayCaseId}):
      - Current card count: ${currentCardIds.length}
      - Tags: [${displayCaseTags.join(', ')}]`);
    
    if (displayCaseTags.length === 0) {
      console.log(`Display case ${displayCaseId} has no tags, skipping sync`);
      return;
    }
    
    // Find all cards for the user from both collection paths
    const cards: Card[] = [];
    
    // Check in users/{uid}/cards first
    try {
      const cardsRef = collection(db, "users", userId, "cards");
      const cardsSnapshot = await getDocs(cardsRef);
      
      if (!cardsSnapshot.empty) {
        console.log(`Found ${cardsSnapshot.size} cards in users/${userId}/cards`);
        cardsSnapshot.forEach(cardDoc => {
          const cardData = cardDoc.data() as Card;
          cardData.id = cardDoc.id;
          cards.push(cardData);
        });
      }
    } catch (error) {
      console.error(`Error fetching cards from users/${userId}/cards:`, error);
    }
    
    // Also check in users/{uid}/collection
    try {
      const collectionRef = collection(db, "users", userId, "collection");
      const collectionSnapshot = await getDocs(collectionRef);
      
      if (!collectionSnapshot.empty) {
        console.log(`Found ${collectionSnapshot.size} cards in users/${userId}/collection`);
        collectionSnapshot.forEach(cardDoc => {
          const cardData = cardDoc.data() as Card;
          cardData.id = cardDoc.id;
          cards.push(cardData);
        });
      }
    } catch (error) {
      console.error(`Error fetching cards from users/${userId}/collection:`, error);
    }
    
    console.log(`Total cards found for user: ${cards.length}`);
    
    // Find cards that match the display case tags
    console.log(`Checking ${cards.length} cards against display case tags: [${displayCaseTags.join(', ')}]`);
    
    // Debug card tags - show samples of card tags for debugging
    console.log(`--- SAMPLE CARD TAGS (showing up to 5 cards) ---`);
    cards.slice(0, 5).forEach(card => {
      console.log(`Card ${card.id}: Tags = [${card.tags?.join(', ') || 'none'}]`);
    });
    console.log(`--- END SAMPLE CARD TAGS ---`);
    
    // More permissive matching - a card matches if ANY of its tags match ANY of the display case tags
    const matchingCards = cards.filter(card => {
      if (!card.tags || card.tags.length === 0) {
        return false;
      }
      
      // Normalize tags for comparison (lowercase, trim)
      const normalizedCardTags = card.tags.map(tag => tag.toLowerCase().trim());
      const normalizedDisplayCaseTags = displayCaseTags.map(tag => tag.toLowerCase().trim());
      
      // A card matches if any of its tags matches or contains any of the display case tags
      // or if any display case tag matches or contains any of the card tags
      const hasMatchingTag = normalizedCardTags.some(cardTag => 
        normalizedDisplayCaseTags.some(displayCaseTag => 
          cardTag.includes(displayCaseTag) || displayCaseTag.includes(cardTag)
        )
      );
      
      // Log each card's matching status for debugging
      console.log(`Card ${card.id} (${card.playerName || 'Unknown'}) - Tags: [${card.tags.join(', ')}] - Matches: ${hasMatchingTag}`);
      
      return hasMatchingTag;
    });
    
    console.log(`Found ${matchingCards.length} cards matching display case tags`);
    
    // Get the card IDs of matching cards
    const matchingCardIds = matchingCards.map(card => card.id);
    
    // Find which cards to add and which to remove
    const cardsToAdd = matchingCardIds.filter(id => !currentCardIds.includes(id));
    const cardsToRemove = currentCardIds.filter(id => !matchingCardIds.includes(id));
    
    console.log(`Cards to add: ${cardsToAdd.length}, Cards to remove: ${cardsToRemove.length}`);
    
    if (cardsToAdd.length === 0 && cardsToRemove.length === 0) {
      console.log(`No changes needed for display case ${displayCaseId}`);
      
      // Even if no changes, still sync private to public to ensure consistency
      if (displayCase.isPublic) {
        await syncPrivateToPublic(userId, displayCaseId);
      }
      
      return;
    }
    
    // Update the display case with the new card IDs
    const updatedCardIds = [
      ...currentCardIds.filter(id => !cardsToRemove.includes(id)),
      ...cardsToAdd
    ];
    
    console.log(`Updating display case ${displayCaseId} with ${updatedCardIds.length} cards`);
    
    // Log specific details about the cards being added
    if (cardsToAdd.length > 0) {
      console.log(`--- CARDS BEING ADDED ---`);
      cardsToAdd.forEach(cardId => {
        const card = cards.find(c => c.id === cardId);
        if (card) {
          console.log(`Adding card ${cardId}: Tags = [${card.tags?.join(', ') || 'none'}]`);
        }
      });
      console.log(`--- END CARDS BEING ADDED ---`);
    }
    
    // Update the display case with the new card IDs
    await updateDoc(displayCaseRef, {
      cardIds: updatedCardIds,
      updatedAt: new Date()
    });
    
    console.log(`Successfully updated display case ${displayCaseId}`);
    
    // If the display case is public, update the public version
    if (displayCase.isPublic) {
      console.log(`Syncing changes to public display case...`);
      const syncResult = await syncPrivateToPublic(userId, displayCaseId);
      console.log(`Public sync result: ${syncResult ? "Success" : "Failed"}`);
    }
  } catch (error) {
    console.error(`Error synchronizing display case ${displayCaseId}:`, error);
    throw error;
  }
}

/**
 * Synchronizes all display cases for a user.
 * This ensures all display cases include the correct cards based on their tags.
 */
export async function syncAllDisplayCases(userId: string): Promise<void> {
  try {
    console.log(`Synchronizing all display cases for user ${userId}`);
    
    // Get all display cases for the user
    const displayCasesRef = collection(db, "users", userId, "display_cases");
    const displayCasesSnapshot = await getDocs(displayCasesRef);
    
    if (displayCasesSnapshot.empty) {
      console.log("No display cases found");
      return;
    }
    
    console.log(`Found ${displayCasesSnapshot.size} display cases`);
    
    // Synchronize each display case
    for (const displayCaseDoc of displayCasesSnapshot.docs) {
      // Sync the private display case
      await syncDisplayCaseTags(userId, displayCaseDoc.id);
      
      // Ensure public display case is also in sync
      const displayCase = displayCaseDoc.data() as DisplayCase;
      if (displayCase.isPublic) {
        await syncPrivateToPublic(userId, displayCaseDoc.id);
      }
    }
    
    console.log("Completed synchronizing all display cases");
  } catch (error) {
    console.error("Error synchronizing all display cases:", error);
    throw error;
  }
}

/**
 * Synchronizes all display cases that include a specific tag.
 * This is useful when a card's tags have changed.
 */
export async function syncDisplayCasesByTag(userId: string, tag: string): Promise<void> {
  try {
    console.log(`Synchronizing display cases with tag "${tag}" for user ${userId}`);
    
    // Get all display cases for the user
    const displayCasesRef = collection(db, "users", userId, "display_cases");
    const displayCasesSnapshot = await getDocs(displayCasesRef);
    
    if (displayCasesSnapshot.empty) {
      console.log("No display cases found");
      return;
    }
    
    console.log(`Found ${displayCasesSnapshot.size} display cases, filtering by tag`);
    
    // Filter display cases that have the specified tag
    const displayCasesWithTag = displayCasesSnapshot.docs.filter(doc => {
      const displayCase = doc.data() as DisplayCase;
      return displayCase.tags && displayCase.tags.includes(tag);
    });
    
    console.log(`Found ${displayCasesWithTag.length} display cases with tag "${tag}"`);
    
    // Synchronize each display case
    for (const displayCaseDoc of displayCasesWithTag) {
      await syncDisplayCaseTags(userId, displayCaseDoc.id);
    }
    
    console.log(`Completed synchronizing display cases with tag "${tag}"`);
  } catch (error) {
    console.error(`Error synchronizing display cases with tag "${tag}":`, error);
    throw error;
  }
}

/**
 * Synchronizes all display cases that might include a specific card based on its tags.
 * Call this when a card's tags are changed to ensure it's added to or removed from relevant display cases.
 */
export async function syncDisplayCasesForCard(userId: string, cardId: string): Promise<void> {
  try {
    console.log(`Syncing display cases for card ${cardId}`);
    
    // First, get the card to check its tags
    let card: Card | null = null;
    
    // Try to find the card in all possible locations
    try {
      // First try user's collection
      const cardRef = doc(db, "users", userId, "collection", cardId);
      const cardDoc = await getDoc(cardRef);
      
      if (cardDoc.exists()) {
        card = { ...cardDoc.data(), id: cardId } as Card;
        console.log(`Found card in collection path`);
      } else {
        // Try cards path
        const altCardRef = doc(db, "users", userId, "cards", cardId);
        const altCardDoc = await getDoc(altCardRef);
        
        if (altCardDoc.exists()) {
          card = { ...altCardDoc.data(), id: cardId } as Card;
          console.log(`Found card in cards path`);
        }
      }
    } catch (error) {
      console.error(`Error finding card ${cardId}:`, error);
      return;
    }
    
    if (!card) {
      console.error(`Card ${cardId} not found, cannot sync display cases`);
      return;
    }
    
    console.log(`Card ${cardId} has tags: [${card.tags?.join(', ') || 'none'}]`);
    
    if (!card.tags || card.tags.length === 0) {
      console.log(`Card has no tags, no display cases to sync`);
      return;
    }
    
    // Normalize the card tags
    const normalizedCardTags = card.tags.map(tag => tag.toLowerCase().trim());
    
    // Get all display cases for the user
    const displayCasesRef = collection(db, "users", userId, "display_cases");
    const displayCasesSnapshot = await getDocs(displayCasesRef);
    
    if (displayCasesSnapshot.empty) {
      console.log(`No display cases found for user ${userId}`);
      return;
    }
    
    console.log(`Found ${displayCasesSnapshot.size} display cases to check`);
    
    // Check each display case to see if the card should be included based on tags
    for (const displayCaseDoc of displayCasesSnapshot.docs) {
      const displayCase = displayCaseDoc.data() as DisplayCase;
      const displayCaseTags = displayCase.tags || [];
      const displayCaseId = displayCaseDoc.id;
      
      // Skip display cases without tags
      if (displayCaseTags.length === 0) {
        console.log(`Display case ${displayCaseId} has no tags, skipping`);
        continue;
      }
      
      // Normalize display case tags
      const normalizedDisplayCaseTags = displayCaseTags.map(tag => tag.toLowerCase().trim());
      
      // Check if any of the card tags match any of the display case tags
      const hasMatchingTag = normalizedCardTags.some(cardTag => 
        normalizedDisplayCaseTags.some(displayCaseTag => 
          cardTag.includes(displayCaseTag) || displayCaseTag.includes(cardTag)
        )
      );
      
      console.log(`Card ${cardId} ${hasMatchingTag ? 'matches' : 'does not match'} display case ${displayCaseId} (${displayCase.name}) with tags [${displayCaseTags.join(', ')}]`);
      
      // Get current card IDs in the display case
      const currentCardIds = displayCase.cardIds || [];
      
      // Check if the card is already in the display case
      const isCardInDisplayCase = currentCardIds.includes(cardId);
      
      if (hasMatchingTag && !isCardInDisplayCase) {
        // Card should be added to the display case
        console.log(`Adding card ${cardId} to display case ${displayCaseId}`);
        
        // Update the display case with the new card
        const updatedCardIds = [...currentCardIds, cardId];
        await updateDoc(doc(db, "users", userId, "display_cases", displayCaseId), {
          cardIds: updatedCardIds,
          updatedAt: new Date()
        });
        
        // If display case is public, sync to public version
        if (displayCase.isPublic) {
          await syncPrivateToPublic(userId, displayCaseId);
        }
      } else if (!hasMatchingTag && isCardInDisplayCase) {
        // Card should be removed from the display case
        console.log(`Removing card ${cardId} from display case ${displayCaseId}`);
        
        // Update the display case to remove the card
        const updatedCardIds = currentCardIds.filter(id => id !== cardId);
        await updateDoc(doc(db, "users", userId, "display_cases", displayCaseId), {
          cardIds: updatedCardIds,
          updatedAt: new Date()
        });
        
        // If display case is public, sync to public version
        if (displayCase.isPublic) {
          await syncPrivateToPublic(userId, displayCaseId);
        }
      } else {
        console.log(`No changes needed for card ${cardId} in display case ${displayCaseId}`);
      }
    }
    
    console.log(`Finished syncing display cases for card ${cardId}`);
  } catch (error) {
    console.error(`Error syncing display cases for card ${cardId}:`, error);
    throw error;
  }
} 