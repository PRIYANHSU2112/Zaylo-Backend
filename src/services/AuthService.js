import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { serialize } from '../utils/serialize.js';

class AuthService {
  signAccessToken(user) {
    return jwt.sign(
      { sub: user._id.toString(), role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn },
    );
  }

  async register({ name, email, phone, password }) {
    const normalized = email.toLowerCase().trim();
    const exists = await User.findOne({ email: normalized }).lean();
    if (exists) {
      throw ApiError.conflict('Email already registered');
    }

    const user = await User.create({
      name: name.trim(),
      email: normalized,
      phone: phone || '',
      password,
      role: 'Customer',
      status: 'Active',
      dateJoined: new Date(),
    });

    const accessToken = this.signAccessToken(user);
    return {
      accessToken,
      user: serialize(user),
    };
  }

  async login({ email, password, role }) {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.status === 'Suspended') {
      throw ApiError.forbidden('Account is suspended');
    }

    if (role && ['Admin', 'Manager'].includes(role) && user.role !== role) {
      if (!(user.role === 'Admin' && role === 'Manager') && user.role !== role) {
        throw ApiError.forbidden(`Not authorized as ${role}`);
      }
    }

    if (['Admin', 'Manager'].includes(role || '') && !['Admin', 'Manager'].includes(user.role)) {
      throw ApiError.forbidden('Staff access only');
    }

    const accessToken = this.signAccessToken(user);
    return {
      accessToken,
      user: serialize(user),
    };
  }

  async me(userId) {
    const user = await User.findById(userId).lean();
    if (!user) throw ApiError.unauthorized('User not found');
    return serialize(user);
  }

  async updateProfile(userId, { name, phone }) {
    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (phone !== undefined) update.phone = String(phone).trim();

    const user = await User.findByIdAndUpdate(userId, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!user) throw ApiError.notFound('User not found');
    return serialize(user);
  }
}

export default new AuthService();
