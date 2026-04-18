import { type Request, type Response } from 'express';
import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { sendEmail } from '../services/emailService.js';

// @desc    Register a new user (pre-OTP)
// @route   POST /api/auth/register
// @access  Public
export const register = async (req: Request, res: Response) => {
  const { name, email, phone, role, password } = req.body;

  if (!name || (!email && !phone) || !password) {
    return res.status(400).json({ message: 'Please provide name, contact, and password' });
  }

  const contactFilter = phone ? { phone } : { email };

  try {
    let user = await User.findOne(contactFilter);
    
    if (user && user.isVerified) {
      return res.status(400).json({ message: 'User with this contact already exists. Please login.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    if (user) {
      // User exists but is unverified: update their info and OTP
      user.name = name;
      user.password = password; // This will trigger the pre-save hash hook
      user.role = role || user.role;
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      // New user
      user = new User({
        name,
        email,
        phone,
        role: role || 'rider',
        password,
        otp,
        otpExpires,
        isVerified: false,
      });
      await user.save();
    }

    // Send OTP if email is provided
    if (email) {
      try {
        await sendEmail(email, 'otp', { otp });
        // Send waitlist email for non-riders (re-trigger if they just joined)
        if (role === 'driver' || role === 'courier') {
          await sendEmail(email, 'waitlist', { name });
        }
      } catch (err) {
        console.error('Email sending failed in register:', err);
      }
    }

    res.status(user.isNew ? 201 : 200).json({ 
      message: user.isNew ? 'Registration initiated. OTP sent.' : 'OTP resent. Please verify your account.',
      debug_otp: process.env.NODE_ENV === 'development' ? otp : undefined 
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      stack: error.stack 
    });
  }
};

// @desc    Login Step 1: Verify Password and handle conditional 2FA
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response) => {
  const { email, phone, password } = req.body;
  const contactFilter = phone ? { phone } : { email };

  if ((!email && !phone) || !password) {
    return res.status(400).json({ message: 'Please provide contact and password' });
  }

  try {
    const user = await User.findOne(contactFilter).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if 2FA is required
    if (user.twoFactorEnabled) {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();

      // Send OTP
      if (user.email) {
        try {
          await sendEmail(user.email, 'otp', { otp });
        } catch (err) {
          console.error('Email sending failed in login:', err);
        }
      }

      return res.status(200).json({ 
        message: 'Password verified. 2FA OTP sent.',
        requires2FA: true,
        debug_otp: process.env.NODE_ENV === 'development' ? otp : undefined 
      });
    }

    // Direct Login (2FA Disabled)
    // Trigger Security Alert email on successful login
    if (user.email) {
      sendEmail(user.email, 'security_alert', { 
        name: user.name || 'User',
        time: new Date().toLocaleString(),
        device: req.headers['user-agent'] || 'Unknown Device'
      }).catch(err => console.error('Security alert email failed', err));
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: generateToken({ id: user._id.toString(), role: user.role }),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
};

// @desc    Toggle Two-Factor Authentication
// @route   POST /api/auth/toggle-2fa
// @access  Private
export const toggle2FA = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.twoFactorEnabled = !user.twoFactorEnabled;
    await user.save();

    res.status(200).json({ 
      message: `Two-factor authentication ${user.twoFactorEnabled ? 'enabled' : 'disabled'} successfully.`,
      twoFactorEnabled: user.twoFactorEnabled 
    });
  } catch (error) {
    console.error('Toggle 2FA error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const perfAuthStore = new Map<string, { otp: string; expiresAt: number; role: 'rider' | 'driver' | 'courier' }>();

// (RequestOTP is now superseded by Register/Login flows, but kept for backward compat if needed)
export const requestOTP = async (req: Request, res: Response) => {
  res.status(410).json({ message: 'This endpoint is deprecated. Use /api/auth/login or /api/auth/register' });
};

// @desc    Join early access waitlist
// @route   POST /api/auth/waitlist
// @access  Public
export const joinWaitlist = async (req: Request, res: Response) => {
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ message: 'Please provide email and role' });
  }

  try {
    await sendEmail(email, 'waitlist', {
      email,
      role,
      isDriver: role === 'driver',
      learnMoreUrl: 'https://frankride.com',
    });

    res.status(200).json({ message: 'Successfully joined the waitlist' });
  } catch (error) {
    console.error('Waitlist error:', error);
    res.status(500).json({ message: 'Failed to join waitlist' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req: Request, res: Response) => {
  const { phone, email, otp } = req.body;
  const contactFilter = phone ? { phone } : { email };

  if ((!phone && !email) || !otp) {
    return res.status(400).json({ message: 'Please provide contact and OTP' });
  }

  const contact = phone || email;
  if (process.env.PERF_USE_INMEMORY_AUTH === 'true' && contact) {
    const record = perfAuthStore.get(contact);
    if (!record || record.otp !== otp || record.expiresAt <= Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    perfAuthStore.delete(contact);
    return res.status(200).json({
      _id: 'perf-user',
      name: 'Perf User',
      email: email || undefined,
      phone: phone || undefined,
      role: record.role,
      token: generateToken({ id: 'perf-user', role: record.role }),
    });
  }

  try {
    const user = await User.findOneAndUpdate(
      {
        ...contactFilter,
        otp,
        otpExpires: { $gt: new Date() },
      },
      {
        $set: { isVerified: true },
        $unset: { otp: '', otpExpires: '' },
      },
      {
        new: true,
        projection: {
          _id: 1,
          name: 1,
          email: 1,
          phone: 1,
          role: 1,
        },
      }
    ).lean();

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Trigger Security Alert email on successful login
    if (user.email) {
      sendEmail(user.email, 'security_alert', { 
        name: user.name || 'User',
        time: new Date().toLocaleString(),
        device: req.headers['user-agent'] || 'Unknown Device'
      }).catch(err => console.error('Security alert email failed', err));
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: generateToken({ id: user._id.toString(), role: user.role }),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id).select('-otp -otpExpires').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/me
// @access  Private
export const updateProfile = async (req: any, res: Response) => {
  // Whitelist of allowed update fields
  const allowedFields = ['name', 'bio', 'profileImage', 'languages', 'vehicle', 'role', 'isVerified'] as const;

  try {
    const updates: Record<string, unknown> = {};
    let identityChanged = false;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // If changing email/phone, we might want to flag for re-verification
        if (((field as string) === 'email' || (field as string) === 'phone') && req.body[field] !== req.user[field]) {
           identityChanged = true;
        }
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const currentUser = await User.findById(req.user.id).lean();
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If identity changed, set isVerified to false
    if (identityChanged) {
      updates.isVerified = false;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select('-otp -otpExpires')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Email Trigger Logic
    if (user.email) {
      // 1. Welcome Email (triggered when name is first set)
      if (!currentUser.name && user.name) {
        sendEmail(user.email, 'welcome', { name: user.name }).catch(err => console.error('Welcome email failed', err));
      }

      // 2. Review Pending (triggered when a driver/courier adds vehicle info)
      if (user.role !== 'rider' && !currentUser.vehicle?.plate && user.vehicle?.plate) {
        sendEmail(user.email, 'review_pending', { name: user.name || 'Partner' }).catch(err => console.error('Review pending email failed', err));
      }

      // 3. Approved (triggered when isVerified goes from false -> true)
      if (!currentUser.isVerified && user.isVerified) {
        sendEmail(user.email, 'approved', { name: user.name || 'Partner' }).catch(err => console.error('Approved email failed', err));
      }
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// @desc    Change user password
// @route   POST /api/auth/change-password
// @access  Private
export const changePassword = async (req: any, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Please provide current and new password' });
  }

  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully. Please log in again.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Request Password Reset OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response) => {
  const { email, phone } = req.body;
  const contactFilter = phone ? { phone } : { email };

  if (!email && !phone) {
    return res.status(400).json({ message: 'Please provide contact info' });
  }

  try {
    const user = await User.findOne(contactFilter);
    if (!user) {
       return res.status(404).json({ message: 'No account found with this synchronization handle.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Send Reset OTP
    if (user.email) {
      try {
        await sendEmail(user.email, 'otp', { otp });
      } catch (err) {
        console.error('Email sending failed in forgotPassword:', err);
      }
    }

    res.status(200).json({ 
      message: 'Reset OTP sent.',
      debug_otp: process.env.NODE_ENV === 'development' ? otp : undefined 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reset Password using OTP
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req: Request, res: Response) => {
  const { email, phone, otp, newPassword } = req.body;
  const contactFilter = phone ? { phone } : { email };

  if ((!email && !phone) || !otp || !newPassword) {
    return res.status(400).json({ message: 'Please provide contact, OTP, and new password' });
  }

  try {
    // 1. Find user with valid OTP
    const user = await User.findOne({
      ...contactFilter,
      otp,
      otpExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // 2. Update password and clear OTP
    user.password = newPassword;
    user.otp = undefined as any;
    user.otpExpires = undefined as any;
    await user.save();

    res.status(200).json({ message: 'Password reset successfully. Please log in with your new credentials.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
