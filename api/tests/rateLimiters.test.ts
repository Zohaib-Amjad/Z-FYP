import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createAuthLimiter, createGeneralLimiter } from '../src/middleware/rateLimiters';
import { ok } from '../src/utils/response';
import { buildMiniApp } from './helpers/miniApp';

describe('general limiter', () => {
  it('returns the 429 envelope once the limit is exceeded', async () => {
    const app = buildMiniApp(router => {
      router.get('/ping', createGeneralLimiter(2), (_req, res) => {
        ok(res, 'pong');
      });
    });

    expect((await request(app).get('/t/ping')).status).toBe(200);
    expect((await request(app).get('/t/ping')).status).toBe(200);
    const blocked = await request(app).get('/t/ping');

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    });
  });
});

describe('auth limiter', () => {
  const app = buildMiniApp(router => {
    router.post('/login', createAuthLimiter(3), (_req, res) => {
      ok(res, 'attempted');
    });
  });
  const attempt = (email: string) => request(app).post('/t/login').send({ email });

  it('counts attempts per IP and email, so other emails are unaffected', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await attempt('target@example.test')).status).toBe(200);
    }

    expect((await attempt('target@example.test')).status).toBe(429);
    expect((await attempt('TARGET@example.test ')).status).toBe(429);
    expect((await attempt('someone-else@example.test')).status).toBe(200);
  });
});
