import ContentService from '../services/ContentService.js';
import ApiResponse from '../utils/ApiResponse.js';

class GalleryController {
  async listPublic(req, res) {
    const { data, meta } = await ContentService.listGallery(req.query, { publicOnly: true });
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async listAdmin(req, res) {
    const { data, meta } = await ContentService.listGallery(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async create(req, res) {
    const data = await ContentService.createGallery(req.body);
    return ApiResponse.created(res, data);
  }

  async update(req, res) {
    const data = await ContentService.updateGallery(req.params.id, req.body);
    return ApiResponse.ok(res, data);
  }

  async remove(req, res) {
    const data = await ContentService.deleteGallery(req.params.id);
    return ApiResponse.ok(res, data);
  }
}

export default new GalleryController();
