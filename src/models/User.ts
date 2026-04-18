import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  phone?: string;
  email?: string;
  name?: string;
  password?: string;
  role: 'rider' | 'driver' | 'courier';
  isVerified: boolean;
  twoFactorEnabled: boolean;
  otp?: string;
  otpExpires?: Date;
  profileImage?: string;
  rating: number;
  tripsCount: number;
  joinedDate: Date;
  bio?: string;
  languages: string[];
  vehicle?: {
    model: string;
    color: string;
    plate: string;
  };
  location?: {
    type: string;
    coordinates: number[];
  };
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  phone: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  name: { type: String },
  password: { type: String, select: false },
  role: { 
    type: String, 
    enum: ['rider', 'driver', 'courier'], 
    default: 'rider' 
  },
  isVerified: { type: Boolean, default: false },
  twoFactorEnabled: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },
  profileImage: { type: String },
  rating: { type: Number, default: 5.0 },
  tripsCount: { type: Number, default: 0 },
  joinedDate: { type: Date, default: Date.now },
  bio: { type: String },
  languages: { type: [String], default: ['English'] },
  vehicle: {
    model: { type: String },
    color: { type: String },
    plate: { type: String },
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre<IUser>('save', async function () {
  if (!this.isModified('password')) return;
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password!, salt);
  } catch (error) {
    throw error;
  }
});

// Password verification method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for geo-spatial queries (useful for ride-matching)
UserSchema.index({ location: '2dsphere' });
UserSchema.index({ otp: 1, otpExpires: 1 });

export default mongoose.model<IUser>('User', UserSchema);
