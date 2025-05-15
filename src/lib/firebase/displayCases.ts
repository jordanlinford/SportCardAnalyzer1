import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from './config';
import { auth } from './config';
import { v4 as uuidv4 } from 'uuid';

export interface DisplayCaseComment {
  user: string;
  text: string;
  timestamp: Date;
}

export interface DisplayCaseInput {
  name: string;
  description: string;
  background: string;
  isPublic: boolean;
}

export interface DisplayCase extends DisplayCaseInput {
  id: string;
  publicId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  cardIds: string[];
  likes: number;
  comments: DisplayCaseComment[];
  visits: number;
}

export async function getUserDisplayCases() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const snapshot = await getDocs(collection(db, 'users', user.uid, 'displayCases'));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt.toDate(),
    updatedAt: doc.data().updatedAt.toDate(),
    comments: doc.data().comments?.map((comment: any) => ({
      ...comment,
      timestamp: comment.timestamp.toDate()
    })) || []
  })) as DisplayCase[];
}

export async function getDisplayCaseById(displayCaseId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, 'users', user.uid, 'displayCases', displayCaseId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
    comments: data.comments?.map((comment: any) => ({
      ...comment,
      timestamp: comment.timestamp.toDate()
    })) || []
  } as DisplayCase;
}

export async function createDisplayCase(data: DisplayCaseInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const publicId = uuidv4();
  const newCase = {
    ...data,
    userId: user.uid,
    publicId,
    cardIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    likes: 0,
    comments: [],
    visits: 0,
  };
  
  const docRef = await addDoc(collection(db, 'displayCases'), newCase);
  return docRef.id;
}

export async function deleteDisplayCase(displayCaseId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, 'users', user.uid, 'displayCases', displayCaseId);
  await deleteDoc(docRef);
}

export async function addCardToCase(displayCaseId: string, cardId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, 'users', user.uid, 'displayCases', displayCaseId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error('Display case not found');

  const caseData = snapshot.data();
  const updatedCards = Array.from(new Set([...(caseData.cardIds || []), cardId]));

  await updateDoc(docRef, {
    cardIds: updatedCards,
    updatedAt: serverTimestamp(),
  });
}

export async function removeCardFromCase(displayCaseId: string, cardId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, 'users', user.uid, 'displayCases', displayCaseId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error('Display case not found');

  const caseData = snapshot.data();
  const updatedCards = (caseData.cardIds || []).filter((id: string) => id !== cardId);

  await updateDoc(docRef, {
    cardIds: updatedCards,
    updatedAt: serverTimestamp(),
  });
}

export async function updateDisplayCase(displayCaseId: string, data: Partial<DisplayCase>) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, 'users', user.uid, 'displayCases', displayCaseId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function addComment(displayCaseId: string, comment: Omit<DisplayCaseComment, "timestamp">) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, 'users', user.uid, 'displayCases', displayCaseId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error('Display case not found');

  const caseData = snapshot.data();
  const newComment = {
    ...comment,
    timestamp: serverTimestamp()
  };

  await updateDoc(docRef, {
    comments: [...(caseData.comments || []), newComment],
    updatedAt: serverTimestamp(),
  });
}

export async function toggleLike(displayCaseId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, 'users', user.uid, 'displayCases', displayCaseId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error('Display case not found');

  const caseData = snapshot.data();
  await updateDoc(docRef, {
    likes: (caseData.likes || 0) + 1,
    updatedAt: serverTimestamp(),
  });
} 