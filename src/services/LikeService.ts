import { db } from "@/lib/firebase/config";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc,
  serverTimestamp,
  DocumentData,
  QuerySnapshot,
  onSnapshot,
  doc,
  getDoc,
  updateDoc
} from "firebase/firestore";

/**
 * Service for managing likes on display cases
 */
export class LikeService {
  /**
   * Add a like to a display case
   */
  static async addLike(displayCaseId: string, userId: string): Promise<void> {
    if (!displayCaseId || !userId) {
      throw new Error("Display case ID and user ID are required");
    }

    try {
      const likesCollection = collection(db, 'likes');
      await addDoc(likesCollection, {
        displayCaseId,
        userId,
        timestamp: serverTimestamp()
      });
      console.log("Like added successfully");
      
      // Update the like count in the display case document
      await LikeService.updateLikesCount(displayCaseId);
    } catch (error) {
      console.error("Error adding like:", error);
      throw error;
    }
  }

  /**
   * Remove a like from a display case
   */
  static async removeLike(displayCaseId: string, userId: string): Promise<void> {
    if (!displayCaseId || !userId) {
      throw new Error("Display case ID and user ID are required");
    }

    try {
      const likesCollection = collection(db, 'likes');
      const likesQuery = query(
        likesCollection, 
        where('displayCaseId', '==', displayCaseId),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(likesQuery);
      
      if (!snapshot.empty) {
        const likeDoc = snapshot.docs[0];
        await deleteDoc(likeDoc.ref);
        console.log("Like removed successfully");
        
        // Update the like count in the display case document
        await LikeService.updateLikesCount(displayCaseId);
      } else {
        console.warn("No like found to remove");
      }
    } catch (error) {
      console.error("Error removing like:", error);
      throw error;
    }
  }

  /**
   * Check if a user has liked a display case
   */
  static async hasUserLiked(displayCaseId: string, userId: string): Promise<boolean> {
    if (!displayCaseId || !userId) {
      return false;
    }

    try {
      const likesCollection = collection(db, 'likes');
      const likesQuery = query(
        likesCollection, 
        where('displayCaseId', '==', displayCaseId),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(likesQuery);
      return !snapshot.empty;
    } catch (error) {
      console.error("Error checking if user liked:", error);
      return false;
    }
  }

  /**
   * Count likes for a display case
   */
  static async getLikeCount(displayCaseId: string): Promise<number> {
    if (!displayCaseId) {
      return 0;
    }

    try {
      const likesCollection = collection(db, 'likes');
      const likesQuery = query(
        likesCollection, 
        where('displayCaseId', '==', displayCaseId)
      );
      
      const snapshot = await getDocs(likesQuery);
      return snapshot.size;
    } catch (error) {
      console.error("Error getting like count:", error);
      return 0;
    }
  }

  /**
   * Update the likes count in the display case document
   */
  static async updateLikesCount(displayCaseId: string): Promise<boolean> {
    if (!displayCaseId) return false;
    
    try {
      // Count the likes in the likes collection
      const likesCount = await LikeService.getLikeCount(displayCaseId);
      
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
   * Set up a listener for likes on a display case
   * Returns an unsubscribe function
   */
  static onLikesChange(
    displayCaseId: string, 
    callback: (snapshot: QuerySnapshot<DocumentData>) => void,
    onError?: (error: Error) => void
  ): () => void {
    if (!displayCaseId) {
      console.error("Display case ID is required");
      return () => {};
    }

    try {
      const likesCollection = collection(db, 'likes');
      const likesQuery = query(
        likesCollection, 
        where('displayCaseId', '==', displayCaseId)
      );
      
      return onSnapshot(
        likesQuery,
        callback,
        (error) => {
          console.error("Error in likes listener:", error);
          if (onError) onError(error);
        }
      );
    } catch (error) {
      console.error("Error setting up likes listener:", error);
      return () => {};
    }
  }
} 