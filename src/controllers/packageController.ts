import { type Request, type Response } from 'express';
import Package from '../models/Package.js';
import User from '../models/User.js';
import { sendEmail } from '../services/emailService.js';

/* ────────────────────────────────────────────────────────────── */
/* ─── Helpers                                               ─── */
/* ────────────────────────────────────────────────────────────── */

const getUser = (req: any) => req.user as { id: string; role: string };

/* ────────────────────────────────────────────────────────────── */
/* ─── GET /api/packages — List User's Packages              ─── */
/* ────────────────────────────────────────────────────────────── */

/**
 * @desc    List packages for the current user.
 *          Senders see packages they created. Couriers see packages assigned to them.
 * @route   GET /api/packages?status=pending&page=1&limit=20
 * @access  Private
 */
export const getPackages = async (req: Request, res: Response) => {
  const user = getUser(req);
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {
    $or: [{ sender: user.id }, { courier: user.id }],
  };

  // Optional status filter
  const status = req.query.status as string;
  if (status) {
    query.status = status;
  }

  try {
    const [packages, total] = await Promise.all([
      Package.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'name profileImage')
        .populate('courier', 'name profileImage')
        .lean(),

      Package.countDocuments(query),
    ]);

    res.json({
      data: packages,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch packages',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* ─── POST /api/packages — Create Package Delivery Request  ─── */
/* ────────────────────────────────────────────────────────────── */

/**
 * @desc    Create a new package delivery request
 * @route   POST /api/packages
 * @access  Private
 */
export const createPackage = async (req: Request, res: Response) => {
  const user = getUser(req);
  const { receiverName, receiverPhone, pickup, delivery, weight, description, fare } = req.body;

  if (!receiverName || !receiverPhone || !pickup?.address || !delivery?.address) {
    return res.status(400).json({
      message: 'Receiver name, phone, pickup, and delivery locations are required',
    });
  }

  try {
    const pkg = await Package.create({
      sender: user.id,
      receiverName,
      receiverPhone,
      pickupLocation: pickup,
      deliveryLocation: delivery,
      weight,
      description,
      fare: fare || 0,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Package delivery request created',
      package: pkg,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to create package',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* ─── PUT /api/packages/:id/status — Update Package Status  ─── */
/* ────────────────────────────────────────────────────────────── */

/**
 * @desc    Update a package's delivery status.
 *          Couriers can accept, pick up, deliver, or cancel.
 * @route   PUT /api/packages/:id/status
 * @access  Private
 */
export const updatePackageStatus = async (req: Request, res: Response) => {
  const user = getUser(req);
  const { status } = req.body;
  const validStatuses = ['picked_up', 'in_transit', 'delivered', 'cancelled'] as const;

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      message: `Status must be one of: ${validStatuses.join(', ')}`,
    });
  }

  try {
    const pkg = await Package.findById(req.params.id);

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Authorization: only the sender or assigned courier can update
    const isSender = pkg.sender.toString() === user.id;
    const isCourier = pkg.courier?.toString() === user.id;

    if (!isSender && !isCourier) {
      return res.status(403).json({ message: 'Not authorized to update this package' });
    }

    // Assign courier if a courier is accepting the package
    if (status === 'picked_up' && !pkg.courier) {
      pkg.courier = user.id as any;
    }

    pkg.status = status;
    await pkg.save();

    // Trigger Receipt email on delivery
    if (status === 'delivered') {
      const sender = await User.findById(pkg.sender).lean();
      if (sender?.email) {
        sendEmail(sender.email, 'receipt', {
          name: sender.name || 'User',
          date: new Date().toLocaleDateString(),
          amount: pkg.fare.toFixed(2),
          pickup: pkg.pickupLocation.address,
          dropoff: pkg.deliveryLocation.address,
          tripId: pkg._id.toString().slice(-6).toUpperCase()
        }).catch(err => console.error('Delivery receipt email failed', err));
      }
    }

    res.json({
      success: true,
      message: `Package status updated to ${status}`,
      package: pkg,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to update package status',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* ─── GET /api/packages/:id — Get Package Details           ─── */
/* ────────────────────────────────────────────────────────────── */

/**
 * @desc    Fetch a single package by ID
 * @route   GET /api/packages/:id
 * @access  Private
 */
export const getPackageById = async (req: Request, res: Response) => {
  try {
    const pkg = await Package.findById(req.params.id)
      .populate('sender', 'name email phone profileImage')
      .populate('courier', 'name email phone profileImage')
      .lean();

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json(pkg);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch package',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
