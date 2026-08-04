import AuthService from '../services/AuthService.js';
import ApiResponse from '../utils/ApiResponse.js';

class AuthController {
  async register(req, res) {
    const data = await AuthService.register(req.body);
    return ApiResponse.created(res, data, 'Account created');
  }

  async login(req, res) {
    const data = await AuthService.login(req.body);
    return ApiResponse.ok(res, data, 'Logged in');
  }

  async me(req, res) {
    const id = req.user._id || req.user.id;
    const data = await AuthService.me(id);
    return ApiResponse.ok(res, data);
  }

  async updateProfile(req, res) {
    const id = req.user._id || req.user.id;
    const data = await AuthService.updateProfile(id, req.body);
    return ApiResponse.ok(res, data, 'Profile updated');
  }
}

export default new AuthController();
