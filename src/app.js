import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import config from './config/index.js';
import routes from './routes/index.js';
import requestLogger from './middlewares/requestLogger.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';
import mongoSanitize from './middlewares/mongoSanitize.middleware.js';
import { HTTP_STATUS } from './constants/httpStatus.js';

class App {
  constructor() {
    this.app = express();
    this.#setupSecurity();
    this.#setupMiddleware();
    this.#setupRoutes();
    this.#setupErrorHandling();
  }

  #setupSecurity() {
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: config.clientUrls,
        credentials: true,
      }),
    );
    this.app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          message: 'Too many requests, please try again later',
        },
      }),
    );
  }

  #setupMiddleware() {
    this.app.use(compression());
    // rawBody kept for signature verification (Razorpay webhook)
    this.app.use(
      express.json({
        limit: '1mb',
        verify: (req, _res, buf) => {
          if (req.originalUrl?.startsWith('/api/v1/payments/')) req.rawBody = Buffer.from(buf);
        },
      }),
    );
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
    this.app.use(mongoSanitize);
    this.app.use(requestLogger);
  }

  #setupRoutes() {
    this.app.get('/', (_req, res) => {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Zaylo API',
        version: 'v1',
        docs: '/api/v1/health',
      });
    });

    this.app.use('/api/v1', routes);
  }

  #setupErrorHandling() {
    this.app.use(notFound);
    this.app.use(errorHandler);
  }

  get express() {
    return this.app;
  }
}

export default App;
