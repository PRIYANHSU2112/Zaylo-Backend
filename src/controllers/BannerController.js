import ContentService from '../services/ContentService.js';
import ApiResponse from '../utils/ApiResponse.js';

class BannerController {
  async listPublic(req, res) {
    const placement = typeof req.query.placement === 'string' ? req.query.placement : '';
    const data = await ContentService.getBanners(placement);
    res.set('Cache-Control', 'public, max-age=60');
    return ApiResponse.ok(res, data);
  }

  async listAnnouncements(req, res) {
    const { data, meta } = await ContentService.listAnnouncements(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async createAnnouncement(req, res) {
    const data = await ContentService.createAnnouncement(req.body);
    return ApiResponse.created(res, data);
  }

  async updateAnnouncement(req, res) {
    const data = await ContentService.updateAnnouncement(req.params.id, req.body);
    return ApiResponse.ok(res, data);
  }

  async deleteAnnouncement(req, res) {
    const data = await ContentService.deleteAnnouncement(req.params.id);
    return ApiResponse.ok(res, data);
  }

  async listPromos(req, res) {
    const { data, meta } = await ContentService.listPromos(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async createPromo(req, res) {
    const data = await ContentService.createPromo(req.body);
    return ApiResponse.created(res, data);
  }

  async updatePromo(req, res) {
    const data = await ContentService.updatePromo(req.params.id, req.body);
    return ApiResponse.ok(res, data);
  }

  async deletePromo(req, res) {
    const data = await ContentService.deletePromo(req.params.id);
    return ApiResponse.ok(res, data);
  }
}

export default new BannerController();
