import ContentService from '../services/ContentService.js';
import ApiResponse from '../utils/ApiResponse.js';

class SettingsController {
  async getPublic(_req, res) {
    const data = await ContentService.getPublicSettings();
    res.set('Cache-Control', 'public, max-age=120');
    return ApiResponse.ok(res, data);
  }

  async getAdmin(_req, res) {
    const data = await ContentService.getAdminSettings();
    return ApiResponse.ok(res, data);
  }

  async update(req, res) {
    const data = await ContentService.updateSettings(req.body);
    return ApiResponse.ok(res, data);
  }
}

export default new SettingsController();
