import { afterEach, describe, expect, it, vi } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

afterEach(() => {
  vi.unstubAllGlobals();
});

const vehiclesPage = (ids: string[], page: number, totalPages: number): Response =>
  new Response(
    JSON.stringify({
      success: true,
      data: { items: ids.map(id => ({ id })), page, pageSize: 50, total: ids.length, totalPages },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

describe('robots', () => {
  it('keeps admin, private and API paths out of search engines and points at the sitemap', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rules.allow).toBe('/');
    expect(rules.disallow).toEqual(
      expect.arrayContaining([
        '/admin',
        '/api/',
        '/account',
        '/my-bookings',
        '/notifications',
        '/book',
      ]),
    );
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe('sitemap', () => {
  it('lists public pages and every vehicle across pages, never admin or private pages', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(vehiclesPage(['a', 'b'], 1, 2))
      .mockResolvedValueOnce(vehiclesPage(['c'], 2, 2));
    vi.stubGlobal('fetch', fetchMock);

    const urls = (await sitemap()).map(entry => entry.url);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\/vehicles\/a$/),
        expect.stringMatching(/\/vehicles\/c$/),
      ]),
    );
    expect(urls.filter(url => url.includes('/vehicles/'))).toHaveLength(3);
    expect(
      urls.some(url => /\/(admin|account|my-bookings|notifications|book)(\/|$)/.test(url)),
    ).toBe(false);
  });

  it('still serves the static pages when the API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const urls = (await sitemap()).map(entry => entry.url);

    expect(urls.length).toBeGreaterThanOrEqual(4);
    expect(urls.some(url => url.includes('/vehicles/'))).toBe(false);
  });
});
