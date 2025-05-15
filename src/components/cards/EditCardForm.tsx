import { useState } from "react";
import { Card } from "@/types/Card";
import { uploadImage } from "@/utils/imageUpload";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { CardService } from '@/services/CardService';
import { getDoc, doc, deleteDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { toast } from "sonner";
import { EmergencyDeleteButton } from "@/components/EmergencyDeleteButton";

interface EditCardFormProps {
  card: Card;
  isOpen: boolean;
  onClose: () => void;
  onCardUpdated: () => void;
  onCardDeleted: () => void;
}

export function EditCardForm({ card, isOpen, onClose, onCardUpdated, onCardDeleted }: EditCardFormProps) {
  const [editedCard, setEditedCard] = useState<Card>({ ...card });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;

    const file = e.target.files[0];
    setIsLoading(true);
    setError(null);

    try {
      const imageUrl = await uploadImage(file, user.uid);
      setEditedCard(prev => ({ ...prev, imageUrl }));
    } catch (error) {
      setError('Failed to upload image');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to update cards');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await CardService.updateCard(user.uid, editedCard.id, editedCard);
      onCardUpdated();
      onClose();
    } catch (error) {
      console.error("Error updating card:", error);
      setError(error instanceof Error ? error.message : 'Failed to update card');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Card</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playerName">Player Name</Label>
            <Input
              id="playerName"
              value={editedCard.playerName}
              onChange={(e) => setEditedCard(prev => ({ ...prev, playerName: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              value={editedCard.year}
              onChange={(e) => setEditedCard(prev => ({ ...prev, year: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardSet">Card Set</Label>
            <Input
              id="cardSet"
              value={editedCard.cardSet}
              onChange={(e) => setEditedCard(prev => ({ ...prev, cardSet: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="variation">Variation</Label>
            <Input
              id="variation"
              value={editedCard.variation || ''}
              onChange={(e) => setEditedCard(prev => ({ ...prev, variation: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              value={editedCard.cardNumber}
              onChange={(e) => setEditedCard(prev => ({ ...prev, cardNumber: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition" id="condition-label">Condition</Label>
            <Input
              id="condition"
              type="text"
              value={editedCard.condition || ''}
              onChange={(e) => setEditedCard(prev => ({ ...prev, condition: e.target.value }))}
              placeholder='e.g. "Raw", "PSA 10", "SGC 9.5"'
              required
              aria-label="Card Condition"
            />
            <small className="text-gray-500">
              Examples: Raw, PSA 10, SGC 9.5, BGS 8, etc.
            </small>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricePaid">Price Paid ($)</Label>
            <Input
              id="pricePaid"
              type="number"
              value={editedCard.pricePaid || 0}
              onChange={(e) => setEditedCard(prev => ({ ...prev, pricePaid: parseFloat(e.target.value) }))}
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentValue">Current Value ($)</Label>
            <Input
              id="currentValue"
              type="number"
              value={editedCard.currentValue || 0}
              onChange={(e) => setEditedCard(prev => ({ ...prev, currentValue: parseFloat(e.target.value) }))}
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              value={editedCard.tags?.join(', ') || ''}
              onChange={(e) => setEditedCard({ 
                ...editedCard, 
                tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
              })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Image</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
            {isLoading && <p className="text-sm text-gray-500">Uploading...</p>}
            {editedCard.imageUrl && (
              <div className="mt-2">
                <img
                  src={editedCard.imageUrl}
                  alt={editedCard.playerName}
                  className="h-32 w-auto object-contain rounded-md"
                />
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="flex justify-between items-center mt-4">
          <EmergencyDeleteButton 
            cardId={editedCard.id}
            onDeleted={() => {
              onCardDeleted();
              onClose();
            }}
          />
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogFooter>
        
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </DialogContent>
    </Dialog>
  );
} 