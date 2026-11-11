import type { ApiErrorCode, FieldError } from '@/types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
  readonly details: FieldError[];

  constructor(status: number, code: ApiError['code'], message: string, details: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

type UnauthenticatedListener = () => void;

const unauthenticatedListeners = new Set<UnauthenticatedListener>();

/** Registers a callback fired whenever the API answers 401; returns an unsubscribe function. */
export function onUnauthenticated(listener: UnauthenticatedListener): () => void {
  unauthenticatedListeners.add(listener);
  return () => {
    unauthenticatedListeners.delete(listener);
  };
}

export function buildQueryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: FieldError[] };
}

export function toApiError(status: number, body: unknown): ApiError {
  const error = (body as ErrorBody | null)?.error;
  const code = (error?.code ?? 'UNKNOWN_ERROR') as ApiError['code'];
  const message = error?.message ?? 'Something went wrong. Please try again.';
  return new ApiError(status, code, message, error?.details ?? []);
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Typed fetch wrapper. Sends cookies, speaks JSON, unwraps the standard envelope
 * and throws ApiError for every failure. A 401 also notifies the auth layer.
 */
async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  let response: Response;
  try {
    response = await fetch(`${path}${buildQueryString(query)}`, {
      method,
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(0, 'NETWORK_ERROR', 'We could not reach the server. Check your connection.');
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const error = toApiError(response.status, payload);
    if (response.status === 401) unauthenticatedListeners.forEach(listener => listener());
    throw error;
  }
  return (payload as { data: T } | null)?.data as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    apiRequest<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
