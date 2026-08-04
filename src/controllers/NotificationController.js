import NotificationService from '../services/NotificationService.js';
import ApiResponse from '../utils/ApiResponse.js';

class NotificationController {
  async list(req, res) {
    const { data, meta } = await NotificationService.listForUser(req.user._id, req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async markRead(req, res) {
    const data = await NotificationService.markRead(req.params.id, req.user._id);
    return ApiResponse.ok(res, data);
  }

  async markAllRead(req, res) {
    const data = await NotificationService.markAllRead(req.user._id);
    return ApiResponse.ok(res, data);
  }

  async remove(req, res) {
    const data = await NotificationService.remove(req.params.id);
    return ApiResponse.ok(res, data);
  }
}

export default new NotificationController();
