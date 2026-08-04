import mongoose from 'mongoose';

const promoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    cta: { type: String, default: 'Shop Now' },
    link: { type: String, default: '/products' },
    gradient: { type: String, default: 'from-emerald-500 to-teal-600' },
    badge: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    bgImageUrl: { type: String, default: '' },
    variant: {
      type: String,
      enum: ['default', 'dark'],
      default: 'default',
    },
    slot: {
      type: String,
      enum: ['general', 'home-festival', 'home-dealer'],
      default: 'general',
      index: true,
    },
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

promoSchema.index({ status: 1, position: 1 });

export default mongoose.model('Promo', promoSchema);
