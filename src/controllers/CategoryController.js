import CatalogService from '../services/CatalogService.js';
import ApiResponse from '../utils/ApiResponse.js';

class CategoryController {
  async listPublic(_req, res) {
    const data = await CatalogService.listPublicCategories();
    res.set('Cache-Control', 'public, max-age=120');
    return ApiResponse.ok(res, data);
  }

  async listAdmin(req, res) {
    const { data, meta } = await CatalogService.listAdminCategories(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async create(req, res) {
    const data = await CatalogService.createCategory(req.body);
    return ApiResponse.created(res, data);
  }

  async update(req, res) {
    const data = await CatalogService.updateCategory(req.params.id, req.body);
    return ApiResponse.ok(res, data);
  }

  async remove(req, res) {
    const data = await CatalogService.deleteCategory(req.params.id);
    return ApiResponse.ok(res, data);
  }

  async setStatus(req, res) {
    const data = await CatalogService.setCategoryStatus(req.params.id, req.body.status);
    return ApiResponse.ok(res, data);
  }

  async bulk(req, res) {
    const data = await CatalogService.bulkCategories(req.body);
    return ApiResponse.ok(res, data);
  }
}

export default new CategoryController();
