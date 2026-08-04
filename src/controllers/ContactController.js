import LeadService from '../services/LeadService.js';
import Contact from '../models/Contact.js';
import ApiResponse from '../utils/ApiResponse.js';

class ContactController {
  async create(req, res) {
    const data = await LeadService.createContact(req.body);
    return ApiResponse.created(res, data, 'Inquiry submitted');
  }

  async listAdmin(req, res) {
    const { data, meta } = await LeadService.listContacts(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async getAdmin(req, res) {
    const data = await LeadService.markContactRead(req.params.id);
    return ApiResponse.ok(res, data);
  }

  async setStatus(req, res) {
    const data = await LeadService.setStatus(Contact, req.params.id, req.body.status, 'Contact');
    return ApiResponse.ok(res, data);
  }

  async remove(req, res) {
    const data = await LeadService.remove(Contact, req.params.id, 'Contact');
    return ApiResponse.ok(res, data);
  }

  async bulk(req, res) {
    const data = await LeadService.bulk(Contact, req.body);
    return ApiResponse.ok(res, data);
  }
}

export default new ContactController();
