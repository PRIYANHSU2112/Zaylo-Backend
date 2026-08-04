import OrderService from '../services/OrderService.js';
import ApiResponse from '../utils/ApiResponse.js';

class AddressController {
  async list(req, res) {
    const data = await OrderService.listAddresses(req.user._id);
    return ApiResponse.ok(res, data);
  }

  async create(req, res) {
    const data = await OrderService.addAddress(req.user._id, req.body);
    return ApiResponse.created(res, data);
  }

  async update(req, res) {
    const data = await OrderService.updateAddress(req.user._id, req.params.id, req.body);
    return ApiResponse.ok(res, data);
  }

  async remove(req, res) {
    const data = await OrderService.deleteAddress(req.user._id, req.params.id);
    return ApiResponse.ok(res, data);
  }
}

export default new AddressController();
