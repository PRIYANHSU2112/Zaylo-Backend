import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'Home', trim: true },
    // Formatted one-line address (legacy records only have this field)
    address: { type: String, required: true, trim: true },
    name: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    line1: { type: String, default: '', trim: true },
    line2: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    pincode: { type: String, default: '', trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, default: '', trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['Customer', 'Distributor', 'Manager', 'Admin'],
      default: 'Customer',
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Suspended'],
      default: 'Active',
      index: true,
    },
    addresses: [addressSchema],
    // Server-side cart / wishlist (prices are always resolved from Product at read time)
    cart: [
      {
        _id: false,
        // Exactly one of product / bundle (enforced by AccountService + Joi)
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        bundle: { type: mongoose.Schema.Types.ObjectId, ref: 'Bundle' },
        quantity: { type: Number, required: true, min: 1, max: 99 },
      },
    ],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    dateJoined: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, status: 1, createdAt: -1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    status: this.status,
    dateJoined: this.dateJoined,
    addresses: this.addresses,
  };
};

export default mongoose.model('User', userSchema);
