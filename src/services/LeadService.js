import Dealer from '../models/Dealer.js';
import BulkOrder from '../models/BulkOrder.js';
import Contact from '../models/Contact.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { parseListQuery, buildMeta, escapeRegex } from '../utils/pagination.js';
import { serialize, serializeMany, makeCode } from '../utils/serialize.js';
import NotificationService from './NotificationService.js';

class LeadService {
  async createContact(body) {
    const doc = await Contact.create({
      ...body,
      phone: body.phone || '',
      contactCode: makeCode('CON'),
      status: 'New',
      date: new Date(),
    });
    const data = serialize(doc);
    NotificationService.notify({
      type: 'contact',
      title: 'New contact inquiry',
      message: `Inquiry "${data.subject}" from ${data.name}`,
      link: '/contacts',
      entityId: data.id,
      meta: { contactCode: data.contactCode },
    });
    return data;
  }

  async createDealer(body) {
    const location =
      body.location ||
      [body.city, body.state].filter(Boolean).join(', ');
    const doc = await Dealer.create({
      ...body,
      location,
      interestedProducts: body.interestedProducts || [],
      dealerCode: makeCode('DLR'),
      status: 'Pending',
      date: new Date(),
    });
    const data = serialize(doc);
    NotificationService.notify({
      type: 'dealer',
      title: 'Dealer signup',
      message: `New dealer signup from ${data.name} (${data.businessName})`,
      link: '/dealers',
      entityId: data.id,
      meta: { dealerCode: data.dealerCode },
    });
    return data;
  }

  async createBulk(body) {
    const doc = await BulkOrder.create({
      ...body,
      organization: body.organization || body.companyName || '',
      companyName: body.companyName || body.organization || '',
      details: body.details || body.message || '',
      message: body.message || body.details || '',
      bulkCode: makeCode('BLK'),
      status: 'Pending',
      date: new Date(),
    });
    const data = serialize(doc);
    NotificationService.notify({
      type: 'bulk_order',
      title: 'Bulk quote request',
      message: `Bulk quote for ${data.quantity || 'N/A'} from ${data.organization || data.name}`,
      link: '/bulk-orders',
      entityId: data.id,
      meta: { bulkCode: data.bulkCode },
    });
    return data;
  }

  async listAdmin(Model, query, searchFields, codeField) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (q) {
      filter.$or = searchFields.map((f) => ({
        [f]: new RegExp(escapeRegex(q), 'i'),
      }));
      if (codeField) {
        filter.$or.push({ [codeField]: new RegExp(escapeRegex(q), 'i') });
      }
    }
    const [items, total] = await Promise.all([
      Model.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Model.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  listContacts(query) {
    return this.listAdmin(Contact, query, ['name', 'email', 'subject', 'message', 'phone'], 'contactCode');
  }

  listDealers(query) {
    return this.listAdmin(
      Dealer,
      query,
      ['name', 'businessName', 'email', 'location', 'city', 'phone'],
      'dealerCode',
    );
  }

  listBulk(query) {
    return this.listAdmin(
      BulkOrder,
      query,
      ['name', 'organization', 'companyName', 'email', 'phone', 'message'],
      'bulkCode',
    );
  }

  async setStatus(Model, id, status, label) {
    const doc = await Model.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true },
    );
    if (!doc) throw ApiError.notFound(`${label} not found`);

    // Dealer approve → provision Distributor user + notify
    if (Model === Dealer && status === 'Approved') {
      const existing = await User.findOne({ email: doc.email }).lean();
      if (!existing) {
        await User.create({
          name: doc.name,
          email: doc.email,
          phone: doc.phone,
          role: 'Distributor',
          status: 'Active',
          password: 'ChangeMe1!',
        });
      }
      NotificationService.notify({
        type: 'dealer',
        title: 'Dealer approved',
        message: `${doc.name} (${doc.businessName}) was approved as a distributor`,
        link: '/dealers',
        entityId: doc._id.toString(),
        meta: { dealerCode: doc.dealerCode, status: 'Approved' },
      });
    }

    // Contact open → New to Read
    if (Model === Contact && doc.status === 'New' && status === 'Read') {
      // already set
    }

    return serialize(doc);
  }

  async remove(Model, id, label) {
    const doc = await Model.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound(`${label} not found`);
    return { id };
  }

  async bulk(Model, { action, ids, status }) {
    if (action === 'delete') {
      await Model.deleteMany({ _id: { $in: ids } });
      return { deleted: ids.length };
    }
    if (action === 'status' && status) {
      await Model.updateMany({ _id: { $in: ids } }, { status });
      return { updated: ids.length, status };
    }
    throw ApiError.badRequest('Invalid bulk action');
  }

  async markContactRead(id) {
    const doc = await Contact.findById(id);
    if (!doc) throw ApiError.notFound('Contact not found');
    if (doc.status === 'New') {
      doc.status = 'Read';
      await doc.save();
    }
    return serialize(doc);
  }
}

export default new LeadService();
