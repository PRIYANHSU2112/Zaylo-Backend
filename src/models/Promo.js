import mongoose from 'mongoose';
import { BANNER_PLACEMENTS, LEGACY_SLOTS } from '../utils/banners.js';

const promoSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' }, // optional: image-only banners
    subtitle: { type: String, default: '' },
    cta: { type: String, default: 'Shop Now' },
    link: { type: String, default: '/products' },
    gradient: { type: String, default: '' },
    badge: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    bgImageUrl: { type: String, default: '' },
    mobileImageUrl: { type: String, default: '' }, // shown below 768px
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    variant: {
      type: String,
      enum: ['default', 'dark'],
      default: 'default',
    },
    slot: {
      type: String,
      enum: [...BANNER_PLACEMENTS, ...LEGACY_SLOTS],
      default: 'hero',
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
promoSchema.index({ slot: 1, status: 1, position: 1 });

export default mongoose.model('Promo', promoSchema);
