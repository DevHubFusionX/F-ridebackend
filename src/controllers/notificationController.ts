import { type Request, type Response } from 'express';
import Notification from '../models/Notification.js';

const getUser = (req: any) => req.user as { id: string };

/**
 * @desc    Get user's notification stream (paginated).
 * @route   GET /api/notifications
 * @access  Private
 */
export const getNotifications = async (req: Request, res: Response) => {
  const user = getUser(req);
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  try {
    const [notifications, total] = await Promise.all([
      Notification.find({ recipient: user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ recipient: user.id })
    ]);

    res.json({
      data: notifications,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * @desc    Mark specific notifications as read.
 * @route   PUT /api/notifications/read
 * @access  Private
 */
export const markAsRead = async (req: Request, res: Response) => {
  const user = getUser(req);
  const { ids } = req.body; // Array of notification IDs or "all"

  try {
    const query = ids === 'all' 
      ? { recipient: user.id, isRead: false }
      : { _id: { $in: ids }, recipient: user.id };

    await Notification.updateMany(query, { isRead: true });

    res.json({ message: 'Notifications cleared.' });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to update notifications',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
