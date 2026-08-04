import mongoose from 'mongoose';

const dealerSchema = new mongoose.Schema(
  {
    dealerCode: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    businessName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    location: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    investment: { type: String, default: '' },
    interestedProducts: [{ type: String }],
    message: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

dealerSchema.index({ status: 1, createdAt: -1 });
dealerSchema.index({ email: 1 });

export default mongoose.model('Dealer', dealerSchema);
