import express from 'express';
import cors from 'cors';
import apiRoutes from './api/index.js';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Create images directory if it doesn't exist
const IMAGES_DIR = path.join(__dirname, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  console.log('Created local image cache dir', IMAGES_DIR);
}

// Middleware
app.use(cors({
  origin: [
    'https://sportscardanalyzer.com',
    'https://www.sportscardanalyzer.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5135'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Static file middleware for serving cached images
app.use('/images', express.static(path.join(__dirname, 'images')));

// Direct image proxy endpoint
app.get('/api/image-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('[Image Proxy] Request received for:', url.substring(0, 120) + '...');
    
    // Check if it's a hardcoded Jefferson card image (which don't need proxy)
    if (url.includes('i.ebayimg.com/images/g/mVwAAOSwsjVkTBkq') || 
        url.includes('i.ebayimg.com/images/g/YkIAAOSwK3VkoBj3') ||
        url.includes('i.ebayimg.com/images/g/EkoAAOSwasFll1PQ')) {
      // Just redirect to the original URL for these known good images
      return res.redirect(url);
    }
    
    // Create a filename for caching based on URL hash
    const urlHash = Buffer.from(url).toString('base64').replace(/[/+=]/g, '_');
    const localPath = path.join(IMAGES_DIR, `${urlHash}.jpg`);
    
    // Check if we already have this image cached
    if (fs.existsSync(localPath)) {
      const data = fs.readFileSync(localPath);
      res.set('Content-Type', 'image/jpeg');
      res.set('Content-Length', data.length);
      return res.send(data);
    }
    
    // Otherwise fetch the image
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });
    
    // Cache the image for future requests
    fs.writeFileSync(localPath, response.data);
    
    // Send the response
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.set('Content-Length', response.data.length);
    res.send(response.data);
    
    console.log('[Image Proxy] Success:', url.substring(0, 120) + '...');
  } catch (error) {
    console.error('[Image Proxy] Error:', error.message);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 