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
router.get('/active', async (req: any, res) => {
  const user = req.user as { id: string; role: string };
  try {
    const Trip = (await import('../models/Trip.js')).default;
    const trip = await Trip.findOne({
      $or: [{ rider: user.id }, { driver: user.id }],
      status: { $in: ['pending', 'accepted', 'ongoing'] },
    })
      .sort({ createdAt: -1 })
      .populate('rider', 'name email phone profileImage rating')
      .populate('driver', 'name email phone profileImage rating vehicle')
      .lean();
    res.json({ trip: trip || null });
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch active trip' });
  }
});
router.get('/history', getTripHistory);
router.get('/:id', getTripById);

export default router;
