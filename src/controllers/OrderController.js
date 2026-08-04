import OrderService from '../services/OrderService.js';
import ApiResponse from '../utils/ApiResponse.js';

class OrderController {
  async create(req, res) {
    const data = await OrderService.createOrder(req.body, req.user);
    return ApiResponse.created(res, data, 'Order placed');
  }

  async listMine(req, res) {
    const { data, meta } = await OrderService.listMine(req.user._id, req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async getOne(req, res) {
    const data = await OrderService.getOne(req.params.id, req.user);
    return ApiResponse.ok(res, data);
  }

  async listAdmin(req, res) {
    const { data, meta } = await OrderService.listAdmin(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  }

  async setStatus(req, res) {
    const data = await OrderService.setStatus(req.params.id, req.body.status);
    return ApiResponse.ok(res, data);
  }

  async remove(req, res) {
    const data = await OrderService.remove(req.params.id);
    return ApiResponse.ok(res, data);
  }

  async bulk(req, res) {
    const data = await OrderService.bulk(req.body);
    return ApiResponse.ok(res, data);
  }
}

export default new OrderController();
