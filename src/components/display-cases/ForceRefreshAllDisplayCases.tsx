import { useState } from "react";
import { Button } from "@/components/ui/button";
import { syncAllDisplayCases } from "@/utils/displayCaseUtils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function ForceRefreshAllDisplayCases() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleRefreshAll = async () => {
    if (!user?.uid) {
      toast.error("You must be signed in to refresh display cases");
      return;
    }

    try {
      setIsSyncing(true);
      toast.info("Starting deep refresh of all display cases...");
      
      // Force a complete synchronization of all display cases
      await syncAllDisplayCases(user.uid);
      
      // Invalidate all relevant queries to ensure UI is updated
      queryClient.invalidateQueries({ queryKey: ["displayCases", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["displayCasesWithCards", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["publicDisplayCases"] });
      queryClient.invalidateQueries({ queryKey: ["cards", user.uid] });
      
      toast.success("All display cases have been refreshed!");
    } catch (error) {
      console.error("Error refreshing display cases:", error);
      toast.error("Failed to refresh display cases");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-red-500 hover:bg-red-50 focus:ring-red-500"
      onClick={handleRefreshAll}
      disabled={isSyncing}
    >
      {isSyncing ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Deep Refreshing...
        </>
      ) : (
        <>🔄 Force Deep Refresh</>
      )}
    </Button>
  );
} 