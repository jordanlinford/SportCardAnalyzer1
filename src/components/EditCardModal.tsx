import { useState } from 'react';
import { Card, CardService } from '../services/CardService';
import { uploadImage } from '../utils/imageUpload';
import { useAuth } from '@/context/AuthContext';
import { EmergencyDeleteButton } from './EmergencyDeleteButton';
import { syncCardWithDisplayCases } from '@/lib/firebase/cards';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface EditCardModalProps {
  card: Card;
  isOpen: boolean;
  onClose: () => void;
  onCardUpdated: () => void;
  onCardDeleted: () => void;
}

export const EditCardModal = ({ card, isOpen, onClose, onCardUpdated, onCardDeleted }: EditCardModalProps) => {
  const { user } = useAuth();
  const [editedCard, setEditedCard] = useState<Card>(card);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState<string>(card.tags?.join(', ') || '');
  const queryClient = useQueryClient();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const imageUrl = await uploadImage(file, user.uid);
      setEditedCard(prev => ({ ...prev, imageUrl }));
    } catch (error) {
      setError('Failed to upload image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to edit cards');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const parsedTags = tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);

      const formattedPricePaid = editedCard.pricePaid !== undefined 
        ? parseFloat(editedCard.pricePaid.toFixed(2)) 
        : undefined;
        
      const formattedCurrentValue = editedCard.currentValue !== undefined 
        ? parseFloat(editedCard.currentValue.toFixed(2)) 
        : undefined;

      const updateData = {
        playerName: editedCard.playerName,
        year: editedCard.year,
        cardSet: editedCard.cardSet,
        variation: editedCard.variation,
        cardNumber: editedCard.cardNumber,
        condition: editedCard.condition,
        imageUrl: editedCard.imageUrl,
        tags: parsedTags,
        pricePaid: formattedPricePaid,
        currentValue: formattedCurrentValue
      };

      console.log("Updating card with tags:", parsedTags);
      const updatedCard = await CardService.updateCard(user.uid, editedCard.id, updateData);
      
      const tagsChanged = JSON.stringify(card.tags) !== JSON.stringify(parsedTags);
      
      if (tagsChanged) {
        try {
          console.log("Syncing updated card with display cases...");
          const syncResult = await syncCardWithDisplayCases(
            { ...updatedCard, tags: parsedTags },
            user.uid
          );
          
          if (syncResult.syncedCount > 0) {
            toast.success(`Card was updated in ${syncResult.syncedCount} display case(s) based on tag changes`);
          }
          
        } catch (syncError) {
          console.error("Error syncing card with display cases:", syncError);
          toast.error("Error syncing card with display cases. Try refreshing the page.");
        }
      }
      
      // Always invalidate both queries regardless of whether tags changed
      queryClient.invalidateQueries({ queryKey: ["cards", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["displayCases", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["displayCasesWithCards", user?.uid] });
      
      // Add a slight delay to ensure Firebase has updated the data
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onCardUpdated();
      onClose();
    } catch (error) {
      console.error("Error updating card:", error);
      setError('Failed to update card');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Edit Card</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="playerName" className="block text-sm font-medium text-gray-700">Player Name</label>
            <input
              id="playerName"
              type="text"
              value={editedCard.playerName}
              onChange={(e) => setEditedCard(prev => ({ ...prev, playerName: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="year" className="block text-sm font-medium text-gray-700">Year</label>
            <input
              id="year"
              type="text"
              value={editedCard.year}
              onChange={(e) => setEditedCard({ ...editedCard, year: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="cardSet" className="block text-sm font-medium text-gray-700">Card Set</label>
            <input
              id="cardSet"
              type="text"
              value={editedCard.cardSet}
              onChange={(e) => setEditedCard(prev => ({ ...prev, cardSet: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="variation" className="block text-sm font-medium text-gray-700">Variation</label>
            <input
              id="variation"
              type="text"
              value={editedCard.variation}
              onChange={(e) => setEditedCard(prev => ({ ...prev, variation: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700">Card Number</label>
            <input
              id="cardNumber"
              type="text"
              value={editedCard.cardNumber}
              onChange={(e) => setEditedCard(prev => ({ ...prev, cardNumber: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label htmlFor="condition" className="block text-sm font-medium text-gray-700">Condition</label>
            <input
              id="condition"
              type="text"
              value={editedCard.condition}
              onChange={(e) => setEditedCard(prev => ({ ...prev, condition: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter grading company and grade (e.g., PSA 9, BGS 9.5) or 'Raw'"
              required
            />
          </div>

          <div>
            <label htmlFor="pricePaid" className="block text-sm font-medium text-gray-700">Price Paid ($)</label>
            <input
              id="pricePaid"
              type="number"
              value={editedCard.pricePaid !== undefined ? editedCard.pricePaid.toFixed(2) : ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setEditedCard(prev => ({
                  ...prev,
                  pricePaid: isNaN(value) ? 0 : value
                }));
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label htmlFor="currentValue" className="block text-sm font-medium text-gray-700">Current Value ($)</label>
            <input
              id="currentValue"
              type="number"
              value={editedCard.currentValue !== undefined ? editedCard.currentValue.toFixed(2) : ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setEditedCard(prev => ({
                  ...prev,
                  currentValue: isNaN(value) ? 0 : value
                }));
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700">Tags (comma separated)</label>
            <input
              id="tags"
              type="text"
              value={tagsInput}
              onChange={(e) => {
                setTagsInput(e.target.value);
                
                const parsedTags = e.target.value
                  .split(',')
                  .map(tag => tag.trim())
                  .filter(Boolean);
                
                setEditedCard(prev => ({
                  ...prev,
                  tags: parsedTags
                }));
              }}
              placeholder="e.g. Rookie, Holo, Lakers"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Separate multiple tags with commas (e.g., "Rookie, Holo, Lakers")
            </p>
          </div>

          <div>
            <label htmlFor="image" className="block text-sm font-medium text-gray-700">Image</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="mt-1 block w-full"
            />
            {isLoading && <p className="text-sm text-gray-500">Uploading...</p>}
            {editedCard.imageUrl && (
              <img
                src={editedCard.imageUrl}
                alt={editedCard.playerName}
                className="mt-2 h-32 w-auto object-contain"
              />
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-between">
            <EmergencyDeleteButton 
              cardId={editedCard.id}
              onDeleted={() => {
                onCardDeleted();
                onClose();
              }}
            />
            <div className="space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                disabled={isLoading}
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}; 