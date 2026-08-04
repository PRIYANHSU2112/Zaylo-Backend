import ApiError from '../utils/ApiError.js';
import AdminService from '../services/AdminService.js';
import storageService from '../services/storage.service.js';
import ApiResponse from '../utils/ApiResponse.js';

class AdminController {
  async listUsers(req, res) {
    const { data, meta } = await AdminService.listUsers(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async createUser(req, res) {
    const data = await AdminService.createUser(req.body);
    return ApiResponse.created(res, data);
  }

  async updateUser(req, res) {
    const data = await AdminService.updateUser(req.params.id, req.body, req.user._id);
    return ApiResponse.ok(res, data);
  }

  async deleteUser(req, res) {
    const data = await AdminService.deleteUser(req.params.id, req.user._id);
    return ApiResponse.ok(res, data);
  }

  async bulkUsers(req, res) {
    const data = await AdminService.bulkUsers(req.body, req.user._id);
    return ApiResponse.ok(res, data);
  }

  async dashboard(req, res) {
    const data = await AdminService.dashboard(req.query);
    return ApiResponse.ok(res, data);
  }

  async upload(req, res) {
    if (!req.file) {
      throw ApiError.badRequest('No file uploaded. Use multipart field "file".');
    }
    const folder = req.body.folder || 'uploads';
    const data = await storageService.uploadFile(req.file, folder);
    return ApiResponse.created(res, data, 'Uploaded');
  }

  async presignUpload(req, res) {
    const data = await storageService.createPresignedUpload(req.body);
    return ApiResponse.ok(res, data, 'Presigned upload ready');
  }

  async completeUpload(req, res) {
    const data = await storageService.confirmUpload(req.body.key);
    return ApiResponse.ok(res, data, 'Upload confirmed');
  }
}

export default new AdminController();
