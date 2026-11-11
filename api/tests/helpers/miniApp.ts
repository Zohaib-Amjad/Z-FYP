import express, { Express, Router } from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler';

export const buildMiniApp = (configure: (router: Router) => void): Express => {
  const app = express();
  const router = Router();
  configure(router);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/t', router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
