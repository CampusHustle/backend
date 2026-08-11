import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Protected profile routes for current authenticated user
router.get('/me', requireAuth, userController.getMe);
router.put('/me', requireAuth, userController.updateMe);

// Public or authenticated tutor search (must precede /:id parameter route)
router.get('/search', userController.searchTutors);

// Public user/tutor profile lookup
router.get('/:id', userController.getUserById);

export default router;
