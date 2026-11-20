import mongoose from 'mongoose';

const nutritionSchema = new mongoose.Schema(
  {
    calories: { type: Number, default: 0 },
    fat: { type: String, default: '' },
    carbs: { type: String, default: '' },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    // Optional for drafts; required before publishing (enforced in CatalogService)
    category: { type: String, default: '', trim: true, index: true },
    sku: { type: String, trim: true, uppercase: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    weight: { type: String, default: '' },
    image: { type: String, default: '' }, // primary image
    images: { type: [String], default: [] }, // gallery (includes primary first)
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    // Only set from real review data — never fabricated (0 = no rating shown)
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    isVeg: { type: Boolean, default: true },
    isNew: { type: Boolean, default: false },
    isPopular: { type: Boolean, default: false, index: true }, // 'Show on homepage'
    isFeatured: { type: Boolean, default: false, index: true },
    seoTitle: { type: String, default: '', trim: true },
    seoDescription: { type: String, default: '', trim: true },
    homePosition: { type: Number, default: 0 },
    flavor: { type: String, default: '' },
    nutrition: { type: nutritionSchema, default: () => ({}) },
    ingredients: [{ type: String }],
    storage: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true,
    },
    stock: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, suppressReservedKeysWarning: true },
);

productSchema.index({ status: 1, category: 1, createdAt: -1 });
productSchema.index({ status: 1, isPopular: 1, homePosition: 1 });
productSchema.index({ name: 'text', tagline: 'text', flavor: 'text' });
productSchema.index({ stock: 1 });
productSchema.index({ sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: 'string', $gt: '' } } });

export default mongoose.model('Product', productSchema);
