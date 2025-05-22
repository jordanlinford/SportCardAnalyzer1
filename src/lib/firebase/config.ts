/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Extend Window interface to include our global properties
declare global {
  interface Window {
    firebaseConfig?: any;
    API_URL?: string;
  }
}

// Get configuration from window global if environment variables are not available
const getConfig = () => {
  // Try to get from environment variables first
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
  
  // Check if any values are missing
  const hasMissingValues = Object.values(envConfig).some(val => !val || val.includes('%VITE_'));
  
  // If all environment variables are available, use them
  if (!hasMissingValues) {
    return envConfig;
  }
  
  // Otherwise, try to use window.firebaseConfig (set in index.html)
  if (typeof window !== 'undefined' && window.firebaseConfig) {
    console.log('Using fallback Firebase config from window object');
    return window.firebaseConfig;
  }
  
  // If still not available, return the env config anyway (will show proper errors)
  console.warn('Firebase configuration incomplete - auth will not work');
  return envConfig;
};

// Firebase configuration
const firebaseConfig = getConfig();

// Print debug info without exposing sensitive data
console.log("Firebase config:", {
  projectId: firebaseConfig.projectId,
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain
});

// API URL configuration - Get from window.API_URL (set in env.js), environment variables, or fallback to localhost
export const API_URL = (typeof window !== 'undefined' && window.API_URL) || 
                      import.meta.env.VITE_API_URL || 
                      'http://localhost:3001';

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