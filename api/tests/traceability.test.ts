import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { listRoutes, toOpenApiPath } from './helpers/routes';

const root = path.resolve(__dirname, '..', '..');
const table = fs.readFileSync(path.join(root, 'docs', 'requirements-traceability.md'), 'utf8');
const testFiles = new Set(fs.readdirSync(__dirname));

interface Row {
  id: string;
  endpoints: string;
  status: string;
  tests: string[];
  line: string;
}

const rows: Row[] = table
  .split('\n')
  .filter(line => line.startsWith('| **FR-'))
  .map(line => {
    const cells = line.split('|').map(cell => cell.trim());
    return {
      id: cells[1].replace(/\*/g, ''),
      endpoints: cells[3],
      status: cells[cells.length - 2],
      tests: [...line.matchAll(/api\/tests\/([\w.]+\.test\.ts)/g)].map(match => match[1]),
      line,
    };
  });

const realRoutes = new Set(
  listRoutes(createApp()).map(
    route => `${route.method.toUpperCase()} ${toOpenApiPath(route.path)}`,
  ),
);

describe('docs/requirements-traceability.md', () => {
  it('has a row for each of FR-1 to FR-10', () => {
    expect(rows.map(row => row.id)).toEqual(Array.from({ length: 10 }, (_, i) => `FR-${i + 1}`));
  });

  it.each(Array.from({ length: 10 }, (_, i) => `FR-${i + 1}`))('%s is marked "API done"', id => {
    const row = rows.find(r => r.id === id)!;

    expect(row.status.startsWith('API done'), row.status).toBe(true);
  });

  it.each(Array.from({ length: 10 }, (_, i) => `FR-${i + 1}`))('%s lists tests that exist', id => {
    const row = rows.find(r => r.id === id)!;

    expect(row.tests.length).toBeGreaterThan(0);
    for (const file of row.tests) expect(testFiles.has(file), `${id}: ${file}`).toBe(true);
  });

  it('only names endpoints that really exist', () => {
    const phantom: string[] = [];
    for (const row of rows) {
      for (const match of row.endpoints.matchAll(
        /`((?:GET|POST|PUT|PATCH|DELETE) \/api\/[^`\s]*)/g,
      )) {
        const [method, rawPath] = match[1].split(' ');
        const cleaned = rawPath.split('?')[0].replace(/\/$/, '');
        const normal = cleaned.replace(/:(\w+)/g, '{$1}');
        if (!realRoutes.has(`${method} ${normal}`)) phantom.push(`${row.id}: ${match[1]}`);
      }
    }

    expect(phantom).toEqual([]);
  });

  it('gives every functional requirement except the shared FR-10 at least one real endpoint', () => {
    for (const row of rows.filter(r => r.id !== 'FR-10')) {
      const named = [
        ...row.endpoints.matchAll(/`((?:GET|POST|PUT|PATCH|DELETE) \/api\/[^`\s?]*)/g),
      ];
      expect(named.length, row.id).toBeGreaterThan(0);
    }
  });

  it('every test file listed is a real, non-empty test suite', () => {
    const listed = new Set(rows.flatMap(row => row.tests));
    for (const file of listed) {
      const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
      expect(source, file).toMatch(/\b(it|test)(\.each\([\s\S]*?\))?\(/);
    }
  });
});
