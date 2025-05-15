import { useDisplayCases } from "@/hooks/display/useDisplayCases";
import DisplayCaseCard from "./DisplayCaseCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Sparkles } from "lucide-react";

export default function DisplayCaseList() {
  const { displayCases, isLoading, isError } = useDisplayCases();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[200px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Failed to load display cases</AlertTitle>
        <AlertDescription>
          Something went wrong while fetching your display cases. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!displayCases || displayCases.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        You haven't created any display cases yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {displayCases.map((displayCase) => (
        <DisplayCaseCard key={displayCase.id} displayCase={displayCase} />
      ))}
    </div>
  );
} 