import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAfb2YtBxD5YEWrNpG0J3GN_g0ZfPzsoOE",
  authDomain: "sports-card-analyzer.firebaseapp.com",
  projectId: "sports-card-analyzer",
  storageBucket: "sports-card-analyzer.appspot.com",
  messagingSenderId: "27312906394",
  appId: "1:27312906394:web:11296b8bb530daad5a7f23",
  measurementId: "G-YNZTKCHQT0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export const auth = getAuth(app);

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

const provider = new GoogleAuthProvider();
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export { db };

async function callApiWithAuth(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not signed in");

  const token = await user.getIdToken();
  const response = await fetch("https://backend-15mfn77fw-jordan-linfords-projects.vercel.app/api/text-search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
} 