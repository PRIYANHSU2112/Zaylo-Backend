import CatalogService from '../services/CatalogService.js';
import ApiResponse from '../utils/ApiResponse.js';

class ProductController {
  async listPublic(req, res) {
    const { data, meta } = await CatalogService.listPublicProducts(req.query);
    res.set('Cache-Control', 'public, max-age=60');
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async getBySlug(req, res) {
    const data = await CatalogService.getBySlug(req.params.slug);
    return ApiResponse.ok(res, data);
  }

  async listAdmin(req, res) {
    const { data, meta } = await CatalogService.listAdminProducts(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async create(req, res) {
    const data = await CatalogService.createProduct(req.body);
    return ApiResponse.created(res, data);
  }

  async update(req, res) {
    const data = await CatalogService.updateProduct(req.params.id, req.body);
    return ApiResponse.ok(res, data);
  }

  async setStatus(req, res) {
    const data = await CatalogService.setProductStatus(req.params.id, req.body.status);
    return ApiResponse.ok(res, data);
  }

  async remove(req, res) {
    const data = await CatalogService.deleteProduct(req.params.id);
    return ApiResponse.ok(res, data);
  }

  async bulk(req, res) {
    const data = await CatalogService.bulkProducts(req.body);
    return ApiResponse.ok(res, data);
  }
}

export default new ProductController();
