import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { parse } from 'yaml';
import { ZodEffects, ZodObject, ZodTypeAny } from 'zod';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { createDocsRouter, loadOpenApiDocument } from '../src/routes/docs.routes';
import {
  approveSchema,
  cancelSchema,
  completeSchema,
  rejectSchema,
  rescheduleSchema,
} from '../src/validators/bookingAction.validators';
import { adminBookingsQuerySchema } from '../src/validators/adminBooking.validators';
import { createBookingSchema } from '../src/validators/booking.validators';
import { catalogQuerySchema } from '../src/validators/catalog.validators';
import { paginationQuerySchema } from '../src/validators/common';
import {
  customerListQuerySchema,
  customerStatusSchema,
} from '../src/validators/customer.validators';
import {
  summaryQuerySchema,
  topVehiclesQuerySchema,
  trendQuerySchema,
} from '../src/validators/dashboard.validators';
import {
  adminDealershipQuerySchema,
  createDealershipSchema,
  publicDealershipQuerySchema,
  updateDealershipSchema,
} from '../src/validators/dealership.validators';
import {
  cancelMyBookingSchema,
  myBookingsQuerySchema,
} from '../src/validators/myBooking.validators';
import { notificationsQuerySchema } from '../src/validators/notification.validators';
import { changePasswordSchema, updateProfileSchema } from '../src/validators/profile.validators';
import {
  adminSlotQuerySchema,
  availableSlotsQuerySchema,
  bulkQuerySchema,
  bulkSlotsSchema,
  createSlotSchema,
  updateSlotSchema,
} from '../src/validators/slot.validators';
import { createStaffSchema, loginSchema, registerSchema } from '../src/validators/auth.validators';
import {
  adminVehicleQuerySchema,
  createVehicleSchema,
  replaceDealershipsSchema,
  updateImageSchema,
  updateVehicleSchema,
} from '../src/validators/vehicle.validators';
import { authCookie } from './helpers/auth';
import {
  createBookingAt,
  createCustomer,
  createDealership,
  createVehicle,
  linkVehicle,
  resetDatabase,
  seedMinimalData,
} from './helpers/db';
import {
  AppRoute,
  PUBLIC_ROUTES,
  audienceOf,
  listRoutes,
  routeLabel,
  toOpenApiPath,
} from './helpers/routes';
import { addSlot, utcInstant } from './helpers/slots';

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const document = parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'openapi.yaml'), 'utf8'),
) as Node;
const routes = listRoutes(createApp());

const lookup = (ref: string): Node => {
  let current: unknown = document;
  for (const part of ref.replace(/^#\//, '').split('/')) {
    current = isNode(current) ? current[part] : undefined;
  }
  if (!isNode(current)) throw new Error(`Unresolved reference ${ref}`);
  return current;
};

const resolved = (node: unknown): Node => {
  let current = node;
  while (isNode(current) && typeof current.$ref === 'string') current = lookup(current.$ref);
  if (!isNode(current)) throw new Error('Expected an object');
  return current;
};

const operationOf = (route: AppRoute): Node => {
  const paths = document.paths as Node;
  return (paths[toOpenApiPath(route.path)] as Node)[route.method] as Node;
};

const responsesOf = (route: AppRoute): Node => operationOf(route).responses as Node;

const propertyNames = (schema: unknown): string[] => {
  const node = resolved(schema);
  const own = isNode(node.properties) ? Object.keys(node.properties) : [];
  const inherited = Array.isArray(node.allOf)
    ? node.allOf.flatMap(part => propertyNames(part))
    : [];
  return [...new Set([...own, ...inherited])];
};

const itemSchemaOf = (schema: unknown): unknown => {
  const node = resolved(schema);
  if (isNode(node.items)) return node.items;
  if (Array.isArray(node.allOf)) {
    for (const part of node.allOf) {
      const found = itemSchemaOf(part);
      if (found) return found;
    }
  }
  if (isNode(node.properties) && isNode(node.properties.items))
    return itemSchemaOf(node.properties.items);
  return undefined;
};

const dataSchemaOf = (route: AppRoute): unknown => {
  const response = resolved(responsesOf(route)['200']);
  const content = (response.content as Node)['application/json'] as Node;
  return (resolved(content.schema).properties as Node).data;
};

const shapeKeys = (schema: ZodTypeAny): string[] => {
  let current: ZodTypeAny = schema;
  while (current instanceof ZodEffects) current = current.innerType();
  if (!(current instanceof ZodObject)) throw new Error('Expected an object schema');
  return Object.keys(current.shape);
};

const QUERY_SCHEMAS: Record<string, ZodTypeAny> = {
  'GET /api/vehicles': catalogQuerySchema,
  'GET /api/vehicles/:vehicleId/slots': availableSlotsQuerySchema,
  'GET /api/dealerships': publicDealershipQuerySchema,
  'GET /api/admin/dealerships': adminDealershipQuerySchema,
  'GET /api/admin/vehicles': adminVehicleQuerySchema,
  'GET /api/admin/slots': adminSlotQuerySchema,
  'POST /api/admin/slots/bulk': bulkQuerySchema,
  'GET /api/admin/customers': customerListQuerySchema,
  'GET /api/admin/bookings': adminBookingsQuerySchema,
  'GET /api/bookings/mine': myBookingsQuerySchema,
  'GET /api/notifications': notificationsQuerySchema,
  'GET /api/admin/dashboard/summary': summaryQuerySchema,
  'GET /api/admin/dashboard/bookings-trend': trendQuerySchema,
  'GET /api/admin/dashboard/top-vehicles': topVehiclesQuerySchema,
  'GET /api/staff': paginationQuerySchema,
};

const BODY_SCHEMAS: Record<string, ZodTypeAny> = {
  'POST /api/auth/register': registerSchema,
  'POST /api/auth/login': loginSchema,
  'PATCH /api/profile': updateProfileSchema,
  'PATCH /api/profile/password': changePasswordSchema,
  'POST /api/staff': createStaffSchema,
  'POST /api/bookings': createBookingSchema,
  'PATCH /api/bookings/:id/cancel': cancelMyBookingSchema,
  'PATCH /api/admin/bookings/:id/approve': approveSchema,
  'PATCH /api/admin/bookings/:id/reject': rejectSchema,
  'PATCH /api/admin/bookings/:id/reschedule': rescheduleSchema,
  'PATCH /api/admin/bookings/:id/cancel': cancelSchema,
  'PATCH /api/admin/bookings/:id/complete': completeSchema,
  'PATCH /api/admin/customers/:id/status': customerStatusSchema,
  'POST /api/admin/vehicles': createVehicleSchema,
  'PATCH /api/admin/vehicles/:id': updateVehicleSchema,
  'PUT /api/admin/vehicles/:id/dealerships': replaceDealershipsSchema,
  'PATCH /api/admin/vehicles/:id/images/:imageId': updateImageSchema,
  'POST /api/admin/dealerships': createDealershipSchema,
  'PATCH /api/admin/dealerships/:id': updateDealershipSchema,
  'POST /api/admin/slots': createSlotSchema,
  'PATCH /api/admin/slots/:id': updateSlotSchema,
  'POST /api/admin/slots/bulk': bulkSlotsSchema,
};

describe('document structure', () => {
  it('is an OpenAPI 3 document with the usual metadata', () => {
    expect(String(document.openapi)).toMatch(/^3\./);
    expect(resolved(document.info).title).toBe('Prestige Test Drive API');
    expect(Array.isArray(document.servers) && document.servers.length).toBeGreaterThanOrEqual(1);
    expect(resolved(resolved(document.components).securitySchemes).cookieAuth).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'td_session',
    });
  });

  it('resolves every $reference', () => {
    const missing: string[] = [];
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (isNode(value)) {
        if (typeof value.$ref === 'string') {
          try {
            lookup(value.$ref);
          } catch {
            missing.push(value.$ref);
          }
        }
        Object.values(value).forEach(visit);
      }
    };
    visit(document);

    expect(missing).toEqual([]);
  });

  it('uses every component it defines', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '..', 'openapi.yaml'), 'utf8');
    const components = document.components as Node;
    const unused: string[] = [];
    for (const group of ['schemas', 'responses', 'parameters']) {
      for (const name of Object.keys(components[group] as Node)) {
        if (!text.includes(`#/components/${group}/${name}'`)) unused.push(`${group}/${name}`);
      }
    }

    expect(unused).toEqual([]);
  });

  it('lists the error codes the API can return', () => {
    const codes = (resolved((document.components as Node).schemas as Node) as Node)
      .ErrorCode as Node;

    expect(codes.enum).toContain('SLOT_UNAVAILABLE');
    expect(codes.enum).toContain('INVALID_CURRENT_PASSWORD');
    expect(new Set(codes.enum as string[]).size).toBe((codes.enum as string[]).length);
  });
});

describe('the document and the real API describe the same endpoints', () => {
  const documented = (): string[] =>
    Object.entries(document.paths as Node).flatMap(([pathName, item]) =>
      Object.keys(item as Node)
        .filter(key => ['get', 'post', 'put', 'patch', 'delete'].includes(key))
        .map(method => `${method.toUpperCase()} ${pathName}`),
    );

  it('documents every real route', () => {
    const real = routes.map(route => `${route.method.toUpperCase()} ${toOpenApiPath(route.path)}`);

    expect(real.filter(item => !documented().includes(item))).toEqual([]);
  });

  it('documents nothing that does not exist', () => {
    const real = routes.map(route => `${route.method.toUpperCase()} ${toOpenApiPath(route.path)}`);

    expect(documented().filter(item => !real.includes(item))).toEqual([]);
    expect(documented()).toHaveLength(routes.length);
  });

  it.each(routes.map(routeLabel))('%s is documented completely', name => {
    const route = routes.find(r => routeLabel(r) === name)!;
    const operation = operationOf(route);
    const responses = responsesOf(route);
    const audience = audienceOf(route);
    const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];

    expect(operation.summary, 'summary').toBeTruthy();
    expect(Array.isArray(operation.tags) && operation.tags.length, 'tags').toBeGreaterThan(0);
    expect(
      Object.keys(responses).some(code => code.startsWith('2')),
      'a success response',
    ).toBe(true);

    if (PUBLIC_ROUTES.has(name)) expect(operation.security).toEqual([]);
    else expect(operation.security, 'inherits the cookie security').toBeUndefined();

    if (audience !== 'public') expect(responses['401'], '401').toBeDefined();
    if (audience === 'staff' || audience === 'customer')
      expect(responses['403'], '403').toBeDefined();
    if (parameters.length > 0 || operation.requestBody)
      expect(responses['422'], '422').toBeDefined();

    for (const response of Object.values(responses)) {
      const body = resolved(response);
      expect(body.description, 'every response is described').toBeTruthy();
    }

    const pathParameters = [...route.path.matchAll(/:(\w+)/g)].map(match => match[1]);
    const documentedPath = parameters
      .map(parameter => resolved(parameter))
      .filter(parameter => parameter.in === 'path')
      .map(parameter => parameter.name);
    expect(documentedPath.sort()).toEqual(pathParameters.sort());
  });
});

describe('requests', () => {
  it.each(Object.keys(QUERY_SCHEMAS))(
    '%s documents exactly the query parameters it accepts',
    name => {
      const route = routes.find(r => routeLabel(r) === name)!;
      const parameters = (operationOf(route).parameters as unknown[]) ?? [];
      const documentedNames = parameters
        .map(parameter => resolved(parameter))
        .filter(parameter => parameter.in === 'query')
        .map(parameter => String(parameter.name));

      expect(documentedNames.sort()).toEqual(shapeKeys(QUERY_SCHEMAS[name]).sort());
    },
  );

  it('documents no query parameters on routes that accept none', () => {
    for (const route of routes.filter(r => !QUERY_SCHEMAS[routeLabel(r)])) {
      const parameters = ((operationOf(route).parameters as unknown[]) ?? []).map(p => resolved(p));
      expect(
        parameters.filter(p => p.in === 'query'),
        routeLabel(route),
      ).toEqual([]);
    }
  });

  it.each(Object.keys(BODY_SCHEMAS))('%s has request examples the real schema accepts', name => {
    const route = routes.find(r => routeLabel(r) === name)!;
    const body = resolved(operationOf(route).requestBody);
    const json = (body.content as Node)['application/json'] as Node;
    const examples: unknown[] = isNode(json.examples)
      ? Object.values(json.examples).map(example => (example as Node).value)
      : [json.example];

    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      expect(example, 'an example is given').toBeDefined();
      const result = BODY_SCHEMAS[name].safeParse(example);
      expect(result.success, JSON.stringify(result.success ? '' : result.error.issues)).toBe(true);
    }
  });

  it('documents a request body for every write route that takes one', () => {
    const withBody = routes.filter(route => ['post', 'put', 'patch'].includes(route.method));
    const undocumented = withBody
      .filter(route => !operationOf(route).requestBody)
      .map(routeLabel)
      .filter(name => BODY_SCHEMAS[name]);

    expect(undocumented).toEqual([]);
    const upload = routes.find(r => routeLabel(r) === 'POST /api/admin/vehicles/:id/images')!;
    const content = resolved(operationOf(upload).requestBody).content as Node;
    expect(Object.keys(content)).toEqual(['multipart/form-data']);
  });
});

describe('responses match what the API really returns', () => {
  const app = createApp();
  let data: Awaited<ReturnType<typeof seedMinimalData>>;
  let bookingId: string;
  let notificationId: string;
  let staffCookie: string;
  let customerCookie: string;

  beforeAll(async () => {
    await resetDatabase();
    data = await seedMinimalData();
    staffCookie = authCookie(data.staff);
    customerCookie = authCookie(data.customer);
    await prisma.vehicleImage.create({
      data: {
        vehicleId: data.vehicle.id,
        url: '/uploads/x/1.png',
        altText: 'Front',
        isPrimary: true,
        sortOrder: 1,
      },
    });
    const other = await createCustomer(
      'isabella.rossi@example.test',
      'Isabella',
      'Rossi',
      '+44 7700 900555',
    );
    const audi = await createVehicle({ manufacturer: 'Audi', model: 'RS e-tron GT' });
    const manchester = await createDealership('Prestige Deansgate', 'Manchester');
    await linkVehicle(manchester.id, audi.id);
    await linkVehicle(data.dealership.id, audi.id);
    const target = { staff: data.staff, vehicle: data.vehicle, dealership: data.dealership };
    const booking = await createBookingAt({
      customerId: data.customer.id,
      target,
      status: 'APPROVED',
      slotStart: utcInstant(5, 10),
    });
    bookingId = booking.id;
    await prisma.bookingStatusHistory.createMany({
      data: [
        {
          bookingId,
          fromStatus: null,
          toStatus: 'PENDING',
          action: 'CREATED',
          changedById: data.customer.id,
        },
        {
          bookingId,
          fromStatus: 'PENDING',
          toStatus: 'APPROVED',
          action: 'APPROVED',
          changedById: data.staff.id,
        },
      ],
    });
    await createBookingAt({
      customerId: other.id,
      target,
      status: 'PENDING',
      slotStart: utcInstant(8, 10),
      createdAt: new Date(Date.now() - 48 * 3_600_000),
    });
    await createBookingAt({
      customerId: other.id,
      target,
      status: 'APPROVED',
      slotStart: utcInstant(-3, 10),
    });
    await addSlot({ staff: data.staff, vehicle: audi, dealership: manchester }, utcInstant(2, 10));
    const notification = await prisma.notification.create({
      data: {
        userId: data.customer.id,
        bookingId,
        type: 'BOOKING_APPROVED',
        title: 'Confirmed',
        message: 'Your test drive has been confirmed.',
      },
    });
    notificationId = notification.id;
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectPrisma();
  });

  const urlFor = (route: AppRoute): string =>
    route.path.replace(/:(\w+)/g, (_match, param: string) => {
      if (route.path === '/api/bookings/slots/:id') return data.slot.id;
      if (route.path.startsWith('/api/admin/bookings') || route.path.startsWith('/api/bookings'))
        return bookingId;
      if (route.path.startsWith('/api/notifications')) return notificationId;
      if (route.path.startsWith('/api/admin/customers')) return data.customer.id;
      if (route.path.startsWith('/api/admin/slots')) return data.slot.id;
      if (route.path.includes('dealerships/') && !route.path.includes('/vehicles/'))
        return data.dealership.id;
      if (route.path.startsWith('/api/dealerships')) return data.dealership.id;
      return param === 'imageId' ? data.vehicle.id : data.vehicle.id;
    });

  const cookieFor = (route: AppRoute): string | undefined => {
    const audience = audienceOf(route);
    return audience === 'public' ? undefined : audience === 'staff' ? staffCookie : customerCookie;
  };

  const readable = routes.filter(route => route.method === 'get');

  it.each(readable.map(routeLabel))('%s returns exactly the documented fields', async name => {
    const route = readable.find(r => routeLabel(r) === name)!;
    const req = request(app).get(urlFor(route));
    const cookie = cookieFor(route);
    const res = cookie ? await req.set('Cookie', cookie) : await req;
    expect(res.status).toBe(200);

    const schema = dataSchemaOf(route);
    const actual = res.body.data as unknown;
    const itemSchema = itemSchemaOf(schema);

    if (Array.isArray(actual)) {
      expect(actual.length, `${name} needs data in the fixture`).toBeGreaterThan(0);
      expect(Object.keys(actual[0] as Node).sort()).toEqual(propertyNames(itemSchema).sort());
      return;
    }
    expect(Object.keys(actual as Node).sort()).toEqual(propertyNames(schema).sort());
    const items = (actual as Node).items;
    if (Array.isArray(items)) {
      expect(items.length, `${name} needs data in the fixture`).toBeGreaterThan(0);
      expect(Object.keys(items[0] as Node).sort()).toEqual(propertyNames(itemSchema).sort());
    }
  });
});

describe('Swagger UI', () => {
  const docsApp = (): ReturnType<typeof createApp> => {
    const app = createApp();
    return app;
  };

  it('serves the interactive page and the document from its own router', async () => {
    const express = (await import('express')).default;
    const mini = express();
    mini.use('/api/docs', createDocsRouter());
    const page = await request(mini).get('/api/docs/');
    const json = await request(mini).get('/api/docs/openapi.json');

    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.text).toContain('swagger-ui');
    expect(page.text).toContain('Prestige Test Drive API');
    expect(page.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
    expect(json.status).toBe(200);
    expect(json.body.openapi).toBe(loadOpenApiDocument().openapi);
    expect(Object.keys(json.body.paths)).toHaveLength(Object.keys(document.paths as Node).length);
    const asset = await request(mini).get('/api/docs/swagger-ui-bundle.js');
    expect(asset.status).toBe(200);
  });

  it('is only mounted in development', async () => {
    const res = await request(docsApp()).get('/api/docs/');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('keeps the strict content security policy everywhere else', async () => {
    const res = await request(docsApp()).get('/api/health');

    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['content-security-policy']).not.toContain(
      "'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src",
    );
  });
});
