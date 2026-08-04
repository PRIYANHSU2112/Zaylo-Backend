import ContentService from '../services/ContentService.js';
import ApiResponse from '../utils/ApiResponse.js';

class CmsController {
  async getHome(_req, res) {
    const data = await ContentService.getCmsHome();
    res.set('Cache-Control', 'public, max-age=300');
    return ApiResponse.ok(res, data);
  }

  async getAdmin(_req, res) {
    const data = await ContentService.getCmsHome();
    return ApiResponse.ok(res, data);
  }

  async update(req, res) {
    const data = await ContentService.updateCms(req.body);
    return ApiResponse.ok(res, data);
  }
}

export default new CmsController();
