import Order from '../models/Order.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { parseListQuery, buildMeta, escapeRegex } from '../utils/pagination.js';
import { serialize, serializeMany, makeCode } from '../utils/serialize.js';
import NotificationService from './NotificationService.js';

class OrderService {
  async createOrder(body, user) {
    const amount = body.items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
    const order = await Order.create({
      orderCode: makeCode('ORD'),
      user: user?._id || user?.id || undefined,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone || '',
      paymentMethod: body.paymentMethod || 'COD',
      shippingAddress: body.shippingAddress,
      items: body.items.map((i) => ({
        id: i.id || i.productId || '',
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      amount,
      status: 'Pending',
      date: new Date(),
    });
    const data = serialize(order);
    NotificationService.notify({
      type: 'order',
      title: 'New order',
      message: `Order ${data.orderCode} placed by ${data.customerName} (₹${data.amount})`,
      link: '/orders',
      entityId: data.id,
      meta: { orderCode: data.orderCode, amount: data.amount },
    });
    return data;
  }

  async listMine(userId, query) {
    const { page, limit, skip, sort } = parseListQuery(query);
    const filter = { user: userId };
    const [items, total] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async getOne(id, requester) {
    const order = await Order.findById(id).lean();
    if (!order) throw ApiError.notFound('Order not found');

    const isStaff = ['Admin', 'Manager'].includes(requester?.role);
    const isOwner =
      order.user &&
      requester &&
      order.user.toString() === (requester._id || requester.id)?.toString();

    if (!isStaff && !isOwner) throw ApiError.forbidden('Not allowed');
    return serialize(order);
  }

  async listAdmin(query) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
    if (q) {
      filter.$or = [
        { orderCode: new RegExp(escapeRegex(q), 'i') },
        { customerName: new RegExp(escapeRegex(q), 'i') },
        { customerEmail: new RegExp(escapeRegex(q), 'i') },
        { shippingAddress: new RegExp(escapeRegex(q), 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async setStatus(id, status) {
    const doc = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true },
    ).lean();
    if (!doc) throw ApiError.notFound('Order not found');
    return serialize(doc);
  }

  async remove(id) {
    const doc = await Order.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Order not found');
    return { id };
  }

  async bulk({ action, ids, status }) {
    if (action === 'delete') {
      await Order.deleteMany({ _id: { $in: ids } });
      return { deleted: ids.length };
    }
    if (action === 'status' && status) {
      await Order.updateMany({ _id: { $in: ids } }, { status });
      return { updated: ids.length, status };
    }
    throw ApiError.badRequest('Invalid bulk action');
  }

  async listAddresses(userId) {
    const user = await User.findById(userId).select('addresses').lean();
    if (!user) throw ApiError.notFound('User not found');
    return (user.addresses || []).map((a) => ({
      id: a._id.toString(),
      type: a.type,
      address: a.address,
    }));
  }

  async addAddress(userId, body) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    user.addresses.push(body);
    await user.save();
    const last = user.addresses[user.addresses.length - 1];
    return { id: last._id.toString(), type: last.type, address: last.address };
  }

  async updateAddress(userId, addressId, body) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    const addr = user.addresses.id(addressId);
    if (!addr) throw ApiError.notFound('Address not found');
    if (body.type !== undefined) addr.type = body.type;
    if (body.address !== undefined) addr.address = body.address;
    await user.save();
    return { id: addr._id.toString(), type: addr.type, address: addr.address };
  }

  async deleteAddress(userId, addressId) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    const addr = user.addresses.id(addressId);
    if (!addr) throw ApiError.notFound('Address not found');
    addr.deleteOne();
    await user.save();
    return { id: addressId };
  }
}

export default new OrderService();
