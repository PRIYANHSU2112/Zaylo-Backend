import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
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

announcementSchema.index({ status: 1, position: 1 });

export default mongoose.model('Announcement', announcementSchema);
