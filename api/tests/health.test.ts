import fs from 'fs';
import path from 'path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { uploadsDir } from '../src/config/paths';

const app = createApp();
const fixtureDir = path.join(uploadsDir, '_test-fixtures');

afterAll(async () => {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  await disconnectPrisma();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('reports ok and database connectivity', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok', database: 'up' } });
  });

  it('reports 503 in the standard envelope, without internals, when the database is unreachable', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(prisma, '$queryRaw').mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:5432'),
    );
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'The database is currently unavailable' },
    });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('recovers as soon as the database is back', async () => {
    const spy = vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect((await request(app).get('/api/health')).status).toBe(503);
    spy.mockRestore();
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});

describe('unmatched routes and malformed requests', () => {
  it('returns the 404 envelope for an unknown route', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route GET /api/definitely-not-a-route not found' },
    });
  });

  it('returns the 404 envelope for an unknown non-API url', async () => {
    const res = await request(app).get('/random/url');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 in the envelope for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects bodies larger than 100kb', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(110_000) }));

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });
});

describe('security headers and CORS', () => {
  it('sends helmet headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('only ever grants credentialed access to the configured web origin', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:3000');
    const blocked = await request(app).get('/api/health').set('Origin', 'http://evil.example');

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(blocked.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('exposes standard rate-limit headers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['ratelimit-policy']).toBeDefined();
  });
});

describe('static uploads', () => {
  const writeFixture = (name: string, content: string): void => {
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, name), content);
  };

  it('serves files with safe headers', async () => {
    writeFixture('sample.txt', 'hello');
    const res = await request(app).get('/uploads/_test-fixtures/sample.txt');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toContain('max-age');
  });

  it('sandboxes SVG files with a restrictive content security policy', async () => {
    writeFixture('image.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const res = await request(app).get('/uploads/_test-fixtures/image.svg');

    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toContain('sandbox');
  });

  it('returns the 404 envelope for a missing file and refuses directory listings', async () => {
    const missing = await request(app).get('/uploads/_test-fixtures/nope.png');
    const directory = await request(app).get('/uploads/_test-fixtures/');

    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    expect(directory.status).toBe(404);
  });

  it('does not allow path traversal out of the uploads directory', async () => {
    const res = await request(app).get('/uploads/..%2f..%2fpackage.json');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
