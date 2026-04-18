import mongoose, { Schema, Document } from 'mongoose';

export interface ITrip extends Document {
  rider: mongoose.Types.ObjectId;
  driver?: mongoose.Types.ObjectId;
  pickupLocation: {
    address: string;
    coordinates: number[];
  };
  dropoffLocation: {
    address: string;
    coordinates: number[];
  };
  status: 'pending' | 'accepted' | 'arrived' | 'ongoing' | 'completed' | 'cancelled';
  fare: number;
  paymentStatus: 'pending' | 'paid' | 'failed';
  pin: string;
  startTime?: Date;
  endTime?: Date;
  distance?: number;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TripSchema: Schema = new Schema({
  rider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  driver: { type: Schema.Types.ObjectId, ref: 'User' },
  pickupLocation: {
    address: { type: String, required: true },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  dropoffLocation: {
    address: { type: String, required: true },
    coordinates: { type: [Number], required: true }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'arrived', 'ongoing', 'completed', 'cancelled'],
    default: 'pending'
  },
  fare: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  pin: { type: String, required: true }, // 4-digit PIN for verification
  startTime: { type: Date },
  endTime: { type: Date },
  distance: { type: Number },
  duration: { type: Number }
}, {
  timestamps: true
});

TripSchema.index({ 'pickupLocation.coordinates': '2dsphere' });
TripSchema.index({ rider: 1, createdAt: -1 });
TripSchema.index({ driver: 1, status: 1, createdAt: -1 });
TripSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<ITrip>('Trip', TripSchema);
