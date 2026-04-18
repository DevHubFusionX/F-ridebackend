import express from 'express';
import {
  getPackages,
  createPackage,
  updatePackageStatus,
  getPackageById,
} from '../controllers/packageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All package routes require authentication
router.use(protect);

router.get('/', getPackages);
router.post('/', createPackage);
router.get('/:id', getPackageById);
router.put('/:id/status', updatePackageStatus);

export default router;
