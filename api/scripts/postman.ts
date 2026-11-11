import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

type Node = Record<string, unknown>;

export interface PostmanItem {
  name: string;
  request?: Node;
  item?: PostmanItem[];
  event?: Node[];
  response?: unknown[];
}

const API_ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.resolve(API_ROOT, '..', 'docs');
const COLLECTION_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const loadSpec = (): Node =>
  parse(fs.readFileSync(path.join(API_ROOT, 'openapi.yaml'), 'utf8')) as Node;

const lookup = (spec: Node, ref: string): Node => {
  let current: unknown = spec;
  for (const part of ref.replace(/^#\//, '').split('/')) {
    current = isNode(current) ? current[part] : undefined;
  }
  if (!isNode(current)) throw new Error(`Unresolved reference ${ref}`);
  return current;
};

const resolve = (spec: Node, node: unknown): Node => {
  let current = node;
  while (isNode(current) && typeof current.$ref === 'string') current = lookup(spec, current.$ref);
  if (!isNode(current)) throw new Error('Expected an object');
  return current;
};

const idVariableFor = (pathName: string, parameter: string): string => {
  if (parameter === 'imageId') return 'imageId';
  if (parameter === 'vehicleId') return 'vehicleId';
  if (/\/dealerships/.test(pathName) && !/\/vehicles\//.test(pathName)) return 'dealershipId';
  if (/\/slots/.test(pathName) && !/\/vehicles\//.test(pathName)) return 'slotId';
  if (/\/bookings/.test(pathName)) return 'bookingId';
  if (/\/notifications/.test(pathName)) return 'notificationId';
  if (/\/customers/.test(pathName)) return 'customerId';
  return 'vehicleId';
};

const CAPTURES: Record<string, [variable: string, expression: string]> = {
  'GET /api/vehicles': ['vehicleId', 'body.data.items[0].id'],
  'GET /api/dealerships': ['dealershipId', 'body.data[0].id'],
  'GET /api/admin/slots': ['slotId', 'body.data.items[0].id'],
  'GET /api/admin/bookings': ['bookingId', 'body.data.items[0].id'],
  'GET /api/bookings/mine': ['bookingId', 'body.data.items[0].id'],
  'GET /api/notifications': ['notificationId', 'body.data.items[0].id'],
  'GET /api/admin/customers': ['customerId', 'body.data.items[0].id'],
  'POST /api/bookings': ['bookingId', 'body.data.id'],
};

const captureEvents = (key: string): Node[] => {
  const capture = CAPTURES[key];
  if (!capture) return [];
  const [variable, expression] = capture;
  return [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          'const body = pm.response.json();',
          'if (body.success) {',
          `  const value = ${expression};`,
          `  if (value) pm.collectionVariables.set('${variable}', value);`,
          '}',
        ],
      },
    },
  ];
};

const exampleOf = (parameter: Node): string => {
  const schema = isNode(parameter.schema) ? parameter.schema : {};
  const value =
    parameter.example ??
    schema.example ??
    (Array.isArray(schema.enum) ? schema.enum[0] : schema.default);
  return value === undefined ? '' : String(value);
};

const bodyOf = (spec: Node, operation: Node): { body?: Node; header: Node[] } => {
  if (!operation.requestBody) return { header: [] };
  const content = resolve(spec, operation.requestBody).content as Node;
  if (content['multipart/form-data']) {
    return {
      header: [],
      body: {
        mode: 'formdata',
        formdata: [
          {
            key: 'images',
            type: 'file',
            src: [],
            description: 'JPEG, PNG or WebP; up to 8 files of 5 MB',
          },
          { key: 'altText', type: 'text', value: '', disabled: true },
        ],
      },
    };
  }
  const json = content['application/json'] as Node;
  const example = isNode(json.examples)
    ? ((Object.values(json.examples)[0] as Node).value as unknown)
    : json.example;
  return {
    header: [{ key: 'Content-Type', value: 'application/json' }],
    body: {
      mode: 'raw',
      raw: JSON.stringify(example ?? {}, null, 2),
      options: { raw: { language: 'json' } },
    },
  };
};

const buildRequest = (
  spec: Node,
  pathName: string,
  method: string,
  operation: Node,
): PostmanItem => {
  const parameters = ((operation.parameters as unknown[]) ?? []).map(parameter =>
    resolve(spec, parameter),
  );
  const postmanPath = pathName.replace(
    /\{(\w+)\}/g,
    (_match, name: string) => `{{${idVariableFor(pathName, name)}}}`,
  );
  const query = parameters
    .filter(parameter => parameter.in === 'query')
    .map(parameter => ({
      key: String(parameter.name),
      value: exampleOf(parameter),
      disabled: true,
      ...(parameter.description ? { description: String(parameter.description) } : {}),
    }));
  const { body, header } = bodyOf(spec, operation);
  const queryString = query.length > 0 ? `?${query.map(q => `${q.key}=${q.value}`).join('&')}` : '';
  const captureKey = `${method.toUpperCase()} ${pathName.replace(/\{(\w+)\}/g, ':$1')}`;
  return {
    name: String(operation.summary),
    event: captureEvents(captureKey),
    request: {
      method: method.toUpperCase(),
      header,
      ...(body ? { body } : {}),
      url: {
        raw: `{{baseUrl}}${postmanPath}${queryString}`,
        host: ['{{baseUrl}}'],
        path: postmanPath.split('/').filter(Boolean),
        ...(query.length > 0 ? { query } : {}),
      },
      ...(operation.description ? { description: String(operation.description).trim() } : {}),
    },
    response: [],
  };
};

const loginItem = (
  name: string,
  emailVariable: string,
  role: 'CUSTOMER' | 'STAFF',
): PostmanItem => ({
  name,
  event: [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          "pm.test('signed in', () => pm.response.to.have.status(200));",
          `pm.test('role is ${role}', () => pm.expect(pm.response.json().data.role).to.eql('${role}'));`,
          "pm.collectionVariables.set('userId', pm.response.json().data.id);",
        ],
      },
    },
  ],
  request: {
    method: 'POST',
    header: [{ key: 'Content-Type', value: 'application/json' }],
    body: {
      mode: 'raw',
      raw: JSON.stringify({ email: `{{${emailVariable}}}`, password: '{{demoPassword}}' }, null, 2),
      options: { raw: { language: 'json' } },
    },
    url: {
      raw: '{{baseUrl}}/api/auth/login',
      host: ['{{baseUrl}}'],
      path: ['api', 'auth', 'login'],
    },
    description: `Signs in as the demo ${role.toLowerCase()}. Postman keeps the session cookie and sends it with every later request. Only one session exists at a time: signing in as the other role replaces it.`,
  },
  response: [],
});

const COLLECTION_VARIABLES: [string, string][] = [
  ['baseUrl', 'http://localhost:4000'],
  ['customerEmail', 'amelia.hart@prestige.test'],
  ['staffEmail', 'staff1@prestige.test'],
  ['demoPassword', 'Prestige#2026'],
  ['userId', ''],
  ['vehicleId', ''],
  ['dealershipId', ''],
  ['slotId', ''],
  ['bookingId', ''],
  ['notificationId', ''],
  ['customerId', ''],
  ['imageId', ''],
];

export const buildCollection = (spec: Node) => {
  const tags = (spec.tags as Node[]).map(tag => String(tag.name));
  const folders = new Map<string, PostmanItem[]>(tags.map(tag => [tag, []]));
  for (const [pathName, pathItem] of Object.entries(spec.paths as Node)) {
    for (const method of METHODS.filter(name => isNode(pathItem) && name in pathItem)) {
      const operation = (pathItem as Node)[method] as Node;
      const tag = String((operation.tags as unknown[])[0]);
      folders.get(tag)?.push(buildRequest(spec, pathName, method, operation));
    }
  }
  const info = spec.info as Node;
  return {
    info: {
      name: `${String(info.title)} (local)`,
      description: [
        String(info.description).trim(),
        '',
        'Start with the "Sign in" folder: choose the customer or the staff login, then use the other folders.',
        'Run `npm run db:seed` first; it creates the demo accounts used by this collection.',
      ].join('\n'),
      schema: COLLECTION_SCHEMA,
    },
    variable: COLLECTION_VARIABLES.map(([key, value]) => ({ key, value })),
    item: [
      {
        name: 'Sign in',
        item: [
          loginItem('Sign in as customer', 'customerEmail', 'CUSTOMER'),
          loginItem('Sign in as staff', 'staffEmail', 'STAFF'),
          {
            name: 'Sign out',
            request: {
              method: 'POST',
              header: [],
              url: {
                raw: '{{baseUrl}}/api/auth/logout',
                host: ['{{baseUrl}}'],
                path: ['api', 'auth', 'logout'],
              },
            },
            response: [],
          },
        ],
      },
      ...[...folders.entries()].map(([name, item]) => ({ name, item })),
    ],
  };
};

export const buildEnvironment = (name: string, baseUrl: string) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  values: [
    ['baseUrl', baseUrl],
    ['customerEmail', 'amelia.hart@prestige.test'],
    ['staffEmail', 'staff1@prestige.test'],
    ['demoPassword', 'Prestige#2026'],
  ].map(([key, value]) => ({
    key,
    value,
    type: key === 'demoPassword' ? 'secret' : 'default',
    enabled: true,
  })),
  _postman_variable_scope: 'environment',
});

export const OUTPUT_FILES = {
  collection: path.join(DOCS_DIR, 'postman-collection.json'),
  apiEnvironment: path.join(DOCS_DIR, 'postman-environment-local-api.json'),
  webEnvironment: path.join(DOCS_DIR, 'postman-environment-local-web.json'),
};

export const renderOutputs = (): Record<keyof typeof OUTPUT_FILES, string> => ({
  collection: `${JSON.stringify(buildCollection(loadSpec()), null, 2)}\n`,
  apiEnvironment: `${JSON.stringify(
    buildEnvironment('Prestige Local (API on port 4000)', 'http://localhost:4000'),
    null,
    2,
  )}\n`,
  webEnvironment: `${JSON.stringify(
    buildEnvironment('Prestige Local (web proxy on port 3000)', 'http://localhost:3000'),
    null,
    2,
  )}\n`,
});

if (require.main === module) {
  const outputs = renderOutputs();
  for (const key of Object.keys(OUTPUT_FILES) as (keyof typeof OUTPUT_FILES)[]) {
    fs.writeFileSync(OUTPUT_FILES[key], outputs[key]);
    console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_FILES[key])}`);
  }
}
