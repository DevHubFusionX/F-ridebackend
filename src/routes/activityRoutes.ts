import express from 'express';
import { getActivity, getEarnings } from '../controllers/activityController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All activity routes require authentication
router.use(protect);

router.get('/', getActivity);
router.get('/earnings', getEarnings);

export default router;
