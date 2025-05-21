import express from 'express';
import ebayRoutes from './routes/ebay.js';

const router = express.Router();

// Mount routes
router.use('/ebay', ebayRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default router; 