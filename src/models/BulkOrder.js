import mongoose from 'mongoose';

const bulkOrderSchema = new mongoose.Schema(
  {
    bulkCode: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    organization: { type: String, default: '' },
    companyName: { type: String, default: '' },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    quantity: { type: String, default: '' },
    eventDate: { type: String, default: '' },
    inquiryType: {
      type: String,
      enum: ['corporate', 'wholesale', 'export', 'events', ''],
      default: '',
    },
    estimatedOrderValue: {
      type: String,
      enum: ['10k-50k', '50k-1L', '1L+', ''],
      default: '',
    },
    message: { type: String, default: '' },
    details: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Pending', 'Contacted', 'Completed', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

bulkOrderSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('BulkOrder', bulkOrderSchema);
