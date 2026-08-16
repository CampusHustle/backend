import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import noteRoutes from './routes/noteRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';

export const app = express();

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
app.use('/api/notes', noteRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingRoutes);

// Centralized error handling middleware
app.use(errorHandler);

export default app;
