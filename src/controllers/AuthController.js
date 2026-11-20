import AuthService from '../services/AuthService.js';
import AccountService from '../services/AccountService.js';
import ApiResponse from '../utils/ApiResponse.js';
import config from '../config/index.js';

export const REFRESH_COOKIE = 'zaylo_rt';
const COOKIE_PATH = '/api/v1/auth';

function setRefreshCookie(res, refresh) {
  res.cookie(REFRESH_COOKIE, refresh.token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: COOKIE_PATH,
    expires: refresh.expiresAt,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: COOKIE_PATH,
  });
}

class AuthController {
  async register(req, res) {
    const { refresh, ...data } = await AuthService.register(req.body);
    setRefreshCookie(res, refresh);
    return ApiResponse.created(res, data, 'Account created');
  }

  async login(req, res) {
    const { refresh, ...data } = await AuthService.login(req.body);
    setRefreshCookie(res, refresh);
    // Body still carries accessToken + user (admin panel relies on this).
    return ApiResponse.ok(res, data, 'Logged in');
  }

  async refresh(req, res) {
    try {
      const { refresh, ...data } = await AuthService.refresh(req.cookies?.[REFRESH_COOKIE]);
      setRefreshCookie(res, refresh);
      return ApiResponse.ok(res, data, 'Session refreshed');
    } catch (err) {
      clearRefreshCookie(res);
      throw err;
    }
  }

  async logout(req, res) {
    await AuthService.logout(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    return ApiResponse.ok(res, null, 'Logged out');
  }

  async me(req, res) {
    const data = await AuthService.me(req.user._id);
    return ApiResponse.ok(res, data);
  }

  async updateProfile(req, res) {
    const data = await AuthService.updateProfile(req.user._id, req.body);
    return ApiResponse.ok(res, data, 'Profile updated');
  }

  async changePassword(req, res) {
    await AccountService.changePassword(req.user._id, req.body);
    await AuthService.revokeAllForUser(req.user._id);
    const { refresh, ...data } = await AuthService.refresh(
      (await AuthService.issueRefreshToken(req.user._id)).token,
    );
    setRefreshCookie(res, refresh);
    return ApiResponse.ok(res, data, 'Password updated');
  }
}

export default new AuthController();
