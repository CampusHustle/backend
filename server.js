import express, { json } from 'express';
import cors from 'cors';
import 'dotenv/config';
import noteRoutes from './routes/noteRoutes.js';
const app = express();

// Middleware
app.use(cors());
app.use(json());

// Wire up today's route skeleton
app.use('/api/notes', noteRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
