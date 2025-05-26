import { useState } from "react";
import { Button } from "@/components/ui/button";
import { syncPrivateToPublic } from "@/utils/displayCaseUtils";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

interface PublicDisplayCaseFixerButtonProps {
  displayCaseId: string;
  userId: string;
  displayCaseName?: string;
  className?: string;
}

export function PublicDisplayCaseFixerButton({
  displayCaseId,
  userId,
  displayCaseName,
  className,
}: PublicDisplayCaseFixerButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleSyncPublicDisplayCase = async () => {
    if (!user?.uid) {
      toast.error("You must be logged in to sync display cases");
      return;
    }

    // Only allow the owner to sync
    if (user.uid !== userId) {
      toast.error("Only the owner can sync this display case");
      return;
    }

    setIsSyncing(true);
    try {
      const success = await syncPrivateToPublic(userId, displayCaseId);
      
      if (success) {
        // Invalidate all relevant queries to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["displayCases"] });
        queryClient.invalidateQueries({ queryKey: ["displayCases", userId] });
        queryClient.invalidateQueries({ queryKey: ["displayCase", displayCaseId] });
        queryClient.invalidateQueries({ queryKey: ["publicDisplayCase", displayCaseId] });
        queryClient.invalidateQueries({ queryKey: ["publicDisplayCases"] });
        
        toast.success(`${displayCaseName || "Public display case"} synchronized successfully`);
      } else {
        toast.error("Failed to synchronize public display case");
      }
    } catch (error) {
      console.error("Error syncing public display case:", error);
      toast.error("Failed to synchronize public display case");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      onClick={handleSyncPublicDisplayCase}
      variant="outline"
      size="sm"
      className={className}
      disabled={isSyncing}
    >
      {isSyncing ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Syncing Public...
        </span>
      ) : (
        "Sync Public"
      )}
    </Button>
  );
} 