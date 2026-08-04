import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, default: '' },
    category: {
      type: String,
      enum: ['Manufacturing', 'Recipes', 'Company News', 'Lifestyle', 'Products', 'Culture'],
      default: 'Company News',
      index: true,
    },
    date: { type: String, default: '' },
    readTime: { type: String, default: '4 min read' },
    image: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Published', 'Draft'],
      default: 'Draft',
      index: true,
    },
  },
  { timestamps: true },
);

blogSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Blog', blogSchema);
