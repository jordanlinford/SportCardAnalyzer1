import { Timestamp } from "firebase/firestore";

export interface DisplayCaseComment {
  user: string; // userId
  text: string;
  createdAt: any; // Firestore Timestamp
}

export interface DisplayCase {
  id: string;
  name: string;
  userId: string;
  cardIds: string[];
  tags: string[];
  theme: 'wood' | 'velvet' | 'glass';
  isPublic: boolean;
  createdAt: any; // Firestore Timestamp
  description?: string;
  likes?: number;
  comments?: DisplayCaseComment[];
  visits?: number;
  publicId?: string;
}

export interface CreateDisplayCaseData {
  name: string;
  userId: string;
  cardIds: string[];
  tags: string[];
  theme: 'wood' | 'velvet' | 'glass';
  isPublic: boolean;
  description?: string;
} 