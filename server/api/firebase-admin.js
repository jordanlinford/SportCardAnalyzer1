import admin from 'firebase-admin';

// Initialize Firebase Admin SDK - works with both local dev and Vercel deployment
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }
  
  try {
    // For Vercel environment, use the environment variable
    if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
      const credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
      admin.initializeApp({
        credential: admin.credential.cert(credentials)
      });
      console.log('Firebase Admin initialized with environment credentials');
      return admin;
    } 
    // For local development, try to load from file
    else {
      try {
        // Try to load from local file
        const serviceAccount = require('../serviceAccountKey.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin initialized with local credentials file');
        return admin;
      } catch (fileError) {
        console.error('Failed to load serviceAccountKey.json:', fileError.message);
        throw new Error('Firebase Admin initialization failed: No credentials found');
      }
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

// Initialize and export
const firebaseAdmin = initializeFirebaseAdmin();
export const db = firebaseAdmin.firestore();
export default firebaseAdmin; 