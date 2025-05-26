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

// Hardcoded fallback Firebase config
const FALLBACK_CONFIG = {
  apiKey: "AIzaSyAfb2YtBxD5YEWrNpG0J3GN_g0ZfPzsoOE",
  authDomain: "sports-card-analyzer.firebaseapp.com",
  projectId: "sports-card-analyzer",
  storageBucket: "sports-card-analyzer.appspot.com",
  messagingSenderId: "27312906394",
  appId: "1:27312906394:web:11296b8bb530daad5a7f23",
  measurementId: "G-YNZTKCHQT0"
};

// Get configuration from window global if environment variables are not available
const getConfig = () => {
  try {
    // Try to get from environment variables first
    const envConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    
    // Check if any env variables are missing and try to get from window.firebaseConfig
    const hasAllEnvVars = Object.values(envConfig).every(val => val);
    
    if (!hasAllEnvVars && typeof window !== 'undefined' && window.firebaseConfig) {
      console.log('Using Firebase config from window.firebaseConfig');
      return window.firebaseConfig;
    }
    
    if (hasAllEnvVars) {
      console.log('Using Firebase config from environment variables');
      return envConfig;
    }
    
    // If both methods failed, use fallback config
    console.warn('Using fallback Firebase config - please check your environment variables');
    return FALLBACK_CONFIG;
  } catch (error) {
    console.error('Error getting Firebase config:', error);
    return FALLBACK_CONFIG;
  }
};

// Validate that the project ID is correct (not Netlify config table)
const validateConfig = (config: any) => {
  if (!config) return FALLBACK_CONFIG;
  
  // Check if projectId seems to be a Netlify config table
  if (typeof config.projectId === 'string' && 
      (config.projectId.includes('|') || 
       config.projectId.includes('context') ||
       config.projectId.includes('VITE_FIREBASE'))) {
    console.error('Firebase projectId appears to be invalid. Using fallback configuration.');
    return FALLBACK_CONFIG;
  }
  
  return config;
};

// Get the Firebase config
const firebaseConfig = validateConfig(getConfig());

// Get API URL from window or environment variables
export const API_URL = 
  (typeof window !== 'undefined' && window.API_URL) ||
  import.meta.env.VITE_API_URL || 
  'https://sports-card-api.netlify.app/api/text-search'; // Use our new dedicated API endpoint

// Log the configuration we're using
console.log('Firebase config:', { 
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

console.log("Firebase initialized successfully");

export { app, db, auth, storage }; 