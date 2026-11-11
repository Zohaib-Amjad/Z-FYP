import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { API_ERROR_CODES } from '../src/utils/response';

const root = path.resolve(__dirname, '..', '..');
const doc = fs.readFileSync(path.join(root, 'docs', 'api-error-codes.md'), 'utf8');

const documentedStatuses = (): Map<string, Set<number>> => {
  const result = new Map<string, Set<number>>();
  for (const line of doc.split('\n')) {
    const match = /^\| `([A-Z_]+)` \| ([^|]+) \|/.exec(line);
    if (!match) continue;
    const statuses = [...match[2].matchAll(/\d{3}/g)].map(m => Number(m[0]));
    result.set(match[1], new Set(statuses));
  }
  return result;
};

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : full.endsWith('.ts') ? [full] : [];
  });

const usedInSource = (): { status: number; code: string; file: string }[] => {
  const found: { status: number; code: string; file: string }[] = [];
  for (const file of sourceFiles(path.resolve(__dirname, '..', 'src'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/new AppError\(\s*(\d{3}),\s*'([A-Z_]+)'/g)) {
      found.push({ status: Number(match[1]), code: match[2], file: path.basename(file) });
    }
    for (const match of text.matchAll(
      /sendError\(\s*res,\s*'([A-Z_]+)',[^;]*?,\s*(\d{3})\s*[,)]/gs,
    )) {
      found.push({ status: Number(match[2]), code: match[1], file: path.basename(file) });
    }
  }
  return found;
};

describe('docs/api-error-codes.md', () => {
  it('documents every error code the API can return, and nothing else', () => {
    expect([...documentedStatuses().keys()].sort()).toEqual([...API_ERROR_CODES].sort());
  });

  it('gives every code at least one HTTP status from the allowed set', () => {
    const allowed = new Set([400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503]);
    for (const [code, statuses] of documentedStatuses()) {
      expect(statuses.size, code).toBeGreaterThan(0);
      for (const status of statuses) expect(allowed.has(status), `${code} ${status}`).toBe(true);
    }
  });

  it('lists every status/code pair used in the source code', () => {
    const documented = documentedStatuses();
    const missing = usedInSource()
      .filter(({ status, code }) => !documented.get(code)?.has(status))
      .map(({ status, code, file }) => `${code} ${status} (${file})`);

    expect(missing).toEqual([]);
  });

  it('finds a healthy number of usages, so the check above cannot pass by matching nothing', () => {
    expect(usedInSource().length).toBeGreaterThan(40);
    const codesSeen = new Set(usedInSource().map(({ code }) => code));
    for (const code of [
      'SLOT_OVERLAP',
      'EMAIL_TAKEN',
      'RATE_LIMITED',
      'INVALID_CURRENT_PASSWORD',
    ]) {
      expect(codesSeen.has(code), code).toBe(true);
    }
  });

  it('agrees with the status quick reference table', () => {
    const quick = doc.split('## Status quick reference')[1];
    for (const [code, statuses] of documentedStatuses()) {
      for (const status of statuses) {
        const row = quick.split('\n').find(line => line.startsWith(`| ${status} |`));
        expect(row, `${status} row`).toBeDefined();
        expect(row, `${code} under ${status}`).toContain(`\`${code}\``);
      }
    }
  });

  it('matches the error codes enumerated in the OpenAPI document', () => {
    const spec = parse(fs.readFileSync(path.join(root, 'api', 'openapi.yaml'), 'utf8')) as {
      components: { schemas: { ErrorCode: { enum: string[] } } };
    };

    expect([...spec.components.schemas.ErrorCode.enum].sort()).toEqual([...API_ERROR_CODES].sort());
  });
});
