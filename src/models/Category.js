import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    comingSoon: { type: Boolean, default: false },
    color: { type: String, default: 'from-emerald-400 to-teal-500' },
    image: { type: String, default: '' },
    homePosition: { type: Number, default: 0, index: true },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true,
    },
  },
  { timestamps: true },
);

categorySchema.index({ status: 1, name: 1 });
categorySchema.index({ status: 1, homePosition: 1 });

export default mongoose.model('Category', categorySchema);
