import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

// Tries to delete from multiple paths until one works
export async function emergencyDeleteCard(cardId: string, userId: string): Promise<boolean> {
  console.log(`🔴 Attempting emergency delete for cardId: ${cardId}`);
  console.log(`👤 User ID: ${userId}`);
  
  // Log all paths we're going to try
  console.log(`🔍 Primary path: users/${userId}/collection/${cardId}`);
  console.log(`🔍 Secondary path: users/${userId}/cards/${cardId}`);
  console.log(`🔍 Fallback path: cards/${cardId}`);

  const possiblePaths = [
    doc(db, "users", userId, "collection", cardId),
    doc(db, "users", userId, "cards", cardId),
    doc(db, "cards", cardId)
  ];

  let deletedAtLeastOnce = false;

  for (const path of possiblePaths) {
    try {
      console.log(`⏳ Attempting to delete from: ${path.path}`);
      await deleteDoc(path);
      console.log(`✅ Successfully deleted from: ${path.path}`);
      deletedAtLeastOnce = true;
    } catch (err) {
      // We intentionally continue trying the remaining paths even if a deletion fails
      console.warn(`❌ Failed to delete from: ${path.path}`, err);
    }
  }

  if (deletedAtLeastOnce) {
    return true;
  }

  console.error("🛑 Card could not be deleted from any known path.");
  return false;
} 