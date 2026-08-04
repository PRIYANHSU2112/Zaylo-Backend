import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'Home', trim: true },
    address: { type: String, required: true, trim: true },
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
