import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, query, where, getDocs, deleteDoc, doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { DisplayCase } from "@/types/display-case";
import { useAuth } from "@/context/AuthContext";
import { createDisplayCase as createDisplayCaseFn, likeDisplayCase as likeDisplayCaseFn, commentOnDisplayCase as commentOnDisplayCaseFn } from "@/lib/firebase/display-cases";
import { syncDisplayCaseTags, syncAllDisplayCases, syncPrivateToPublic } from "@/utils/displayCaseUtils";

export function useDisplayCases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get all display cases for the current user
  const { data: displayCases, isLoading, error, refetch } = useQuery({
    queryKey: ["displayCases", user?.uid],
    queryFn: async () => {
      if (!user?.uid) {
        return [];
      }
      
      const q = query(
        collection(db, "users", user.uid, "display_cases"),
        where("userId", "==", user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const displayCases = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as DisplayCase[];
      
      return displayCases;
    },
    enabled: !!user?.uid
  });

  // Create a new display case
  const { mutateAsync: createDisplayCase } = useMutation({
    mutationFn: async (data: Omit<DisplayCase, "id" | "userId" | "createdAt" | "updatedAt">) => {
      if (!user?.uid) {
        throw new Error("You must be logged in to create a display case");
      }
      
      const result = await createDisplayCaseFn(data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["displayCases", user?.uid] });
    }
  });

  // Update a display case
  const { mutateAsync: updateDisplayCase } = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<DisplayCase> }) => {
      if (!user?.uid) {
        throw new Error("You must be logged in to update a display case");
      }
      
      const docRef = doc(db, "users", user.uid, "display_cases", id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
      
      // If the display case is public, update the public version too
      if (data.isPublic) {
        await syncPrivateToPublic(user.uid, id);
      }
      
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["displayCases", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["displayCase", id] });
      queryClient.invalidateQueries({ queryKey: ["publicDisplayCase", id] });
    }
  });

  // Delete a display case
  const { mutateAsync: deleteDisplayCase } = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.uid) {
        throw new Error("You must be logged in to delete a display case");
      }
      
      const docRef = doc(db, "users", user.uid, "display_cases", id);
      await deleteDoc(docRef);
      
      // Also delete the public version if it exists
      try {
        const publicRef = doc(db, "public_display_cases", id);
        const publicDoc = await getDoc(publicRef);
        if (publicDoc.exists()) {
          await deleteDoc(publicRef);
        }
      } catch (err) {
        console.error("Error deleting public display case:", err);
      }
      
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["displayCases", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["publicDisplayCases"] });
    }
  });
  
  // Like a display case (for public display cases)
  const { mutateAsync: likeDisplayCase } = useMutation({
    mutationFn: async (displayCaseId: string) => {
      if (!user?.uid) {
        throw new Error("You must be logged in to like a display case");
      }
      
      await likeDisplayCaseFn(displayCaseId, user.uid);
      return displayCaseId;
    },
    onSuccess: (displayCaseId) => {
      queryClient.invalidateQueries({ queryKey: ["publicDisplayCase", displayCaseId] });
    }
  });
  
  // Comment on a display case (for public display cases)
  const { mutateAsync: commentOnDisplayCase } = useMutation({
    mutationFn: async ({ displayCaseId, comment }: { displayCaseId: string, comment: string }) => {
      if (!user?.uid) {
        throw new Error("You must be logged in to comment on a display case");
      }
      
      await commentOnDisplayCaseFn(
        user.uid, 
        displayCaseId, 
        { 
          user: user.displayName || "Anonymous", 
          text: comment, 
          createdAt: new Date() 
        }
      );
      return displayCaseId;
    },
    onSuccess: (displayCaseId) => {
      queryClient.invalidateQueries({ queryKey: ["publicDisplayCase", displayCaseId] });
    }
  });
  
  // Sync display cases with tags
  const { mutateAsync: syncDisplayCases, isPending: isSyncing } = useMutation({
    mutationFn: async () => {
      if (!user?.uid) {
        throw new Error("You must be logged in to sync display cases");
      }
      
      await syncAllDisplayCases(user.uid);
      
      // Get all display cases to ensure we sync public versions too
      const displayCasesRef = collection(db, "users", user.uid, "display_cases");
      const displayCasesSnapshot = await getDocs(displayCasesRef);
      
      // Manually sync each public display case to ensure complete synchronization
      for (const doc of displayCasesSnapshot.docs) {
        const displayCase = doc.data() as DisplayCase;
        if (displayCase.isPublic) {
          await syncPrivateToPublic(user.uid, doc.id);
        }
      }
      
      return true;
    },
    onSuccess: () => {
      // Invalidate all relevant queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["displayCases"] });
      queryClient.invalidateQueries({ queryKey: ["displayCases", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["publicDisplayCases"] });
      
      // Individual display cases will be refreshed when viewed
    }
  });

  return {
    displayCases,
    isLoading,
    error,
    createDisplayCase,
    updateDisplayCase,
    deleteDisplayCase,
    syncDisplayCases,
    isSyncing,
    likeDisplayCase,
    commentOnDisplayCase,
    refetch
  };
} 