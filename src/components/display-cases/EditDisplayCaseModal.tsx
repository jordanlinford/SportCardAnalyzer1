import { useState, useEffect } from "react";
import { Modal } from "../ui/modal";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useCards } from "@/hooks/useCards";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { DisplayCase } from "@/types/display-case";
import { doc, updateDoc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";

interface EditDisplayCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayCase: DisplayCase;
}

export function EditDisplayCaseModal({ isOpen, onClose, displayCase }: EditDisplayCaseModalProps) {
  const [name, setName] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [theme, setTheme] = useState<"wood" | "velvet" | "glass">("wood");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: cards = [] } = useCards();
  const { user } = useAuth();

  console.log("EditDisplayCaseModal rendered with display case:", displayCase);

  // Initialize form with display case data
  useEffect(() => {
    if (displayCase) {
      console.log("Setting initial form values:", displayCase);
      console.log("isPublic value from database:", displayCase.isPublic);
      
      setName(displayCase.name || "");
      setSelectedTags(displayCase.tags || []);
      setTheme(displayCase.theme || "wood");
      
      // Force cast to boolean to avoid any issues with undefined or truthy/falsy values
      const isPublicBool = displayCase.isPublic === true;
      console.log("Setting isPublic to:", isPublicBool);
      setIsPublic(isPublicBool);
    }
  }, [displayCase]);

  // Get all unique tags from cards
  const allTags = Array.from(new Set(cards.flatMap(card => card.tags || []))).sort();
  
  console.log("Available tags:", allTags);
  console.log("Selected tags:", selectedTags);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Directly update the display case using Firestore
  const directUpdateDisplayCase = async () => {
    if (!user?.uid) {
      toast.error("You must be logged in to update a display case");
      return;
    }
    
    setIsSubmitting(true);
    
    // Prepare update data
    const updateData = {
      name: name.trim(),
      tags: selectedTags,
      isPublic,
      theme,
      cardIds: displayCase.cardIds || [],
      updatedAt: new Date()
    };
    
    console.log("Directly updating display case", displayCase.id, "with data:", updateData);
    console.log("isPublic value being saved:", isPublic);
    console.log("Previous isPublic value:", displayCase.isPublic);
    
    try {
      // Update document directly
      const displayCaseRef = doc(db, "users", user.uid, "display_cases", displayCase.id);
      await updateDoc(displayCaseRef, updateData);
      console.log("Successfully updated main display case document");
      
      // Handle public/private status
      const publicRef = doc(db, "public_display_cases", displayCase.id);
      
      // Get current public status before updating
      const wasPreviouslyPublic = displayCase.isPublic === true;
      console.log("Was previously public:", wasPreviouslyPublic);
      console.log("Is now public:", isPublic);
      
      // Handle public status changes
      if (isPublic !== wasPreviouslyPublic) {
        if (isPublic) {
          // Making the display case public - add to public collection
          console.log("Making display case public");
          const fullData = {
            ...updateData,
            id: displayCase.id,
            publicId: displayCase.id,
            userId: user.uid,
            ownerName: user.displayName || "Anonymous", 
            createdAt: displayCase.createdAt || new Date(),
            updatedAt: new Date(),
            likes: 0,
            visits: 0,
            comments: [],
            // Explicitly include cardIds from the original display case to ensure they're copied
            cardIds: displayCase.cardIds || []
          };
          
          console.log("Public data being saved:", fullData);
          await setDoc(publicRef, fullData);
          console.log("Successfully created public copy");
        } else {
          // Making the display case private - remove from public collection
          console.log("Making display case private");
          try {
            const publicSnap = await getDoc(publicRef);
            if (publicSnap.exists()) {
              await deleteDoc(publicRef);
              console.log("Successfully removed public copy");
            } else {
              console.log("Public copy doesn't exist, no need to delete");
            }
          } catch (err) {
            console.error("Error removing from public collection:", err);
          }
        }
      } else if (isPublic) {
        // If still public but data changed, update the public version too
        console.log("Updating public display case data");
        try {
          // Check if the public document exists first
          const publicSnap = await getDoc(publicRef);
          if (publicSnap.exists()) {
            // Include cardIds when updating public display case
            const publicUpdateData: any = {
              ...updateData,
              publicId: displayCase.id,
              userId: user.uid,
              ownerName: user.displayName || "Anonymous",
              updatedAt: new Date(),
              cardIds: displayCase.cardIds || []
            };
            
            // Preserve existing likes, visits, and comments
            const existingData = publicSnap.data();
            if (existingData) {
              if (existingData.likes) publicUpdateData.likes = existingData.likes;
              if (existingData.visits) publicUpdateData.visits = existingData.visits;
              if (existingData.comments) publicUpdateData.comments = existingData.comments;
            }
            
            console.log("Updating existing public copy with data:", publicUpdateData);
            await updateDoc(publicRef, publicUpdateData);
            console.log("Successfully updated existing public copy");
          } else {
            // The public document doesn't exist, create it
            console.log("Public copy doesn't exist, creating new one");
            const fullData = {
              ...updateData,
              id: displayCase.id,
              publicId: displayCase.id,
              userId: user.uid,
              ownerName: user.displayName || "Anonymous",
              createdAt: displayCase.createdAt || new Date(),
              updatedAt: new Date(),
              likes: 0,
              visits: 0,
              comments: [],
              // Explicitly include cardIds
              cardIds: displayCase.cardIds || []
            };
            
            console.log("New public data being saved:", fullData);
            await setDoc(publicRef, fullData);
            console.log("Successfully created new public copy");
          }
        } catch (err) {
          console.error("Error updating public display case:", err);
          // Don't fail the whole operation if this part fails
        }
      }
      
      console.log("Display case updated successfully");
      toast.success("Display case updated successfully");
      onClose();
    } catch (error) {
      console.error("Error updating display case:", error);
      toast.error("Failed to update display case: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Please enter a display case name");
      return;
    }
    
    if (selectedTags.length === 0) {
      toast.error("Please select at least one tag");
      return;
    }
    
    // Use direct Firestore update
    await directUpdateDisplayCase();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Display Case">
      <form onSubmit={handleSubmit} className="space-y-6 p-1">
        <div className="space-y-2">
          <Label htmlFor="name">Display Case Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Favorite Cards"
            required
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>Select Tags</Label>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border p-2 rounded">
            {allTags.length === 0 ? (
              <span className="text-gray-500">No tags found in your collection.</span>
            ) : (
              allTags.map(tag => (
                <label key={tag} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() => handleTagToggle(tag)}
                  />
                  <span className="text-sm">{tag}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">Background Theme</Label>
          <select
            id="theme"
            value={theme}
            onChange={e => setTheme(e.target.value as "wood" | "velvet" | "glass")}
            className="w-full border rounded px-2 py-1"
            aria-label="Theme selection"
          >
            <option value="wood">Wood</option>
            <option value="velvet">Velvet</option>
            <option value="glass">Glass</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="public"
            checked={isPublic}
            onCheckedChange={(checked: boolean) => setIsPublic(checked)}
          />
          <Label htmlFor="public">Make this display case public</Label>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !name.trim() || selectedTags.length === 0}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Updating...
              </span>
            ) : (
              "Update Display Case"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
} 