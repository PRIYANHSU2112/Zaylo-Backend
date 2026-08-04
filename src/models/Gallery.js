import mongoose from 'mongoose';

const gallerySchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Products', 'Factory', 'Events'],
      default: 'Products',
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model('Gallery', gallerySchema);
