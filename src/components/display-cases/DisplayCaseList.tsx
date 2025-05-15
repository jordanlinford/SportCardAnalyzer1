import DisplayCaseCard from "./DisplayCaseCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Sparkles } from "lucide-react";
import { DisplayCase } from "@/types/DisplayCase";

interface DisplayCaseListProps {
  displayCases: DisplayCase[];
}

export default function DisplayCaseList({ displayCases }: DisplayCaseListProps) {
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