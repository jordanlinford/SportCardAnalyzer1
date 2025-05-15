import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useCards } from "@/hooks/useCards";
import { uploadCardImage } from "@/lib/firebase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ✅ Include 'tags' as optional string input
const cardFormSchema = z.object({
  playerName: z.string().min(1, "Player name is required"),
  year: z.string().min(1, "Year is required"),
  cardSet: z.string().min(1, "Card set is required"),
  variation: z.string().optional(),
  cardNumber: z.string().min(1, "Card number is required"),
  condition: z.string().min(1, "Condition is required"),
  pricePaid: z.number().optional(),
  currentValue: z.number().optional(),
  image: z.instanceof(File).optional(),
  tags: z.string().optional(), // free-form string
});

type CardFormData = z.infer<typeof cardFormSchema>;

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCardAdded?: () => void;
}

export function AddCardModal({ isOpen, onClose, onCardAdded }: AddCardModalProps) {
  const { user } = useAuth();
  const { addCard } = useCards();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CardFormData>({
    resolver: zodResolver(cardFormSchema),
  });

  const onSubmit = async (data: CardFormData) => {
    if (!user) return;

    try {
      setIsLoading(true);
      let imageUrl: string | undefined;

      if (data.image) {
        imageUrl = await uploadCardImage(data.image, user.uid);
      }

      const { image, tags, ...rest } = data;

      const cardToAdd = {
        ...rest,
        ownerId: user.uid,
        ...(imageUrl ? { imageUrl } : {}),
        ...(tags
          ? { tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean) }
          : {}),
      };

      await addCard({
        ...cardToAdd,
        tags: cardToAdd.tags || []
      });

      reset();
      onClose();
      onCardAdded?.();
      toast.success("Card added successfully");
    } catch (error) {
      console.error("Error adding card:", error);
      toast.error("Failed to add card");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Add New Card
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900">Player Name *</label>
            <Input 
              {...register("playerName")} 
              className="mt-1" 
              placeholder="Enter player name (e.g., LeBron James)"
            />
            {errors.playerName && (
              <p className="mt-1 text-sm text-red-500">{errors.playerName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">Year *</label>
            <Input 
              {...register("year")} 
              className="mt-1" 
              placeholder="Enter card year (e.g., 2023)"
            />
            {errors.year && (
              <p className="mt-1 text-sm text-red-500">{errors.year.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">Card Set *</label>
            <Input 
              {...register("cardSet")} 
              className="mt-1" 
              placeholder="Enter card set (e.g., Prizm, Topps Chrome)"
            />
            {errors.cardSet && (
              <p className="mt-1 text-sm text-red-500">{errors.cardSet.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">Variation (Optional)</label>
            <Input 
              {...register("variation")} 
              className="mt-1" 
              placeholder="Enter card variation (e.g., Silver, Refractor)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">Card Number *</label>
            <Input 
              {...register("cardNumber")} 
              className="mt-1" 
              placeholder="Enter card number (e.g., #23, 123)"
            />
            {errors.cardNumber && (
              <p className="mt-1 text-sm text-red-500">{errors.cardNumber.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">Condition *</label>
            <Input
              {...register("condition")}
              placeholder="Enter grading company and grade (e.g., PSA 9, BGS 9.5) or 'Raw'"
              className="mt-1"
            />
            {errors.condition && (
              <p className="mt-1 text-sm text-red-500">{errors.condition.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Examples: PSA 10, BGS 9.5, SGC 9, Raw NM-MT
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">Price Paid</label>
            <Input
              type="number"
              step="0.01"
              {...register("pricePaid", { 
                valueAsNumber: true,
                onChange: (e) => {
                  // Format to 2 decimal places
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    e.target.value = value.toFixed(2);
                  }
                }
              })}
              className="mt-1"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">Current Value</label>
            <Input
              type="number"
              step="0.01"
              {...register("currentValue", { 
                valueAsNumber: true,
                onChange: (e) => {
                  // Format to 2 decimal places
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    e.target.value = value.toFixed(2);
                  }
                }
              })}
              className="mt-1"
              placeholder="0.00"
            />
          </div>

          {/* ✅ Tags field */}
          <div>
            <label className="block text-sm font-medium text-gray-900">
              Tags (comma separated)
            </label>
            <Input
              {...register("tags")}
              placeholder="e.g. Rookie, Jazz, Holo"
              className="mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Card Image (Optional)
            </label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setValue("image", file);
                }
              }}
              className="mt-1"
            />
          </div>

          <div className="flex justify-between pt-4">
            <div className="text-sm text-gray-500">* Required fields</div>
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="text-gray-900"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Adding..." : "Add Card"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
