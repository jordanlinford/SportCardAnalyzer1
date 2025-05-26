import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// We need to load the function a bit differently since it's using CommonJS
const textSearchPath = join(__dirname, '..', 'netlify', 'functions', 'text-search.js');
const textSearchCode = fs.readFileSync(textSearchPath, 'utf8');

// Create a temporary CommonJS module
const tempFile = join(__dirname, 'temp-function.cjs');
fs.writeFileSync(tempFile, textSearchCode);

// Import it
const textSearchFunction = await import('file://' + tempFile);

const app = express();
const PORT = 3002;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Create a route to test our Netlify function
app.post('/api/text-search', async (req, res) => {
  try {
    // Create a mock event object similar to what Netlify would provide
    const mockEvent = {
      httpMethod: 'POST',
      body: JSON.stringify(req.body),
      headers: req.headers
    };
    
    // Call our Netlify function directly
    const result = await textSearchFunction.handler(mockEvent);
    
    // Send back the response with the appropriate status code
    res.status(result.statusCode).send(result.body);
  } catch (error) {
    console.error('Error calling function:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Function test server running at http://localhost:${PORT}`);
  console.log(`Try calling the function with: curl -X POST http://localhost:${PORT}/api/text-search -H "Content-Type: application/json" -d '{"query":"Michael Jordan Fleer 1986"}'`);
  
  // Clean up the temporary file when we're done
  process.on('SIGINT', () => {
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      // Ignore errors on cleanup
    }
    process.exit(0);
  });
}); 