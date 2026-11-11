import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, buildQueryString, onUnauthenticated } from '@/lib/api';

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildQueryString', () => {
  it('drops empty values and encodes the rest', () => {
    expect(
      buildQueryString({ q: 'range rover', page: 2, empty: '', none: undefined, nil: null }),
    ).toBe('?q=range+rover&page=2');
  });

  it('returns an empty string when nothing remains', () => {
    expect(buildQueryString({ a: '' })).toBe('');
    expect(buildQueryString()).toBe('');
  });
});

describe('api client', () => {
  it('unwraps the success envelope and sends credentials', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true, data: { id: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.get<{ id: number }>('/api/things', { page: 1 });

    expect(result).toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/things?page=1');
    expect(init.credentials).toBe('include');
    expect(init.method).toBe('GET');
  });

  it('sends JSON bodies with the right header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { success: true, data: null }));
    vi.stubGlobal('fetch', fetchMock);

    await api.post('/api/things', { name: 'x' });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('{"name":"x"}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('handles 204 responses without a body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api.delete('/api/things/1')).resolves.toBeUndefined();
  });

  it('throws ApiError with code, message and field details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(422, {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Please check the highlighted fields',
            details: [{ field: 'email', message: 'Enter a valid email' }],
          },
        }),
      ),
    );

    const error = await api.post('/api/auth/register', {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Please check the highlighted fields',
      details: [{ field: 'email', message: 'Enter a valid email' }],
    });
  });

  it('maps a 401 to UNAUTHENTICATED and notifies listeners', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(401, {
          success: false,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in required' },
        }),
      ),
    );
    const listener = vi.fn();
    const unsubscribe = onUnauthenticated(listener);

    await expect(api.get('/api/bookings/mine')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await api.get('/api/bookings/mine').catch(() => undefined);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic error when the body is not the envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 })),
    );

    await expect(api.get('/api/x')).rejects.toMatchObject({
      status: 502,
      code: 'UNKNOWN_ERROR',
      message: 'Something went wrong. Please try again.',
      details: [],
    });
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(api.get('/api/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
