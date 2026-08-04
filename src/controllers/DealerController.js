import LeadService from '../services/LeadService.js';
import Dealer from '../models/Dealer.js';
import ApiResponse from '../utils/ApiResponse.js';

class DealerController {
  async create(req, res) {
    const data = await LeadService.createDealer(req.body);
    return ApiResponse.created(res, data, 'Application submitted');
  }

  async listAdmin(req, res) {
    const { data, meta } = await LeadService.listDealers(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async setStatus(req, res) {
    const data = await LeadService.setStatus(Dealer, req.params.id, req.body.status, 'Dealer');
    return ApiResponse.ok(res, data);
  }

  async remove(req, res) {
    const data = await LeadService.remove(Dealer, req.params.id, 'Dealer');
    return ApiResponse.ok(res, data);
  }

  async bulk(req, res) {
    const data = await LeadService.bulk(Dealer, req.body);
    return ApiResponse.ok(res, data);
  }
}

export default new DealerController();
