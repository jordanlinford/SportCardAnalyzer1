import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAfb2YtBxD5YEWrNpG0J3GN_g0ZfPzsoOE",
  authDomain: "sports-card-analyzer.firebaseapp.com",
  projectId: "sports-card-analyzer",
  storageBucket: "sports-card-analyzer.firebasestorage.app",
  messagingSenderId: "27312906394",
  appId: "1:27312906394:web:11296b8bb530daad5a7f23",
  measurementId: "G-YNZTKCHQT0"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Analytics only in the browser
declare const window: any;
if (typeof window !== 'undefined') {
  getAnalytics(app);
} 