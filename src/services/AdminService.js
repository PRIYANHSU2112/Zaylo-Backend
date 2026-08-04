import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Dealer from '../models/Dealer.js';
import BulkOrder from '../models/BulkOrder.js';
import Contact from '../models/Contact.js';
import ApiError from '../utils/ApiError.js';
import { parseListQuery, buildMeta, escapeRegex } from '../utils/pagination.js';
import { parseDateRange, buildRevenueSeries } from '../utils/dateRange.js';
import { serialize, serializeMany } from '../utils/serialize.js';

class AdminService {
  async listUsers(query) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (q) {
      filter.$or = [
        { name: new RegExp(escapeRegex(q), 'i') },
        { email: new RegExp(escapeRegex(q), 'i') },
        { phone: new RegExp(escapeRegex(q), 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async createUser(body) {
    const exists = await User.findOne({ email: body.email.toLowerCase() }).lean();
    if (exists) throw ApiError.conflict('Email already exists');
    const user = await User.create({
      ...body,
      password: body.password || 'ChangeMe1!',
      dateJoined: new Date(),
    });
    return serialize(user);
  }

  async updateUser(id, body, actorId) {
    if (body.email) delete body.email;
    if (body.password === '') delete body.password;

    if (body.status === 'Suspended' && id === actorId?.toString()) {
      throw ApiError.badRequest('Cannot suspend your own account');
    }

    const update = { ...body };
    if (body.password) {
      const user = await User.findById(id).select('+password');
      if (!user) throw ApiError.notFound('User not found');
      user.set(update);
      await user.save();
      return serialize(user);
    }

    const doc = await User.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) throw ApiError.notFound('User not found');
    return serialize(doc);
  }

  async deleteUser(id, actorId) {
    if (id === actorId?.toString()) {
      throw ApiError.badRequest('Cannot delete your own account');
    }
    const doc = await User.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('User not found');
    return { id };
  }

  async bulkUsers({ action, ids, status }, actorId) {
    const filtered = ids.filter((id) => id !== actorId?.toString());
    if (action === 'delete') {
      await User.deleteMany({ _id: { $in: filtered } });
      return { deleted: filtered.length };
    }
    if (action === 'status' && status) {
      await User.updateMany({ _id: { $in: filtered } }, { status });
      return { updated: filtered.length, status };
    }
    throw ApiError.badRequest('Invalid bulk action');
  }

  async dashboard(query = {}) {
    const range = parseDateRange(query);
    const dateFilter = { createdAt: { $gte: range.start, $lte: range.end } };

    const [
      ordersInRange,
      pendingDealers,
      pendingBulk,
      newContacts,
      cancelledOrders,
      approvedDealers,
      pendingOrders,
      products,
      recentOrders,
      recentDealers,
    ] = await Promise.all([
      Order.find(dateFilter).select('amount status createdAt date').lean(),
      Dealer.countDocuments({ ...dateFilter, status: 'Pending' }),
      BulkOrder.countDocuments({ ...dateFilter, status: 'Pending' }),
      Contact.countDocuments({ ...dateFilter, status: 'New' }),
      Order.countDocuments({ ...dateFilter, status: 'Cancelled' }),
      Dealer.countDocuments({ ...dateFilter, status: 'Approved' }),
      Order.countDocuments({ ...dateFilter, status: 'Pending' }),
      Product.find().select('category stock').lean(),
      Order.find(dateFilter).sort({ createdAt: -1 }).limit(8).lean(),
      Dealer.find(dateFilter).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const paidOrders = ordersInRange.filter((o) => o.status !== 'Cancelled');
    const totalRevenue = paidOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const activeOrders = ordersInRange.filter((o) =>
      ['Pending', 'Shipped'].includes(o.status),
    ).length;

    const orderStatusBreakdown = {
      Pending: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };
    ordersInRange.forEach((o) => {
      if (orderStatusBreakdown[o.status] !== undefined) {
        orderStatusBreakdown[o.status] += 1;
      }
    });

    const stockByCategory = {};
    products.forEach((p) => {
      stockByCategory[p.category] = (stockByCategory[p.category] || 0) + (p.stock || 0);
    });

    const stockSeries = Object.entries(stockByCategory).map(([name, value]) => ({
      name,
      value,
    }));

    return {
      totalRevenue,
      activeOrders,
      pendingDealers,
      pendingBulk,
      newContacts,
      cancelledOrders,
      approvedDealers,
      deliveredOrders: orderStatusBreakdown.Delivered,
      orderCount: ordersInRange.length,
      avgOrderValue:
        paidOrders.length > 0
          ? Math.round((totalRevenue / paidOrders.length) * 100) / 100
          : 0,
      stockByCategory,
      stockSeries,
      orderStatusBreakdown,
      orderStatusSeries: Object.entries(orderStatusBreakdown).map(([name, value]) => ({
        name,
        value,
      })),
      revenueSeries: buildRevenueSeries(ordersInRange, range),
      recentOrders: serializeMany(recentOrders),
      recentDealers: serializeMany(recentDealers),
      alertCounts: {
        pendingDealers,
        pendingBulk,
        pendingOrders,
        newContacts,
      },
      range: { key: range.key, from: range.from, to: range.to },
    };
  }
}

export default new AdminService();
