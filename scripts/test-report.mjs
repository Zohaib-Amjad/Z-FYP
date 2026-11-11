import fs from 'node:fs';
import path from 'node:path';

/**
 * Builds docs/test-report.md from the real results of the three suites:
 *   api/test-results.json   (npm run test:report --workspace=api)
 *   web/test-results.json   (npm run test:report --workspace=web)
 *   web/e2e/results.json    (npm run test:e2e)
 * plus the coverage summaries written by the two `test:report` runs.
 */
const root = path.resolve(import.meta.dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const exists = file => fs.existsSync(path.join(root, file));

const E2E_CASES = {
  'E2E-01': {
    fr: 'FR-1, FR-4, FR-5, FR-6, FR-8',
    scenario: 'A new customer registers, browses, filters by manufacturer, vehicle type and fuel type, opens a vehicle, picks showroom, date and time, confirms the booking.',
    expected: 'The booking is submitted with status Pending approval and appears under Pending in My bookings.',
  },
  'E2E-02': {
    fr: 'FR-7, FR-9',
    scenario: 'Staff open the dashboard, find a pending booking and approve it.',
    expected: 'The customer sees the booking under Upcoming as Approved and has an unread notification.',
  },
  'E2E-03': {
    fr: 'FR-7, FR-9',
    scenario: 'Staff reject a request: first without a reason, then with one.',
    expected: 'The empty reason is refused; the customer sees the booking under Cancelled, labelled Rejected, with the reason.',
  },
  'E2E-04': {
    fr: 'FR-7, FR-9',
    scenario: 'Staff reschedule a booking to another slot of the same vehicle.',
    expected: 'The customer sees status Rescheduled, the new time and the history entry showing the move.',
  },
  'E2E-05': {
    fr: 'FR-8',
    scenario: 'A customer cancels one booking outside the 24 hour window and tries to cancel another inside it.',
    expected: 'Outside: cancelled with the reason recorded. Inside: no cancel button, the policy is explained and the server answers CANCELLATION_WINDOW_PASSED.',
  },
  'E2E-06': {
    fr: 'FR-6',
    scenario: 'Two customers in separate browser contexts confirm a booking for the same slot at the same moment.',
    expected: 'Exactly one booking succeeds; the other customer sees the friendly "time has just been taken" message.',
  },
  'E2E-07': {
    fr: 'FR-7, FR-8',
    scenario: 'Staff complete a past approved booking.',
    expected: 'The customer sees it under Completed and Previous; completing it again is refused (INVALID_STATUS_TRANSITION).',
  },
  'E2E-08': {
    fr: 'FR-1, FR-7',
    scenario: 'Access control: a visitor opens private pages, a customer opens /admin, staff try to book.',
    expected: 'Visitors are redirected to sign in; customers get the 403 page and 403 from staff APIs; staff cannot book (403) and see an explanation.',
  },
  'E2E-09': {
    fr: 'FR-3, FR-5',
    scenario: 'Staff create a vehicle with a photograph, assign a showroom and generate slots with the bulk generator.',
    expected: 'The customer finds the vehicle in the catalogue and sees open dates for the chosen showroom.',
  },
  'E2E-10': {
    fr: 'FR-3',
    scenario: 'Staff deactivate a vehicle that has a future booking, cancel the booking, then deactivate again.',
    expected: 'First attempt is blocked with the booking count and a link; the second works and the vehicle disappears from the catalogue.',
  },
  'E2E-11': {
    fr: 'FR-1',
    scenario: 'A customer signs in with a wrong password, then correctly, then signs out.',
    expected: 'A generic error first; then the customer is signed in; signing out shows a confirmation and the signed-out header.',
  },
};

const lines = [];
const out = text => lines.push(text);
const pct = value => `${value.toFixed(2)}%`;

/* ------------------------------------------------ traceability: file -> FRs */
const frByFile = new Map();
for (const row of fs.readFileSync(path.join(root, 'docs/requirements-traceability.md'), 'utf8').split('\n')) {
  const fr = row.match(/^\| \*\*(FR-\d+)\*\*/)?.[1];
  if (!fr) continue;
  for (const file of row.match(/`(?:api|web)\/tests\/[\w./-]+\.test\.tsx?`/g) ?? []) {
    const key = file.replaceAll('`', '');
    frByFile.set(key, [...(frByFile.get(key) ?? []), fr]);
  }
}

/* ----------------------------------------------------------- vitest suites */
function vitestSuite(name, workspace) {
  const file = `${workspace}/test-results.json`;
  if (!exists(file)) return null;
  const data = read(file);
  const files = data.testResults.map(result => {
    const relative = path.relative(path.join(root, workspace), result.name).replaceAll('\\', '/');
    const tests = result.assertionResults;
    return {
      file: `${workspace}/${relative}`,
      total: tests.length,
      passed: tests.filter(test => test.status === 'passed').length,
      failed: tests.filter(test => test.status === 'failed').length,
    };
  });
  return { name, workspace, files, total: data.numTotalTests, passed: data.numPassedTests, failed: data.numFailedTests };
}

const suites = [vitestSuite('API tests (Vitest + Supertest)', 'api'), vitestSuite('Web unit and component tests (Vitest + Testing Library)', 'web')].filter(Boolean);

/* --------------------------------------------------------------- playwright */
function collectPlaywright(node, found = []) {
  for (const spec of node.specs ?? []) {
    const result = spec.tests?.[0]?.results?.at(-1);
    found.push({
      title: spec.title,
      ok: spec.ok,
      status: result?.status ?? 'skipped',
      duration: result?.duration ?? 0,
      error: result?.error?.message?.split('\n')[0] ?? '',
    });
  }
  for (const child of node.suites ?? []) collectPlaywright(child, found);
  return found;
}
const e2eFiles = exists('web/e2e/results.json') ? read('web/e2e/results.json').suites.length : 0;
const e2e = exists('web/e2e/results.json') ? collectPlaywright({ suites: read('web/e2e/results.json').suites }) : [];

/* -------------------------------------------------------------------- write */
const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
out('# Test report');
out('');
out(`Generated on ${now} UTC by \`scripts/test-report.mjs\` from the results of the real suites. Regenerate with \`npm run test:report:docs\` after running the suites.`);
out('');
out('## Summary');
out('');
out('| Suite | Test files | Tests | Passed | Failed |');
out('| --- | ---: | ---: | ---: | ---: |');
for (const suite of suites) out(`| ${suite.name} | ${suite.files.length} | ${suite.total} | ${suite.passed} | ${suite.failed} |`);
if (e2e.length > 0) {
  const passed = e2e.filter(test => test.ok).length;
  out(`| End-to-end tests (Playwright, Chrome) | ${e2eFiles} | ${e2e.length} | ${passed} | ${e2e.length - passed} |`);
}
const totals = [...suites.map(suite => [suite.total, suite.passed]), ...(e2e.length ? [[e2e.length, e2e.filter(test => test.ok).length]] : [])];
const grand = totals.reduce((sum, [total]) => sum + total, 0);
const grandPassed = totals.reduce((sum, [, passed]) => sum + passed, 0);
out(`| **All suites** | | **${grand}** | **${grandPassed}** | **${grand - grandPassed}** |`);
out('');

out('## Coverage');
out('');
out('| Workspace | Lines | Statements | Functions | Branches |');
out('| --- | ---: | ---: | ---: | ---: |');
for (const [label, file] of [['API (`api/src`)', 'api/coverage/coverage-summary.json'], ['Web (`web/src` lib, hooks and components)', 'web/coverage/coverage-summary.json']]) {
  if (!exists(file)) {
    out(`| ${label} | not measured | | | |`);
    continue;
  }
  const { total } = read(file);
  out(`| ${label} | ${pct(total.lines.pct)} | ${pct(total.statements.pct)} | ${pct(total.functions.pct)} | ${pct(total.branches.pct)} |`);
}
out('');
out('The API threshold is 80 % of lines for every file. Web pages and layouts that are server components are exercised by the end-to-end tests instead and are not part of the web coverage figure.');
out('');

if (e2e.length > 0) {
  out('## End-to-end test cases');
  out('');
  out('Run against a production build of the web app and the real API with its own freshly seeded database (see `web/playwright.config.ts`).');
  out('');
  out('| ID | FR | Scenario | Expected result | Actual result | Result |');
  out('| --- | --- | --- | --- | --- | --- |');
  for (const test of [...e2e].sort((a, b) => a.title.localeCompare(b.title))) {
    const id = test.title.match(/^(E2E-\d+)/)?.[1] ?? test.title;
    const meta = E2E_CASES[id] ?? { fr: '', scenario: test.title, expected: '' };
    const actual = test.ok ? `As expected (${(test.duration / 1000).toFixed(1)} s).` : `Failed: ${test.error.replace(/\|/g, '/').slice(0, 120)}`;
    out(`| ${id} | ${meta.fr} | ${meta.scenario} | ${meta.expected} | ${actual} | ${test.ok ? 'Pass' : 'Fail'} |`);
  }
  out('');
}

for (const suite of suites) {
  out(`## ${suite.name}: results by test file`);
  out('');
  out('| ID | FR | Test file | Tests | Passed | Failed | Result |');
  out('| --- | --- | --- | ---: | ---: | ---: | --- |');
  const prefix = suite.workspace === 'api' ? 'API' : 'WEB';
  suite.files
    .sort((a, b) => a.file.localeCompare(b.file))
    .forEach((entry, index) => {
      const frs = [...new Set(frByFile.get(entry.file) ?? [])].join(', ') || 'Cross-cutting';
      const id = `${prefix}-${String(index + 1).padStart(2, '0')}`;
      out(`| ${id} | ${frs} | \`${entry.file}\` | ${entry.total} | ${entry.passed} | ${entry.failed} | ${entry.failed === 0 ? 'Pass' : 'Fail'} |`);
    });
  out('');
}

out('## How to reproduce');
out('');
out('```bash');
out('npm run test:all                     # API tests, web tests, then the end-to-end tests');
out('npm run test:report --workspace=api  # API results and coverage');
out('npm run test:report --workspace=web  # web results and coverage');
out('npm run test:e2e                     # end-to-end tests (writes web/e2e/results.json)');
out('npm run test:report:docs             # rewrites this file');
out('```');

fs.writeFileSync(path.join(root, 'docs/test-report.md'), `${lines.join('\n')}\n`);
console.log(`Wrote docs/test-report.md (${grand} tests, ${grand - grandPassed} failing)`);
