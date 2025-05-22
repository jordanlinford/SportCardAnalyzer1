// This script generates a JavaScript file with Firebase configuration from environment variables
// to be included in the built application

import fs from 'fs';
import path from 'path';

// Function to create the env.js file with Firebase config
function generateEnvFile() {
  console.log('Generating env.js file with Firebase configuration...');
  
  // Get environment variables
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || 'MISSING_API_KEY',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'MISSING_AUTH_DOMAIN',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'MISSING_PROJECT_ID',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'MISSING_STORAGE_BUCKET',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'MISSING_MESSAGING_SENDER_ID',
    appId: process.env.VITE_FIREBASE_APP_ID || 'MISSING_APP_ID',
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || 'MISSING_MEASUREMENT_ID'
  };
  
  // Get API URL
  const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';
  console.log('Using API URL:', apiUrl);
  
  // Create JavaScript content
  const fileContent = `// This file was generated during the build process
// It contains the Firebase configuration for the application
window.firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};

// Set API URL globally
window.API_URL = "${apiUrl}";

// Log that Firebase config was loaded
console.log("Firebase config loaded from env.js:", {
  projectId: window.firebaseConfig.projectId,
  hasApiKey: !!window.firebaseConfig.apiKey,
  hasAuthDomain: !!window.firebaseConfig.authDomain
});
console.log("API URL configured as:", window.API_URL);`;

  // Ensure dist directory exists
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Write to file
  fs.writeFileSync(path.join(distDir, 'env.js'), fileContent);
  console.log('Successfully generated env.js in dist directory');
}

// Run the function
generateEnvFile(); 