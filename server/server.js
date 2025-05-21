import express from 'express';
import cors from 'cors';
import apiRoutes from './api/index.js';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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