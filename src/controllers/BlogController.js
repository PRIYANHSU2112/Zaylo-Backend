import ContentService from '../services/ContentService.js';
import ApiResponse from '../utils/ApiResponse.js';

class BlogController {
  async listPublic(req, res) {
    const { data, meta } = await ContentService.listPublicBlogs(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async listAdmin(req, res) {
    const { data, meta } = await ContentService.listAdminBlogs(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async create(req, res) {
    const data = await ContentService.createBlog(req.body);
    return ApiResponse.created(res, data);
  }

  async update(req, res) {
    const data = await ContentService.updateBlog(req.params.id, req.body);
    return ApiResponse.ok(res, data);
  }

  async remove(req, res) {
    const data = await ContentService.deleteBlog(req.params.id);
    return ApiResponse.ok(res, data);
  }
}

export default new BlogController();
