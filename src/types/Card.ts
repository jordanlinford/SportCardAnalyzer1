export interface Card {
  tags: string[];
  id: string;
  playerName: string;
  year: string;
  cardSet: string;
  cardNumber: string;
  variation?: string;
  condition?: string;
  price?: number;
  pricePaid?: number;
  currentValue?: number;
  imageUrl?: string;
  savedAt?: Date;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  source?: string;  // Source of the card data, e.g., 'collection', 'eBay', etc.
} 