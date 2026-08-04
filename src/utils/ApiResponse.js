import { StatusCodes } from 'http-status-codes';

class ApiResponse {
  constructor(statusCode, data = null, message = 'Success', meta = null) {
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
    this.meta = meta;
    this.error = null;
  }

  static ok(res, data = null, message = 'Success', meta = null) {
    return res
      .status(StatusCodes.OK)
      .json(new ApiResponse(StatusCodes.OK, data, message, meta));
  }

  static created(res, data = null, message = 'Created', meta = null) {
    return res
      .status(StatusCodes.CREATED)
      .json(new ApiResponse(StatusCodes.CREATED, data, message, meta));
  }

  static noContent(res) {
    return res.status(StatusCodes.NO_CONTENT).send();
  }
}

export default ApiResponse;
