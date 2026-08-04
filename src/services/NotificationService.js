import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import { parseListQuery, buildMeta } from '../utils/pagination.js';
import { serialize, serializeMany } from '../utils/serialize.js';
import logger from '../utils/logger.js';

class NotificationService {
  async create(payload) {
    const doc = await Notification.create({
      type: payload.type || 'system',
      title: payload.title,
      message: payload.message,
      link: payload.link || '/',
      entityId: payload.entityId || '',
      meta: payload.meta || {},
      audience: 'staff',
    });
    return serialize(doc);
  }

  /** Non-blocking notify — never throws to callers */
  notify(payload) {
    this.create(payload).catch((err) => {
      logger.warn({ err: err?.message }, 'notification create failed');
    });
  }

  async listForUser(userId, query = {}) {
    const { page, limit, skip, sort } = parseListQuery(query);
    const uid = new mongoose.Types.ObjectId(userId);
    const filter = { audience: 'staff' };

    const unreadFilter = {
      audience: 'staff',
      readBy: { $not: { $elemMatch: { user: uid } } },
    };

    if (query.unreadOnly === 'true' || query.unreadOnly === true) {
      Object.assign(filter, {
        readBy: { $not: { $elemMatch: { user: uid } } },
      });
    }

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments(unreadFilter),
    ]);

    const data = serializeMany(items).map((n) => ({
      ...n,
      isRead: Array.isArray(n.readBy)
        ? n.readBy.some((r) => String(r.user) === String(userId))
        : false,
    }));

    return {
      data,
      meta: { ...buildMeta({ page, limit, total }), unreadCount },
    };
  }

  async markRead(id, userId) {
    const doc = await Notification.findById(id);
    if (!doc) throw ApiError.notFound('Notification not found');
    const already = doc.readBy.some((r) => String(r.user) === String(userId));
    if (!already) {
      doc.readBy.push({ user: userId, readAt: new Date() });
      await doc.save();
    }
    const out = serialize(doc);
    return { ...out, isRead: true };
  }

  async markAllRead(userId) {
    const uid = new mongoose.Types.ObjectId(userId);
    const result = await Notification.updateMany(
      { audience: 'staff', readBy: { $not: { $elemMatch: { user: uid } } } },
      { $push: { readBy: { user: uid, readAt: new Date() } } },
    );
    return { updated: result.modifiedCount || 0 };
  }

  async remove(id) {
    const doc = await Notification.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Notification not found');
    return { id };
  }
}

export default new NotificationService();
