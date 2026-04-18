import mongoose, { Schema, Document } from 'mongoose';

export interface IPackage extends Document {
  sender: mongoose.Types.ObjectId;
  courier?: mongoose.Types.ObjectId;
  receiverName: string;
  receiverPhone: string;
  pickupLocation: {
    address: string;
    coordinates: number[];
  };
  deliveryLocation: {
    address: string;
    coordinates: number[];
  };
  status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  weight?: number;
  description?: string;
  fare: number;
  createdAt: Date;
  updatedAt: Date;
}

const PackageSchema: Schema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courier: { type: Schema.Types.ObjectId, ref: 'User' },
  receiverName: { type: String, required: true },
  receiverPhone: { type: String, required: true },
  pickupLocation: {
    address: { type: String, required: true },
    coordinates: { type: [Number], required: true }
  },
  deliveryLocation: {
    address: { type: String, required: true },
    coordinates: { type: [Number], required: true }
  },
  status: {
    type: String,
    enum: ['pending', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
  },
  weight: { type: Number },
  description: { type: String },
  fare: { type: Number, required: true }
}, {
  timestamps: true
});

PackageSchema.index({ 'pickupLocation.coordinates': '2dsphere' });
PackageSchema.index({ sender: 1, createdAt: -1 });
PackageSchema.index({ courier: 1, status: 1, createdAt: -1 });
PackageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IPackage>('Package', PackageSchema);
