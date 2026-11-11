import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { validate } from '../src/middleware/validate';
import { AppError } from '../src/utils/AppError';
import { asyncHandler } from '../src/utils/asyncHandler';
import { ok } from '../src/utils/response';
import { buildMiniApp } from './helpers/miniApp';

const prismaError = (
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('SELECT secret FROM users', {
    code,
    clientVersion: 'test',
    meta,
  });

const app = buildMiniApp(router => {
  router.post(
    '/validated/:id',
    validate({
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ n: z.coerce.number().int().min(1).default(1) }),
      body: z.object({
        email: z.string().trim().toLowerCase().email(),
        age: z.number().int().min(18),
      }),
    }),
    (req, res) => {
      ok(res, { body: req.body, query: req.query }, 'created', 201);
    },
  );
  router.get('/app-error', () => {
    throw new AppError(409, 'SLOT_UNAVAILABLE', 'That slot has just been taken', [
      { field: 'slotId', message: 'Already booked' },
    ]);
  });
  router.get(
    '/async-error',
    asyncHandler(async () => {
      await Promise.resolve();
      throw new AppError(403, 'FORBIDDEN', 'Nope');
    }),
  );
  router.get('/boom', () => {
    throw new Error('connection string postgres://user:secret@db/prod exploded');
  });
  router.get('/prisma/:code', req => {
    throw prismaError(
      req.params.code,
      req.params.code === 'P2002' ? { target: ['email'] } : undefined,
    );
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validate middleware', () => {
  const id = '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11';

  it('passes valid input and replaces it with the parsed values', async () => {
    const res = await request(app)
      .post(`/t/validated/${id}?n=3`)
      .send({ email: '  Amelia@Example.TEST ', age: 30 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: { body: { email: 'amelia@example.test', age: 30 }, query: { n: 3 } },
      message: 'created',
    });
  });

  it('returns the 422 envelope with field details for invalid input', async () => {
    const res = await request(app).post('/t/validated/not-a-uuid').send({ email: 'nope', age: 5 });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['age', 'email', 'id']);
    for (const detail of res.body.error.details) {
      expect(typeof detail.message).toBe('string');
    }
  });

  it('rejects a missing body', async () => {
    const res = await request(app).post(`/t/validated/${id}`);

    expect(res.status).toBe(422);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});

describe('central error handler', () => {
  it('maps AppError to its status, code and details', async () => {
    const res = await request(app).get('/t/app-error');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'SLOT_UNAVAILABLE',
        message: 'That slot has just been taken',
        details: [{ field: 'slotId', message: 'Already booked' }],
      },
    });
  });

  it('forwards rejected promises from asyncHandler', async () => {
    const res = await request(app).get('/t/async-error');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns a generic 500 without stack traces or internals', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(app).get('/t/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
      },
    });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('postgres://');
    expect(raw).not.toContain('stack');
    expect(raw).not.toContain('exploded');
    expect(spy).toHaveBeenCalled();
  });

  it('maps Prisma unique violations to 409 CONFLICT', async () => {
    const res = await request(app).get('/t/prisma/P2002');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details).toEqual([{ field: 'email', message: 'Must be unique' }]);
  });

  it('maps Prisma record-not-found to 404', async () => {
    const res = await request(app).get('/t/prisma/P2025');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('maps Prisma foreign-key violations to 409 without leaking SQL', async () => {
    const res = await request(app).get('/t/prisma/P2003');

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain('SELECT');
  });

  it('treats unmapped Prisma errors as a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(app).get('/t/prisma/P2034');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('SELECT');
  });

  it('returns the 404 envelope for unknown routes', async () => {
    const res = await request(app).get('/t/missing');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
