import LeadService from '../services/LeadService.js';
import BulkOrder from '../models/BulkOrder.js';
import ApiResponse from '../utils/ApiResponse.js';

class BulkOrderController {
  async create(req, res) {
    const data = await LeadService.createBulk(req.body);
    return ApiResponse.created(res, data, 'Inquiry submitted');
  }

  async listAdmin(req, res) {
    const { data, meta } = await LeadService.listBulk(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async setStatus(req, res) {
    const data = await LeadService.setStatus(
      BulkOrder,
      req.params.id,
      req.body.status,
      'Bulk order',
    );
    return ApiResponse.ok(res, data);
  }

  async remove(req, res) {
    const data = await LeadService.remove(BulkOrder, req.params.id, 'Bulk order');
    return ApiResponse.ok(res, data);
  }

  async bulk(req, res) {
    const data = await LeadService.bulk(BulkOrder, req.body);
    return ApiResponse.ok(res, data);
  }
}

export default new BulkOrderController();
