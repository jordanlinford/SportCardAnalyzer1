// Script to update env.js file directly
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Content of the file
const content = `
window.API_URL = "/api";
window.firebaseConfig = {
  apiKey: "AIzaSyAfb2YtBxD5YEWrNpG0J3GN_g0ZfPzsoOE",
  authDomain: "sports-card-analyzer.firebaseapp.com",
  projectId: "sports-card-analyzer",
  storageBucket: "sports-card-analyzer.appspot.com",
  messagingSenderId: "27312906394",
  appId: "1:27312906394:web:11296b8bb530daad5a7f23",
  measurementId: "G-YNZTKCHQT0"
};
`;

// Path to output file
const outputPath = path.join(__dirname, 'dist', 'env.js');

// Create the file
fs.writeFileSync(outputPath, content);

console.log('Successfully updated env.js in dist directory with new API URL: /api'); 