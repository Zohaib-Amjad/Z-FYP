import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { REFERENCE_PATH, accessFor, buildApiReference } from '../scripts/apiReference';
import { loadSpec } from '../scripts/postman';

type Node = Record<string, unknown>;

const spec = loadSpec();
const reference = buildApiReference(spec);
const operations = Object.entries(spec.paths as Node).flatMap(([route, item]) =>
  Object.keys(item as Node)
    .filter(method => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
    .map(method => `### ${method.toUpperCase()} \`${route}\``),
);

describe('API reference document', () => {
  it('documents every operation of the OpenAPI file', () => {
    expect(operations.length).toBeGreaterThan(50);
    for (const heading of operations) expect(reference).toContain(heading);
  });

  it('matches docs/api-reference.md (run `npm run docs:api` after changing openapi.yaml)', () => {
    expect(fs.readFileSync(REFERENCE_PATH, 'utf8')).toBe(reference);
  });

  it('links the interactive documentation', () => {
    expect(reference).toContain('http://localhost:4000/api/docs');
  });
});

describe('access labels', () => {
  it('derive the audience from the route and the public flag', () => {
    expect(accessFor('get', '/api/health', true)).toBe('Public (no sign-in)');
    expect(accessFor('get', '/api/admin/bookings', false)).toBe('Staff only');
    expect(accessFor('post', '/api/staff', false)).toBe('Staff only');
    expect(accessFor('post', '/api/bookings', false)).toBe('Customer only');
    expect(accessFor('get', '/api/notifications', false)).toBe('Any signed-in user');
  });
});
