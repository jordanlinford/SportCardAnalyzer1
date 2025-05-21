import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper function to get card data from Firebase
export async function getCardData(cardId) {
  try {
    const cardsRef = collection(db, 'cards');
    const q = query(cardsRef, where('id', '==', cardId));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
    return null;
  } catch (error) {
    console.error('Error getting card data:', error);
    return null;
  }
}

// Helper function to save card data to Firebase
export async function saveCardData(cardData) {
  try {
    const cardsRef = collection(db, 'cards');
    const docRef = await addDoc(cardsRef, {
      ...cardData,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving card data:', error);
    return null;
  }
}

// Helper function to update card data in Firebase
export async function updateCardData(cardId, updateData) {
  try {
    const cardsRef = collection(db, 'cards');
    const q = query(cardsRef, where('id', '==', cardId));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docRef = doc(db, 'cards', querySnapshot.docs[0].id);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date().toISOString()
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating card data:', error);
    return false;
  }
}

export { db }; 