import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { 
  doc,
  getDoc,
  DocumentData,
  QuerySnapshot
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { LikeService } from "@/services/LikeService";
import { v4 as uuidv4 } from "uuid";
import { useDisplayCases } from '@/hooks/display/useDisplayCases';

interface LikeButtonProps {
  displayCaseId: string;
}

// Use named export for component
export function LikeButton({ displayCaseId }: LikeButtonProps) {
  const { user } = useAuth();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { displayCases = [], isLoading: isLoadingCases } = useDisplayCases();

  // Most Active Display Case
  const mostActiveDisplayCase = displayCases.length > 0
    ? displayCases.reduce((max, dc) => {
        const activity = (dc.likes || 0) + (dc.comments?.length || 0) + (dc.visits || 0);
        const maxActivity = (max.likes || 0) + (max.comments?.length || 0) + (max.visits || 0);
        return activity > maxActivity ? dc : max;
      }, displayCases[0])
    : null;

  // Get or create anonymous ID for non-authenticated users
  const getAnonymousId = () => {
    let anonymousId = localStorage.getItem('anonymousUserId');
    if (!anonymousId) {
      anonymousId = uuidv4();
      localStorage.setItem('anonymousUserId', anonymousId);
    }
    return anonymousId;
  };

  // Verify the display case exists before trying to like it
  useEffect(() => {
    const verifyDisplayCase = async () => {
      if (!displayCaseId) return;
      
      try {
        // Check if display case exists in public_display_cases
        const displayCaseRef = doc(db, 'public_display_cases', displayCaseId);
        const displayCaseDoc = await getDoc(displayCaseRef);
        
        if (!displayCaseDoc.exists()) {
          console.error("Display case does not exist:", displayCaseId);
          setError("This display case no longer exists");
        }
      } catch (error) {
        console.error("Error verifying display case:", error);
      }
    };
    
    verifyDisplayCase();
  }, [displayCaseId]);

  // Set up likes listener
  useEffect(() => {
    if (!displayCaseId) return;

    // Function to handle snapshot updates
    const handleLikesSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      setLikeCount(snapshot.size);
      
      // Check if user has liked (either authenticated or anonymous)
      const userId = user ? user.uid : getAnonymousId();
      const userLiked = snapshot.docs.some(doc => doc.data().userId === userId);
        setLiked(userLiked);
    };

    // Function to handle errors
    const handleLikesError = (error: Error) => {
      console.error("Likes listener error:", error);
      toast.error("Unable to load likes");
    };

    // Set up the listener using our service
    const unsubscribe = LikeService.onLikesChange(
      displayCaseId,
      handleLikesSnapshot,
      handleLikesError
    );

    // Cleanup listener on unmount
    return unsubscribe;
  }, [displayCaseId, user]);

  // When user changes, check if they liked this display case
  useEffect(() => {
    const checkUserLike = async () => {
      if (!displayCaseId) return;
      
      try {
        const userId = user ? user.uid : getAnonymousId();
        const hasLiked = await LikeService.hasUserLiked(displayCaseId, userId);
        setLiked(hasLiked);
      } catch (error) {
        console.error("Error checking if user liked:", error);
      }
    };
    
    checkUserLike();
  }, [user, displayCaseId]);

  // Toggle like function
  const handleLike = async () => {
    // Clear previous errors
    setError(null);

    // Prevent multiple clicks
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Get either the authenticated user ID or an anonymous ID
      const userId = user ? user.uid : getAnonymousId();
      
      if (liked) {
        // User already liked - remove the like
        await LikeService.removeLike(displayCaseId, userId);
      } else {
        // User hasn't liked - add a like
        await LikeService.addLike(displayCaseId, userId);
      }
    } catch (error: any) {
      console.error("Failed to update like:", error);
      
      // More specific error messages
      if (error.code === "permission-denied") {
        setError("You don't have permission to like this display case");
        toast.error("Permission denied");
      } else {
        setError("Failed to update like");
        toast.error("Something went wrong");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleLike}
        disabled={isLoading || !!error}
        className={`flex items-center space-x-1 text-sm transition-colors ${
          liked ? "text-red-500" : "text-gray-400 hover:text-red-500"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={liked ? "Unlike" : "Like"}
        title={error || (liked ? "Unlike" : "Like")}
      >
        <Heart 
          className={`w-4 h-4 ${isLoading ? "animate-pulse" : ""}`} 
          fill={liked ? "currentColor" : "none"} 
        />
        <span>{likeCount}</span>
      </button>
      
      {/* Error message */}
      {error && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}

// Also maintain the default export for backward compatibility
export default LikeButton; 