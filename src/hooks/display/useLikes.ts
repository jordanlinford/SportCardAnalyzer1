import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LikeService } from '@/services/LikeService';
import { getAnonymousId } from '@/utils/anonymous';

export function useLikes(displayCaseId: string) {
  const { user } = useAuth();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!displayCaseId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Get initial like count
    LikeService.getLikeCount(displayCaseId)
      .then(count => {
        setLikeCount(count);
      })
      .catch(error => {
        console.error('Error getting like count:', error);
      });

    // Check if user has liked
    const userId = user ? user.uid : getAnonymousId();
    
    if (userId) {
      LikeService.hasUserLiked(displayCaseId, userId)
        .then(hasLiked => {
          setLiked(hasLiked);
        })
        .catch(error => {
          console.error('Error checking if user liked:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    // Set up real-time listener for likes
    const unsubscribe = LikeService.onLikesChange(
      displayCaseId,
      snapshot => {
        setLikeCount(snapshot.size);
        
        // Update liked status if user is logged in
        if (userId) {
          const userLike = snapshot.docs.some(doc => doc.data().userId === userId);
          setLiked(userLike);
        }
      },
      error => {
        console.error('Error in likes listener:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [displayCaseId, user]);

  return { likeCount, liked, isLoading };
} 