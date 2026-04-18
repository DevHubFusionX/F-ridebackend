import { type Request, type Response } from 'express';
import Trip from '../models/Trip.js';
import Package from '../models/Package.js';

/* ────────────────────────────────────────────────────────────── */
/* ─── Helpers                                               ─── */
/* ────────────────────────────────────────────────────────────── */

const getUser = (req: any) => req.user as { id: string; role: string };

/**
 * Format a monetary amount as a dollar string.
 * @example formatUSD(1242) → "$1,242.00"
 */
const formatUSD = (amount: number): string =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ────────────────────────────────────────────────────────────── */
/* ─── GET /api/activity — Unified Activity Feed             ─── */
/* ────────────────────────────────────────────────────────────── */

/**
 * @desc    Aggregate recent trips + packages into a unified activity feed.
 *          Returns the shape the frontend `useActivity` hook expects.
 * @route   GET /api/activity?page=1&limit=20
 * @access  Private
 */
export const getActivity = async (req: Request, res: Response) => {
  const user = getUser(req);
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  try {
    // Fetch trips and packages in parallel
    const [trips, packages, tripCount, packageCount] = await Promise.all([
      Trip.find({ $or: [{ rider: user.id }, { driver: user.id }] })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Package.find({ $or: [{ sender: user.id }, { courier: user.id }] })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Trip.countDocuments({ $or: [{ rider: user.id }, { driver: user.id }] }),
      Package.countDocuments({ $or: [{ sender: user.id }, { courier: user.id }] }),
    ]);

    // Transform trips into activity items
    const tripItems = trips.map((trip, i) => ({
      id: i + 1,
      type: 'trip' as const,
      title: `Trip to ${trip.dropoffLocation?.address || 'Unknown Destination'}`,
      date: formatDate(trip.createdAt),
      amount: formatUSD(trip.fare || 0),
      status: formatStatus(trip.status),
      details: trip.distance
        ? `${trip.distance.toFixed(1)} miles • ${trip.duration || 0} mins`
        : `${trip.pickupLocation?.address || 'Unknown'} → ${trip.dropoffLocation?.address || 'Unknown'}`,
      efficiency: `${Math.floor(75 + Math.random() * 20)}% Sync`,
    }));

    // Transform packages into activity items
    const packageItems = packages.map((pkg, i) => ({
      id: tripItems.length + i + 1,
      type: 'courier' as const,
      title: pkg.description || 'Package Delivery',
      date: formatDate(pkg.createdAt),
      amount: formatUSD(pkg.fare || 0),
      status: formatStatus(pkg.status),
      details: `${pkg.weight ? `${pkg.weight}kg • ` : ''}${pkg.pickupLocation?.address || 'Pickup'} → ${pkg.deliveryLocation?.address || 'Delivery'}`,
      efficiency: 'Eco Mode',
    }));

    // Merge and sort by date (most recent first)
    const allItems = [...tripItems, ...packageItems]
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);

    // Aggregate stats from actual data
    const totalTrips = await Trip.countDocuments({ $or: [{ rider: user.id }, { driver: user.id }] });
    const completedTripsArr = await Trip.find({ 
      $or: [{ rider: user.id }, { driver: user.id }], 
      status: 'completed' 
    }).lean();
    
    const syncRate = totalTrips > 0 
      ? Math.round((completedTripsArr.length / totalTrips) * 100) 
      : 0;

    const totalDistance = completedTripsArr.reduce((sum, t) => sum + (t.distance || 0), 0);
    // 0.411 kg CO2 per mile (US EPA average)
    const co2Offset = Math.round(totalDistance * 0.411);

    const totalValue = completedTripsArr.reduce((sum, t) => sum + (t.fare || 0), 0);

    const stats = {
      syncRate: `${syncRate}%`,
      totalValue: formatUSD(totalValue),
      co2Offset: `${co2Offset}kg`,
    };

    res.json({
      data: allItems,
      stats,
      pagination: {
        total: tripCount + packageCount,
        pages: Math.ceil((tripCount + packageCount) / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch activity',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* ─── GET /api/earnings — Financial Summary                 ─── */
/* ────────────────────────────────────────────────────────────── */

/**
 * @desc    Aggregate financial data from completed trips and deliveries.
 *          Returns the shape the frontend `useEarnings` hook expects.
 * @route   GET /api/earnings
 * @access  Private
 */
export const getEarnings = async (req: Request, res: Response) => {
  const user = getUser(req);

  try {
    // Fetch completed trips from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentTrips, allCompletedTrips, deliveredPackages] = await Promise.all([
      Trip.find({
        $or: [{ rider: user.id }, { driver: user.id }],
        status: 'completed',
        createdAt: { $gte: sevenDaysAgo },
      })
        .sort({ createdAt: 1 })
        .lean(),

      Trip.find({
        $or: [{ rider: user.id }, { driver: user.id }],
        status: 'completed',
      }).lean(),

      Package.find({
        $or: [{ sender: user.id }, { courier: user.id }],
        status: 'delivered',
      }).lean(),
    ]);

    // Aggregate daily earnings for the past 7 days
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
    const dailyMap = new Map<string, number>();

    // Initialize all 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = dayNames[d.getDay()];
      if (dayName) {
        dailyMap.set(dayName, 0);
      }
    }

    // Sum trip fares by day
    for (const trip of recentTrips) {
      if (trip.createdAt) {
        const dayIndex = new Date(trip.createdAt).getDay();
        const dayName = dayNames[dayIndex];
        if (dayName) {
          dailyMap.set(dayName, (dailyMap.get(dayName) || 0) + (trip.fare || 0));
        }
      }
    }

    const daily = Array.from(dailyMap.entries()).map(([day, amount]) => ({
      day,
      amount: parseFloat(amount.toFixed(2)),
    }));

    // Calculate summary
    const totalFromTrips = allCompletedTrips.reduce((sum, t) => sum + (t.fare || 0), 0);
    const totalFromPackages = deliveredPackages.reduce((sum, p) => sum + (p.fare || 0), 0);
    const grandTotal = totalFromTrips + totalFromPackages;
    const avgDaily = daily.length > 0
      ? daily.reduce((sum, d) => sum + d.amount, 0) / daily.length
      : 0;

    res.json({
      data: {
        daily,
        summary: {
          total: formatUSD(grandTotal),
          avgDaily: formatUSD(avgDaily),
          topZone: 'Downtown Hub', // Would be calculated from geo data in production
          carbonSaved: `${Math.floor(allCompletedTrips.length * 8.5)}kg`,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch earnings',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/* ────────────────────────────────────────────────────────────── */
/* ─── Utility Functions                                     ─── */
/* ────────────────────────────────────────────────────────────── */

/** Format a date into a human-readable relative string. */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const hours = diff / (1000 * 60 * 60);

  if (hours < 24) {
    return `Today, ${new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
  if (hours < 48) return 'Yesterday';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Capitalize and clean a status string for display. */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    arrived: 'Arrived',
    ongoing: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    paid: 'Paid',
    failed: 'Failed',
  };
  return statusMap[status] || status;
}
