/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Print debug info without exposing sensitive data
console.log("Firebase config:", {
  projectId: firebaseConfig.projectId,
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain
});

// API URL configuration - The /api part is handled by the server endpoints
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Log API URL for debugging
console.log("API URL configured as:", API_URL);

// Add a comment explaining deployment requirements
// NOTE: For production, ensure the API backend is deployed at sports-card-api.vercel.app
// and properly configured to handle CORS requests from the main app domain

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

console.log("Firebase initialized successfully");

export { app, db, auth, storage }; 