import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    contactCode: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '', trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['New', 'Read', 'Replied'],
      default: 'New',
      index: true,
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

contactSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Contact', contactSchema);
