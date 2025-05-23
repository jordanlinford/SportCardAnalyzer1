import { useState } from "react";
import { Modal } from "../ui/modal";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useDisplayCases } from "@/hooks/display/useDisplayCases";
import { useCards } from "@/hooks/useCards";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";

interface CreateDisplayCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateDisplayCaseModal({ isOpen, onClose }: CreateDisplayCaseModalProps) {
  const [name, setName] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [theme, setTheme] = useState<"wood" | "velvet" | "glass">("wood");
  const [isPublic, setIsPublic] = useState(true);
  const { createDisplayCase, isCreating } = useDisplayCases();
  const { data: cards = [] } = useCards();
  const { user } = useAuth();

  // Get all unique tags from cards
  const allTags = Array.from(new Set(cards.flatMap(card => card.tags || []))).sort();

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
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
    const matchedCards = cards.filter(card =>
      card.tags && card.tags.some(tag => selectedTags.includes(tag))
    );
    const cardIds = matchedCards.map(card => card.id);
    console.log("Creating display case with:", { name, cardIds, isPublic, selectedTags, theme });
    console.log("Public status:", isPublic ? "Public" : "Private");
    
    try {
      // Create the display case and get its ID
      const displayCaseId = await createDisplayCase({
        name: name.trim(),
        cardIds,
        isPublic,
        tags: selectedTags,
        theme,
      });
      
      console.log("Display case created, ID:", displayCaseId);
      
      // If public, also add to public_display_cases collection
      if (isPublic && user) {
        console.log("Creating public copy of display case");
        const publicRef = doc(db, "public_display_cases", displayCaseId);
        
        // Create a complete public display case document with all necessary fields
        const publicDisplayCase = {
          name: name.trim(),
          cardIds,
          isPublic: true,
          tags: selectedTags,
          theme,
          userId: user.uid,
          ownerName: user.displayName || "Anonymous",
          createdAt: new Date(),
          updatedAt: new Date(),
          id: displayCaseId,
          publicId: displayCaseId,
          likes: 0,
          visits: 0,
          comments: []
        };
        
        await setDoc(publicRef, publicDisplayCase);
        console.log("Public copy created successfully with data:", publicDisplayCase);
      } else {
        console.log("Display case is private, skipping public copy creation");
      }
      
      console.log("Display case created successfully");
      setName("");
      setSelectedTags([]);
      setTheme("wood");
      setIsPublic(true);
      onClose();
    } catch (error) {
      console.error("Error creating display case:", error);
      toast.error("Failed to create display case");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Display Case">
      <form onSubmit={handleSubmit} className="space-y-6">
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
          <div className="flex flex-wrap gap-2">
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
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isCreating || !name.trim() || selectedTags.length === 0}
          >
            {isCreating ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </span>
            ) : (
              "Create Display Case"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
} 