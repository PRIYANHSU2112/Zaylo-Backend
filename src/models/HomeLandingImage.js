import mongoose from 'mongoose';

const homeLandingImageSchema = new mongoose.Schema(
  {
    slot: {
      type: String,
      enum: ['hero', 'festival', 'dealer', 'tile', 'other'],
      default: 'other',
      index: true,
    },
    url: { type: String, required: true },
    alt: { type: String, default: '' },
    link: { type: String, default: '/products' },
    position: { type: Number, default: 0, index: true },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true,
    },
  },
  { timestamps: true },
);

homeLandingImageSchema.index({ status: 1, position: 1 });
homeLandingImageSchema.index({ slot: 1, position: 1 });

export default mongoose.model('HomeLandingImage', homeLandingImageSchema);
