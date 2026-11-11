import fs from 'fs';
import { describe, expect, it } from 'vitest';
import {
  OUTPUT_FILES,
  PostmanItem,
  buildCollection,
  buildEnvironment,
  loadSpec,
  renderOutputs,
} from '../scripts/postman';

type Node = Record<string, unknown>;

const spec = loadSpec();
const collection = buildCollection(spec);
const folders = collection.item as PostmanItem[];
const requests = folders.flatMap(folder => folder.item ?? []);
const apiRequests = folders
  .filter(folder => folder.name !== 'Sign in')
  .flatMap(folder => folder.item ?? []);
const variables = new Set(collection.variable.map(variable => variable.key));

const operations = Object.entries(spec.paths as Node).flatMap(([pathName, item]) =>
  Object.entries(item as Node)
    .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
    .map(([method, operation]) => ({ pathName, method, operation: operation as Node })),
);

const rawOf = (item: PostmanItem): string => ((item.request as Node).url as Node).raw as string;
const methodOf = (item: PostmanItem): string => (item.request as Node).method as string;

describe('collection contents', () => {
  it('is a Postman 2.1 collection with a sign-in folder first', () => {
    expect(collection.info.schema).toContain('collection/v2.1.0');
    expect(folders[0].name).toBe('Sign in');
    expect(folders[0].item?.map(item => item.name)).toEqual([
      'Sign in as customer',
      'Sign in as staff',
      'Sign out',
    ]);
  });

  it('has exactly one request for every documented operation', () => {
    expect(apiRequests).toHaveLength(operations.length);
    expect(
      new Set(apiRequests.map(item => `${methodOf(item)} ${rawOf(item).split('?')[0]}`)).size,
    ).toBe(operations.length);
    expect(new Set(apiRequests.map(item => item.name))).toEqual(
      new Set(operations.map(({ operation }) => String(operation.summary))),
    );
  });

  it('groups requests into one folder per tag, in document order', () => {
    const tags = (spec.tags as Node[]).map(tag => String(tag.name));

    expect(folders.slice(1).map(folder => folder.name)).toEqual(tags);
    for (const folder of folders.slice(1))
      expect(folder.item?.length, folder.name).toBeGreaterThan(0);
  });

  it('points every request at the base URL and replaces every path parameter with a variable', () => {
    for (const item of requests) {
      const raw = rawOf(item);
      expect(raw.startsWith('{{baseUrl}}/api/')).toBe(true);
      expect(raw).not.toMatch(/[^{]\{[^{]/);
      for (const [, name] of raw.matchAll(/\{\{(\w+)\}\}/g)) {
        expect(variables.has(name), `${name} in ${raw}`).toBe(true);
      }
    }
  });

  it('uses the right identifier variable for each resource', () => {
    const find = (method: string, suffix: string) =>
      rawOf(
        requests.find(
          item => methodOf(item) === method && rawOf(item).split('?')[0].endsWith(suffix),
        )!,
      );

    expect(find('GET', '/api/vehicles/{{vehicleId}}')).toContain('{{vehicleId}}');
    expect(find('PATCH', '/api/admin/dealerships/{{dealershipId}}/deactivate')).toBeTruthy();
    expect(find('PATCH', '/api/admin/slots/{{slotId}}/activate')).toBeTruthy();
    expect(find('PATCH', '/api/admin/bookings/{{bookingId}}/approve')).toBeTruthy();
    expect(find('PATCH', '/api/notifications/{{notificationId}}/read')).toBeTruthy();
    expect(find('PATCH', '/api/admin/customers/{{customerId}}/status')).toBeTruthy();
    expect(find('DELETE', '/api/admin/vehicles/{{vehicleId}}/images/{{imageId}}')).toBeTruthy();
    expect(find('GET', '/api/vehicles/{{vehicleId}}/slots')).toBeTruthy();
  });

  it('carries a ready-made JSON body, equal to the documented example, wherever one is documented', () => {
    for (const { pathName, method, operation } of operations) {
      const content = ((operation.requestBody ?? {}) as Node).content as Node | undefined;
      const json = content?.['application/json'] as Node | undefined;
      if (!json) continue;
      const item = apiRequests.find(
        candidate =>
          candidate.name === operation.summary && methodOf(candidate) === method.toUpperCase(),
      )!;
      const body = (item.request as Node).body as Node;
      const example = json.examples
        ? ((Object.values(json.examples as Node)[0] as Node).value as unknown)
        : json.example;

      expect(body.mode, pathName).toBe('raw');
      expect(JSON.parse(body.raw as string)).toEqual(example);
      expect(((item.request as Node).header as Node[])[0]).toEqual({
        key: 'Content-Type',
        value: 'application/json',
      });
    }
  });

  it('offers the image upload as a form with a file field', () => {
    const upload = apiRequests.find(item => item.name === 'Upload vehicle images')!;
    const body = (upload.request as Node).body as Node;

    expect(body.mode).toBe('formdata');
    expect((body.formdata as Node[])[0]).toMatchObject({ key: 'images', type: 'file' });
  });

  it('lists optional query parameters, disabled, with example values', () => {
    const catalog = apiRequests.find(item => item.name === 'Browse, search and filter vehicles')!;
    const query = ((catalog.request as Node).url as Node).query as Node[];

    expect(query.length).toBeGreaterThan(10);
    expect(query.every(parameter => parameter.disabled === true)).toBe(true);
    expect(query.find(parameter => parameter.key === 'manufacturer')?.value).toBe('Audi,Bentley');
    expect(query.find(parameter => parameter.key === 'sort')?.value).toBe('newest');
  });

  it('captures identifiers from responses so requests can be chained', () => {
    const scripts = (name: string): string => {
      const item = apiRequests.find(candidate => candidate.name === name)!;
      return JSON.stringify(item.event);
    };

    expect(scripts('Browse, search and filter vehicles')).toContain(
      "collectionVariables.set('vehicleId'",
    );
    expect(scripts('Request a test drive (customers only)')).toContain(
      "collectionVariables.set('bookingId'",
    );
  });
});

describe('sign-in flows for both roles', () => {
  const login = (name: string): Node =>
    folders[0].item!.find(item => item.name === name)!.request as Node;
  const testScript = (name: string): string =>
    (folders[0].item!.find(item => item.name === name)!.event as Node[])
      .map(event => ((event.script as Node).exec as string[]).join('\n'))
      .join('\n');

  it('signs in through the real login endpoint with the demo credentials from variables', () => {
    const customer = JSON.parse((login('Sign in as customer').body as Node).raw as string);
    const staff = JSON.parse((login('Sign in as staff').body as Node).raw as string);

    expect(customer).toEqual({ email: '{{customerEmail}}', password: '{{demoPassword}}' });
    expect(staff).toEqual({ email: '{{staffEmail}}', password: '{{demoPassword}}' });
    expect(login('Sign in as customer').method).toBe('POST');
    expect((login('Sign in as staff').url as Node).raw).toBe('{{baseUrl}}/api/auth/login');
  });

  it('checks the role it signed in as', () => {
    expect(testScript('Sign in as customer')).toContain("to.eql('CUSTOMER')");
    expect(testScript('Sign in as staff')).toContain("to.eql('STAFF')");
  });

  it('defaults to the seeded demo accounts', () => {
    const value = (key: string) =>
      collection.variable.find(variable => variable.key === key)?.value;

    expect(value('customerEmail')).toBe('amelia.hart@prestige.test');
    expect(value('staffEmail')).toBe('staff1@prestige.test');
    expect(value('baseUrl')).toBe('http://localhost:4000');
  });
});

describe('environments', () => {
  it('provides one for the API directly and one for the web proxy, with the same variables', () => {
    const api = JSON.parse(renderOutputs().apiEnvironment);
    const web = JSON.parse(renderOutputs().webEnvironment);
    const asMap = (environment: { values: { key: string; value: string }[] }) =>
      Object.fromEntries(environment.values.map(entry => [entry.key, entry.value]));

    expect(asMap(api).baseUrl).toBe('http://localhost:4000');
    expect(asMap(web).baseUrl).toBe('http://localhost:3000');
    expect(Object.keys(asMap(api))).toEqual(Object.keys(asMap(web)));
    for (const key of ['baseUrl', 'customerEmail', 'staffEmail', 'demoPassword']) {
      expect(Object.keys(asMap(api))).toContain(key);
    }
    expect(api._postman_variable_scope).toBe('environment');
  });

  it('marks the password as a secret value', () => {
    const environment = buildEnvironment('Test', 'http://localhost:1');

    expect(environment.values.find(entry => entry.key === 'demoPassword')?.type).toBe('secret');
    expect(environment.values.every(entry => entry.enabled)).toBe(true);
  });
});

describe('committed files', () => {
  it.each(Object.keys(OUTPUT_FILES) as (keyof typeof OUTPUT_FILES)[])(
    '%s is up to date with openapi.yaml (run `npm run docs:postman` after changing it)',
    key => {
      expect(fs.readFileSync(OUTPUT_FILES[key], 'utf8')).toBe(renderOutputs()[key]);
    },
  );

  it('are valid JSON', () => {
    for (const file of Object.values(OUTPUT_FILES))
      expect(() => JSON.parse(fs.readFileSync(file, 'utf8'))).not.toThrow();
  });
});
