import fs from 'fs';
import path from 'path';
import { RequestHandler, Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

const SPEC_PATH = path.resolve(__dirname, '..', '..', 'openapi.yaml');

const SWAGGER_UI_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
].join('; ');

export const loadOpenApiDocument = (): swaggerUi.JsonObject =>
  parse(fs.readFileSync(SPEC_PATH, 'utf8')) as swaggerUi.JsonObject;

const allowSwaggerUi: RequestHandler = (_req, res, next) => {
  res.setHeader('Content-Security-Policy', SWAGGER_UI_CSP);
  next();
};

export const createDocsRouter = (): Router => {
  const document = loadOpenApiDocument();
  const router = Router();
  router.use(allowSwaggerUi);
  router.get('/openapi.json', (_req, res) => {
    res.json(document);
  });
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(document, { customSiteTitle: 'Prestige Test Drive API' }),
  );
  return router;
};
