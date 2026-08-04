import HomeService from '../services/HomeService.js';
import ApiResponse from '../utils/ApiResponse.js';

class HomeController {
  async getPublic(_req, res) {
    const data = await HomeService.getHomePage();
    res.set('Cache-Control', 'public, max-age=120');
    return ApiResponse.ok(res, data);
  }

  async listLandingImages(req, res) {
    const { data, meta } = await HomeService.listLandingImages(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async createLandingImage(req, res) {
    const data = await HomeService.createLandingImage(req.body);
    return ApiResponse.created(res, data);
  }

  async updateLandingImage(req, res) {
    const data = await HomeService.updateLandingImage(req.params.id, req.body);
    return ApiResponse.ok(res, data);
  }

  async deleteLandingImage(req, res) {
    const data = await HomeService.deleteLandingImage(req.params.id);
    return ApiResponse.ok(res, data);
  }

  async listBundles(req, res) {
    const { data, meta } = await HomeService.listBundles(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async createBundle(req, res) {
    const data = await HomeService.createBundle(req.body);
    return ApiResponse.created(res, data);
  }

  async updateBundle(req, res) {
    const data = await HomeService.updateBundle(req.params.id, req.body);
    return ApiResponse.ok(res, data);
  }

  async deleteBundle(req, res) {
    const data = await HomeService.deleteBundle(req.params.id);
    return ApiResponse.ok(res, data);
  }
}

export default new HomeController();
