import { describe, expect, it } from 'vitest';
import { buildCsp, createNonce } from '@/lib/csp';

const directive = (policy: string, name: string): string[] =>
  (policy.split('; ').find(part => part.startsWith(`${name} `)) ?? '').split(' ').slice(1);

describe('buildCsp', () => {
  const policy = buildCsp('abc123', false);

  it('runs scripts only with the nonce, never inline or from elsewhere', () => {
    const scripts = directive(policy, 'script-src');
    expect(scripts).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it('sends every request, image and font to this origin only', () => {
    expect(directive(policy, 'connect-src')).toEqual(["'self'"]);
    expect(directive(policy, 'img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(directive(policy, 'font-src')).toEqual(["'self'"]);
    expect(directive(policy, 'default-src')).toEqual(["'self'"]);
  });

  it('forbids framing, plug-ins, foreign forms and a changed base URL', () => {
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(directive(policy, 'form-action')).toEqual(["'self'"]);
    expect(directive(policy, 'base-uri')).toEqual(["'self'"]);
  });

  it('loosens only what development tooling needs', () => {
    const dev = buildCsp('abc123', true);
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(dev, 'connect-src')).toContain('ws:');
    expect(policy).not.toContain('ws:');
  });
});

describe('createNonce', () => {
  it('is unpredictable and differs every time', () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    expect([...nonces][0]).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
