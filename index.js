import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';

const app = express();

// Global middleware
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());

// API health check
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', environment: config.nodeEnv, timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Centralized error handling middleware
app.use(errorHandler);

// Connect database and start server
async function startServer() {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`CampusHustle API Server running on port ${config.port} (${config.nodeEnv})`);
  });
}

startServer();
