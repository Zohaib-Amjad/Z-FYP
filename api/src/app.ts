import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { uploadsDir } from './config/paths';
import { csrfGuard } from './middleware/csrfGuard';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLog';
import { createGeneralLimiter } from './middleware/rateLimiters';
import { createApiRouter } from './routes';
import { createDocsRouter } from './routes/docs.routes';

const ONE_DAY_SECONDS = 86_400;
const SANDBOX_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

const serveUploads = (): express.RequestHandler =>
  express.static(uploadsDir, {
    index: false,
    dotfiles: 'deny',
    maxAge: ONE_DAY_SECONDS * 1000,
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (path.extname(filePath).toLowerCase() === '.svg') {
        res.setHeader('Content-Security-Policy', SANDBOX_CSP);
      }
    },
  });

export const createApp = (): Express => {
  fs.mkdirSync(uploadsDir, { recursive: true });
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    }),
  );
  if (env.NODE_ENV !== 'test') app.use(requestLogger());
  app.use('/api', csrfGuard);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/uploads', serveUploads());
  if (env.NODE_ENV === 'development') {
    app.use('/api/docs', createDocsRouter());
  }
  app.use('/api', createGeneralLimiter(), createApiRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
