import { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import Trip from '../models/Trip.js';
import User from '../models/User.js';
import { sendEmail } from '../services/emailService.js';

/* ────────────────────────────────────────────────────────────── */
/* ─── Helpers                                               ─── */
/* ────────────────────────────────────────────────────────────── */

/** Generate a random 4-digit PIN for trip verification. */
const generatePin = (): string =>
  Math.floor(1000 + Math.random() * 9000).toString();

/** Extract the requesting user from the `protect` middleware. */
const getUser = (req: any) => req.user as { id: string; role: string };

/* ────────────────────────────────────────────────────────────── */
/* ─── GET /api/trips — Search For Matches                   ─── */
/* ────────────────────────────────────────────────────────────── */

/**
 * @desc    Find nearby matching partners for ride-sharing.
 *          For riders → returns available drivers.
 *          For drivers → returns pending rider requests.
 * @route   GET /api/trips?role=rider&lat=9.08&lng=7.53
 * @access  Private
 */
export const getMatches = async (req: Request, res: Response) => {
  const { role, lat, lng } = req.query;
  const user = getUser(req);

  try {
    // Determine which role we're looking for (opposite of the requester)
    const targetRole = role === 'driver' ? 'rider' : 'driver';

    // Base query: verified users of the opposite role
    const query: Record<string, unknown> = {
      role: targetRole,
      isVerified: true,
      _id: { $ne: user.id },
    };

    // If coordinates provided, use geo-spatial query (within 10km)
    if (lat && lng) {
      query['location'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng as string), parseFloat(lat as string)],
          },
          $maxDistance: 10_000, // 10 km
        },
      };
    }

    const matches = await User.find(query)
      .select('name email phone role rating tripsCount profileImage bio languages vehicle location')
      .limit(20)
      .lean();

    // Transform to the shape the frontend PartnerSchema expects
    const partners = matches.map((match) => {
      const name = match.name || 'Anonymous User';
      const initials = name
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      return {
        _id: match._id.toString(),
        name,
        initials,
        distance: match.location?.coordinates
          ? `${(Math.random() * 3 + 0.3).toFixed(1)}km away`
          : 'Nearby',
        overlap: `${Math.floor(75 + Math.random() * 20)}% route overlap`,
        pickup: 'Calculating...',
        dropoff: 'Calculating...',
        color: ['#2D9CDB', '#E76F32', '#27AE60', '#8B5CF6'][Math.floor(Math.random() * 4)],
        rating: match.rating ?? 5.0,
        price: `₦${(800 + Math.random() * 1500).toFixed(0)}`,
        bio: match.bio,
        role: match.role,
        verified: true,
        trips: match.tripsCount ?? 0,
        joinedDate: match.joinedDate
          ? new Date(match.joinedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : undefined,
        languages: match.languages,
        vehicle: match.vehicle,
      };
    });

    res.json({ data: partners });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch matches',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* ─── POST /api/trips — Create Trip or Execute Action       ─── */
/* ────────────────────────────────────────────────────────────── */

/**
 * @desc    Handles all trip lifecycle transitions via an `action` field.
 *          Actions: create, book_driver, accept_rider, handshake_complete,
 *                   trip_complete, trip_cancel
 * @route   POST /api/trips
 * @access  Private
 */
export const tripAction = async (req: Request, res: Response) => {
  const { action, role, id, pickup, dropoff, fare } = req.body;
  const user = getUser(req);

  try {
    switch (action) {
      /* ── Create a new trip request ── */
      case 'create': {
        if (!pickup?.address || !pickup?.coordinates || !dropoff?.address || !dropoff?.coordinates) {
          return res.status(400).json({ message: 'Pickup and dropoff locations are required' });
        }

        const trip = await Trip.create({
          rider: user.id,
          pickupLocation: pickup,
          dropoffLocation: dropoff,
          fare: fare || 0,
          pin: generatePin(),
          status: 'pending',
        });

        return res.status(201).json({
          success: true,
          message: 'Trip request created',
          trip,
        });
      }

      /* ── Rider books a specific driver ── */
      case 'book_driver': {
        // Find the rider's most recent pending trip
        const trip = await Trip.findOneAndUpdate(
          { rider: user.id, status: 'pending' },
          { $set: { status: 'accepted' } },
          { new: true, sort: { createdAt: -1 } }
        );

        return res.json({
          success: true,
          message: `Driver ${id || 'partner'} booked`,
          trip,
        });
      }

      /* ── Driver accepts a rider's request ── */
      case 'accept_rider': {
        const trip = await Trip.findOneAndUpdate(
          { status: 'pending' },
          { $set: { driver: user.id, status: 'accepted' } },
          { new: true, sort: { createdAt: -1 } }
        );

        return res.json({
          success: true,
          message: `Rider ${id || 'partner'} accepted`,
          trip,
        });
      }

      /* ── Both parties confirm the handshake (trip starts) ── */
      case 'handshake_complete': {
        const statusField = role === 'driver' ? 'driver' : 'rider';
        const trip = await Trip.findOneAndUpdate(
          { [statusField]: user.id, status: 'accepted' },
          { $set: { status: 'ongoing', startTime: new Date() } },
          { new: true, sort: { createdAt: -1 } }
        );

        return res.json({
          success: true,
          message: 'Handshake confirmed — trip started',
          trip,
        });
      }

      /* ── Mark trip as completed ── */
      case 'trip_complete': {
        const statusField = role === 'driver' ? 'driver' : 'rider';
        const trip = await Trip.findOneAndUpdate(
          { [statusField]: user.id, status: 'ongoing' },
          {
            $set: {
              status: 'completed',
              endTime: new Date(),
              paymentStatus: 'paid',
            },
          },
          { new: true, sort: { createdAt: -1 } }
        );

        // Increment trip count for both parties and Send Receipt
        if (trip) {
          const userIds = [trip.rider, trip.driver].filter((id): id is mongoose.Types.ObjectId => Boolean(id));
          await User.updateMany(
            { _id: { $in: userIds } },
            { $inc: { tripsCount: 1 } }
          );

          // Get rider details for the receipt
          const rider = await User.findById(trip.rider).lean();
          if (rider?.email) {
            sendEmail(rider.email, 'receipt', {
              name: rider.name || 'Rider',
              date: new Date(trip.endTime || Date.now()).toLocaleDateString(),
              amount: trip.fare.toFixed(2),
              pickup: trip.pickupLocation.address,
              dropoff: trip.dropoffLocation.address,
              tripId: trip._id.toString().slice(-6).toUpperCase()
            }).catch(err => console.error('Receipt email failed', err));
          }
        }

        return res.json({
          success: true,
          message: 'Trip completed',
          trip,
        });
      }

      /* ── Cancel a trip ── */
      case 'trip_cancel': {
        const trip = await Trip.findOneAndUpdate(
          {
            $or: [{ rider: user.id }, { driver: user.id }],
            status: { $in: ['pending', 'accepted', 'arrived', 'ongoing'] },
          },
          { $set: { status: 'cancelled' } },
          { new: true, sort: { createdAt: -1 } }
        );

        return res.json({
          success: true,
          message: 'Trip cancelled',
          trip,
        });
      }

      default:
        return res.status(400).json({ message: `Unknown action: ${action}` });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Trip action failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* ─── GET /api/trips/:id — Get Trip Details                 ─── */
/* ────────────────────────────────────────────────────────────── */

/**
 * @desc    Fetch a single trip by ID
 * @route   GET /api/trips/:id
 * @access  Private
 */
export const getTripById = async (req: Request, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('rider', 'name email phone profileImage rating')
      .populate('driver', 'name email phone profileImage rating vehicle')
      .lean();

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    res.json(trip);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch trip',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* ─── GET /api/trips/history — User Trip History            ─── */
/* ────────────────────────────────────────────────────────────── */

/**
 * @desc    Get the requesting user's trip history (most recent first).
 * @route   GET /api/trips/history?page=1&limit=20
 * @access  Private
 */
export const getTripHistory = async (req: Request, res: Response) => {
  const user = getUser(req);
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  try {
    const [trips, total] = await Promise.all([
      Trip.find({
        $or: [{ rider: user.id }, { driver: user.id }],
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('rider', 'name profileImage')
        .populate('driver', 'name profileImage')
        .lean(),

      Trip.countDocuments({
        $or: [{ rider: user.id }, { driver: user.id }],
      }),
    ]);

    res.json({
      data: trips,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch trip history',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
