import { db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "sonner";

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