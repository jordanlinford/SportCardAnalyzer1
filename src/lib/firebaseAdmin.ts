import * as admin from 'firebase-admin';

// Define explicit types for our export variables
let adminApp: admin.app.App | any;
let adminDb: admin.firestore.Firestore | any;
let adminAuth: admin.auth.Auth | any;
let isInitialized = false;

try {
  if (!admin.apps.length) {
    // For production environments, use actual credentials
    try {
      const serviceAccount = require('../../firebase-adminsdk.json');
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin initialized successfully');
      isInitialized = true;
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
      
      // Mock implementation for development if needed
      console.warn('Using mock Firebase Admin implementation');
      adminApp = {
        firestore: () => ({
          collection: () => ({
            doc: () => ({
              get: async () => ({ exists: false, data: () => ({}) }),
              set: async () => ({}),
              update: async () => ({}),
            }),
            add: async () => ({ id: 'mock-id' }),
            where: () => ({
              get: async () => ({ 
                empty: true, 
                docs: [],
                forEach: () => {},
              }),
            }),
          }),
        }),
        auth: () => ({
          getUser: async () => ({ uid: 'mock-uid', email: 'mock@example.com' }),
          verifyIdToken: async () => ({ uid: 'mock-uid' }),
        }),
      };
    }
  } else {
    adminApp = admin.app();
    console.log('Using existing Firebase Admin app');
    isInitialized = true;
  }
  
  if (isInitialized) {
    adminDb = adminApp.firestore();
    adminAuth = adminApp.auth();
  }
} catch (error) {
  console.error('Critical error in Firebase Admin initialization:', error);
}

export { adminDb, adminAuth, isInitialized }; 