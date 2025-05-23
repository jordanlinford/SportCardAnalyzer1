// This script generates a JavaScript file with environment variables
// that will be available at runtime in the browser

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment variables to include
const apiUrl = process.env.VITE_API_URL || '/api';
const firebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID || 'sports-card-analyzer';

// Path to output file
const outputPath = path.join(__dirname, '..', 'dist', 'env.js');

// Content of the file
const content = `
window.API_URL = "${apiUrl}";
window.firebaseConfig = {
  apiKey: "${process.env.VITE_FIREBASE_API_KEY || 'AIzaSyAfb2YtBxD5YEWrNpG0J3GN_g0ZfPzsoOE'}",
  authDomain: "${process.env.VITE_FIREBASE_AUTH_DOMAIN || 'sports-card-analyzer.firebaseapp.com'}",
  projectId: "${firebaseProjectId}",
  storageBucket: "${process.env.VITE_FIREBASE_STORAGE_BUCKET || 'sports-card-analyzer.appspot.com'}",
  messagingSenderId: "${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '27312906394'}",
  appId: "${process.env.VITE_FIREBASE_APP_ID || '1:27312906394:web:11296b8bb530daad5a7f23'}",
  measurementId: "${process.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-YNZTKCHQT0'}"
};
`;

// Create the file
fs.writeFileSync(outputPath, content);

console.log('Generating env.js file with Firebase configuration...');
console.log(`Using API URL: ${apiUrl}`);
console.log(`Using Firebase projectId: ${firebaseProjectId}`);
console.log('Successfully generated env.js in dist directory'); 