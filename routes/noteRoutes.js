import { Router } from 'express';
const router = Router();

// SKELETON: POST /api/notes
router.post('/', (req, res) => {
  res.status(201).json({
    success: true,
    message: "Skeleton upload endpoint working!"
  });
});

export default router;
