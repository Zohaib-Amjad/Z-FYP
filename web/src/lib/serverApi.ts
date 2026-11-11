const API_ORIGIN = process.env.API_URL ?? 'http://localhost:4000';

const REVALIDATE_SECONDS = 60;

export type PublicResult<T> = { ok: true; data: T } | { ok: false; status: number };

/**
 * Fetches public (no-session) API data from a server component and keeps the HTTP status,
 * so a page can tell "not found" (404) from "the API is down" (status 0 or 5xx).
 */
export async function fetchPublicResult<T>(path: string): Promise<PublicResult<T>> {
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return { ok: false, status: response.status };
    const body = (await response.json()) as { data: T };
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Like fetchPublicResult but returns null on any failure, so pages can degrade gracefully. */
export async function fetchPublic<T>(path: string): Promise<T | null> {
  const result = await fetchPublicResult<T>(path);
  return result.ok ? result.data : null;
}
