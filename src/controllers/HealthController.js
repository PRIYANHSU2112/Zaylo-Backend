import HealthService from '../services/HealthService.js';
import ApiResponse from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

class HealthController {
  async check(_req, res) {
    const data = await HealthService.getStatus();
    const statusCode =
      data.status === 'ok' ? HTTP_STATUS.OK : HTTP_STATUS.INTERNAL_SERVER_ERROR;

    return res
      .status(statusCode)
      .json(new ApiResponse(statusCode, data, data.status === 'ok' ? 'Healthy' : 'Degraded'));
  }
}

export default new HealthController();
