import express from 'express';
import {
  getMatches,
  tripAction,
  getTripById,
  getTripHistory,
} from '../controllers/tripController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All trip routes require authentication
router.use(protect);

// Match search + lifecycle
router.get('/', getMatches);
router.post('/', tripAction);

// History must come before :id to avoid route collisions
router.get('/history', getTripHistory);
router.get('/:id', getTripById);

export default router;
