/**
 * Content-Security-Policy for the pages. Scripts run only with the per-request nonce (and what
 * those scripts load); nothing is framed, no plug-ins, forms post only to this origin, and every
 * network request goes to this origin, because the browser talks to the API through the web
 * origin. Inline styles are allowed because the framework and Tailwind emit style attributes.
 */
export function buildCsp(nonce: string, isDevelopment: boolean): string {
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDevelopment) scriptSources.push("'unsafe-eval'");
  const connectSources = ["'self'"];
  if (isDevelopment) connectSources.push('ws:', 'wss:');

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSources.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** A fresh, unguessable nonce for one response. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
