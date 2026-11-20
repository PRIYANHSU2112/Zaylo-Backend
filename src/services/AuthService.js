import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import RefreshToken from '../models/RefreshToken.js';
import ApiError from '../utils/ApiError.js';
import { serialize } from '../utils/serialize.js';

const STAFF = ['Admin', 'Manager'];
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

function publicUser(user) {
  const u = serialize(user);
  delete u.cart;
  delete u.wishlist;
  return u;
}

class AuthService {
  /**
   * Staff (admin panel) keep the original long-lived bearer token — admin auth is unchanged.
   * Customers get a short-lived access token that is renewed via the refresh cookie.
   */
  signAccessToken(user) {
    const expiresIn = STAFF.includes(user.role) ? config.jwtExpiresIn : config.customerAccessTtl;
    return jwt.sign({ sub: user._id.toString(), role: user.role, email: user.email }, config.jwtSecret, {
      expiresIn,
    });
  }

  async issueRefreshToken(userId, family = crypto.randomUUID()) {
    const token = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + config.refreshTokenDays * 86400_000);
    await RefreshToken.create({ user: userId, tokenHash: hash(token), family, expiresAt });
    return { token, expiresAt };
  }

  async #session(user) {
    const refresh = await this.issueRefreshToken(user._id);
    return { accessToken: this.signAccessToken(user), user: publicUser(user), refresh };
  }

  async register({ name, email, phone, password }) {
    const settings = await Settings.findOne({ key: 'default' }).select('general').lean();
    if (settings?.general?.allowRegistrations === false) {
      throw ApiError.forbidden('New registrations are currently closed');
    }
    const normalized = email.toLowerCase().trim();
    if (await User.exists({ email: normalized })) throw ApiError.conflict('Email already registered');

    const user = await User.create({
      name: name.trim(),
      email: normalized,
      phone: phone || '',
      password,
      role: 'Customer',
      status: 'Active',
      dateJoined: new Date(),
    });
    return this.#session(user);
  }

  async login({ email, password, role }) {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    if (user.status === 'Suspended') throw ApiError.forbidden('Account is suspended');

    // Admin-panel login (role sent) — original rules preserved.
    if (role && STAFF.includes(role)) {
      if (!STAFF.includes(user.role)) throw ApiError.forbidden('Staff access only');
      if (user.role !== role && !(user.role === 'Admin' && role === 'Manager')) {
        throw ApiError.forbidden(`Not authorized as ${role}`);
      }
    }
    return this.#session(user);
  }

  /**
   * Rotate a refresh token. Re-use of an already-rotated token revokes the whole
   * family (token theft detection).
   */
  async refresh(rawToken) {
    if (!rawToken) throw ApiError.unauthorized('Session expired');
    const doc = await RefreshToken.findOne({ tokenHash: hash(rawToken) });
    if (!doc || doc.expiresAt < new Date()) throw ApiError.unauthorized('Session expired');
    if (doc.revokedAt) {
      await RefreshToken.updateMany({ family: doc.family }, { $set: { revokedAt: new Date() } });
      throw ApiError.unauthorized('Session expired');
    }
    const rotated = await RefreshToken.updateOne(
      { _id: doc._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    if (rotated.modifiedCount !== 1) throw ApiError.unauthorized('Session expired');

    const user = await User.findById(doc.user);
    if (!user || user.status === 'Suspended') throw ApiError.unauthorized('Account unavailable');

    const refresh = await this.issueRefreshToken(user._id, doc.family);
    return { accessToken: this.signAccessToken(user), user: publicUser(user), refresh };
  }

  async logout(rawToken) {
    if (!rawToken) return;
    const doc = await RefreshToken.findOne({ tokenHash: hash(rawToken) }).lean();
    if (doc) await RefreshToken.updateMany({ family: doc.family }, { $set: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId) {
    await RefreshToken.updateMany({ user: userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  }

  async me(userId) {
    const user = await User.findById(userId).lean();
    if (!user) throw ApiError.unauthorized('User not found');
    return publicUser(user);
  }

  async updateProfile(userId, { name, phone }) {
    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (phone !== undefined) update.phone = String(phone).trim();
    const user = await User.findByIdAndUpdate(userId, update, { new: true, runValidators: true }).lean();
    if (!user) throw ApiError.notFound('User not found');
    return publicUser(user);
  }
}

export default new AuthService();
