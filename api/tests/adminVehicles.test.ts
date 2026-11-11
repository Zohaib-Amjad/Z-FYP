import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { authCookie } from './helpers/auth';
import {
  createBooking,
  createDealership,
  createSlot,
  createVehicle,
  linkVehicle,
  resetDatabase,
  seedMinimalData,
} from './helpers/db';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let staffCookie: string;
let customerCookie: string;

const validBody = {
  manufacturer: 'Aston Martin',
  model: 'Vantage',
  year: 2025,
  vehicleType: 'SPORTS',
  fuelType: 'PETROL',
  transmission: 'AUTOMATIC',
  engine: '4.0L twin-turbo V8',
  powerHp: 656,
  topSpeedKmh: 325,
  acceleration0to100: 3.5,
  seats: 2,
  color: 'Lunar White',
  priceFrom: 165000,
  description: 'A razor-sharp British sports car with a muscular V8.',
  features: ['Launch control', 'Bowers & Wilkins audio'],
  availabilityNote: 'Available by appointment',
};

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  staffCookie = authCookie(data.staff);
  customerCookie = authCookie(data.customer);
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const staffGet = (url: string) => request(app).get(url).set('Cookie', staffCookie);
const staffPost = (url: string, body: object) =>
  request(app).post(url).set('Cookie', staffCookie).send(body);
const staffPatch = (url: string, body: object = {}) =>
  request(app).patch(url).set('Cookie', staffCookie).send(body);
const fieldsOf = (res: request.Response): string[] =>
  res.body.error.details.map((d: { field: string }) => d.field);
const messageFor = (res: request.Response, field: string): string =>
  res.body.error.details.find((d: { field: string }) => d.field === field)?.message;

describe('access control', () => {
  const id = '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11';
  const send = (method: string, url: string): request.Test =>
    method === 'get'
      ? request(app).get(url)
      : method === 'post'
        ? request(app).post(url)
        : request(app).patch(url);
  const calls: [string, string][] = [
    ['get', '/api/admin/vehicles'],
    ['get', `/api/admin/vehicles/${id}`],
    ['post', '/api/admin/vehicles'],
    ['patch', `/api/admin/vehicles/${id}`],
    ['patch', `/api/admin/vehicles/${id}/deactivate`],
    ['patch', `/api/admin/vehicles/${id}/activate`],
  ];

  it.each(calls)('%s %s requires authentication', async (method, url) => {
    expect((await send(method, url)).status).toBe(401);
  });

  it.each(calls)('%s %s is forbidden to customers', async (method, url) => {
    expect((await send(method, url).set('Cookie', customerCookie)).status).toBe(403);
  });
});

describe('POST /api/admin/vehicles', () => {
  it('creates an active vehicle with every specification field', async () => {
    const res = await staffPost('/api/admin/vehicles', validBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ...validBody,
      isActive: true,
      acceleration0to100: 3.5,
      priceFrom: 165000,
    });
    expect(await prisma.vehicle.count()).toBe(2);
  });

  it('returns decimals as numbers, not strings', async () => {
    const res = await staffPost('/api/admin/vehicles', validBody);

    expect(typeof res.body.data.acceleration0to100).toBe('number');
    expect(typeof res.body.data.priceFrom).toBe('number');
  });

  it('treats the optional fields as optional', async () => {
    const res = await staffPost('/api/admin/vehicles', {
      manufacturer: 'Ferrari',
      model: 'Roma',
      year: 2024,
      vehicleType: 'COUPE',
      fuelType: 'PETROL',
      transmission: 'DUAL_CLUTCH',
      engine: '3.9L twin-turbo V8',
      powerHp: 612,
      seats: 2,
      color: 'Rosso Corsa',
      description: 'La Nuova Dolce Vita.',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      topSpeedKmh: null,
      acceleration0to100: null,
      priceFrom: null,
      availabilityNote: null,
      features: [],
    });
  });

  it('trims and de-duplicates features, ignoring case', async () => {
    const res = await staffPost('/api/admin/vehicles', {
      ...validBody,
      features: ['  Launch control ', 'launch control', 'Carbon seats', 'LAUNCH CONTROL'],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.features).toEqual(['Launch control', 'Carbon seats']);
  });

  it('trims text fields', async () => {
    const res = await staffPost('/api/admin/vehicles', {
      ...validBody,
      manufacturer: '  Aston Martin ',
      model: ' Vantage  ',
    });

    expect(res.body.data).toMatchObject({ manufacturer: 'Aston Martin', model: 'Vantage' });
  });

  it.each([
    'manufacturer',
    'model',
    'year',
    'vehicleType',
    'fuelType',
    'transmission',
    'engine',
    'powerHp',
    'seats',
    'color',
    'description',
  ])('requires %s', async field => {
    const res = await staffPost('/api/admin/vehicles', { ...validBody, [field]: undefined });

    expect(res.status).toBe(422);
    expect(fieldsOf(res)).toContain(field);
  });

  describe('year', () => {
    const nextYear = new Date().getFullYear() + 1;

    it.each([
      [1990, 201],
      [nextYear, 201],
      [1989, 422],
      [nextYear + 1, 422],
      [2024.5, 422],
    ])('year %s -> %s', async (year, status) => {
      const res = await staffPost('/api/admin/vehicles', { ...validBody, year });

      expect(res.status).toBe(status);
    });
  });

  it.each([
    ['powerHp', 0],
    ['powerHp', -5],
    ['seats', 0],
    ['seats', 10],
    ['seats', 2.5],
    ['topSpeedKmh', 0],
    ['acceleration0to100', 0],
    ['acceleration0to100', 3.555],
    ['priceFrom', -1],
    ['priceFrom', 1000.123],
  ])('rejects %s = %s', async (field, value) => {
    const res = await staffPost('/api/admin/vehicles', { ...validBody, [field]: value });

    expect(res.status).toBe(422);
    expect(fieldsOf(res)).toContain(field);
  });

  it('accepts seats from 1 to 9', async () => {
    expect((await staffPost('/api/admin/vehicles', { ...validBody, seats: 1 })).status).toBe(201);
    expect((await staffPost('/api/admin/vehicles', { ...validBody, seats: 9 })).status).toBe(201);
  });

  it('limits features to 20 short entries', async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `Feature ${i}`);
    const exactly20 = Array.from({ length: 20 }, (_, i) => `Feature ${i}`);

    expect(
      (await staffPost('/api/admin/vehicles', { ...validBody, features: tooMany })).status,
    ).toBe(422);
    expect(
      (await staffPost('/api/admin/vehicles', { ...validBody, features: exactly20 })).status,
    ).toBe(201);
    const long = await staffPost('/api/admin/vehicles', {
      ...validBody,
      features: ['x'.repeat(61)],
    });
    const blank = await staffPost('/api/admin/vehicles', { ...validBody, features: ['  '] });
    expect(long.status).toBe(422);
    expect(blank.status).toBe(422);
  });

  it('explains which enum values are allowed', async () => {
    const res = await staffPost('/api/admin/vehicles', {
      ...validBody,
      vehicleType: 'TRUCK',
      fuelType: 'STEAM',
      transmission: 'CVT',
    });

    expect(res.status).toBe(422);
    expect(messageFor(res, 'vehicleType')).toContain('SEDAN, SUV, COUPE');
    expect(messageFor(res, 'fuelType')).toContain('PLUG_IN_HYBRID');
    expect(messageFor(res, 'transmission')).toContain('DUAL_CLUTCH');
  });

  it('rejects wrong types and unknown fields', async () => {
    const res = await staffPost('/api/admin/vehicles', {
      ...validBody,
      powerHp: '656',
      isActive: false,
      id: 'x',
    });

    expect(res.status).toBe(422);
    expect(fieldsOf(res)).toEqual(expect.arrayContaining(['powerHp', 'isActive', 'id']));
  });
});

describe('GET /api/admin/vehicles', () => {
  beforeEach(async () => {
    await createVehicle({
      manufacturer: 'Ferrari',
      model: 'Roma Spider',
      year: 2023,
      vehicleType: 'CONVERTIBLE',
      fuelType: 'PETROL',
      powerHp: 612,
      priceFrom: 230000,
      color: 'Rosso Corsa',
      isActive: false,
    });
    const audi = await createVehicle({
      manufacturer: 'Audi',
      model: 'RS e-tron GT',
      year: 2025,
      vehicleType: 'GRAND_TOURER',
      fuelType: 'ELECTRIC',
      powerHp: 637,
      priceFrom: null,
    });
    const other = await createDealership('Prestige Deansgate', 'Manchester');
    await linkVehicle(other.id, audi.id);
  });

  it('includes inactive vehicles with the primary image and dealership count', async () => {
    await prisma.vehicleImage.create({
      data: {
        vehicleId: data.vehicle.id,
        url: '/uploads/seed/a.svg',
        altText: 'Porsche',
        isPrimary: true,
        sortOrder: 1,
      },
    });
    const res = await staffGet('/api/admin/vehicles?pageSize=50');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3);
    const porsche = res.body.data.items.find((v: { id: string }) => v.id === data.vehicle.id);
    expect(porsche).toMatchObject({
      dealershipCount: 1,
      primaryImage: { url: '/uploads/seed/a.svg', isPrimary: true },
    });
    expect(res.body.data.items.some((v: { isActive: boolean }) => !v.isActive)).toBe(true);
  });

  it('searches by manufacturer, model, colour and engine across several words', async () => {
    const byMake = await staffGet('/api/admin/vehicles?q=ferrari');
    const byModel = await staffGet('/api/admin/vehicles?q=E-TRON');
    const byColour = await staffGet('/api/admin/vehicles?q=rosso');
    const byWords = await staffGet('/api/admin/vehicles?q=porsche%20carrera');
    const mismatch = await staffGet('/api/admin/vehicles?q=porsche%20ferrari');

    expect(byMake.body.data.total).toBe(1);
    expect(byModel.body.data.items[0].manufacturer).toBe('Audi');
    expect(byColour.body.data.items[0].manufacturer).toBe('Ferrari');
    expect(byWords.body.data.total).toBe(1);
    expect(mismatch.body.data.total).toBe(0);
  });

  it('filters by manufacturer, type, fuel, active status and dealership', async () => {
    const byManufacturer = await staffGet('/api/admin/vehicles?manufacturer=PORSCHE');
    const byType = await staffGet('/api/admin/vehicles?vehicleType=CONVERTIBLE');
    const byFuel = await staffGet('/api/admin/vehicles?fuelType=ELECTRIC');
    const inactive = await staffGet('/api/admin/vehicles?isActive=false');
    const byDealership = await staffGet(`/api/admin/vehicles?dealershipId=${data.dealership.id}`);

    expect(
      byManufacturer.body.data.items.map((v: { manufacturer: string }) => v.manufacturer),
    ).toEqual(['Porsche']);
    expect(byType.body.data.items.map((v: { manufacturer: string }) => v.manufacturer)).toEqual([
      'Ferrari',
    ]);
    expect(byFuel.body.data.items.map((v: { manufacturer: string }) => v.manufacturer)).toEqual([
      'Audi',
    ]);
    expect(inactive.body.data.items.map((v: { manufacturer: string }) => v.manufacturer)).toEqual([
      'Ferrari',
    ]);
    expect(byDealership.body.data.items.map((v: { id: string }) => v.id)).toEqual([
      data.vehicle.id,
    ]);
  });

  it('combines filters', async () => {
    const res = await staffGet('/api/admin/vehicles?fuelType=PETROL&isActive=true');

    expect(res.body.data.items.map((v: { manufacturer: string }) => v.manufacturer)).toEqual([
      'Porsche',
    ]);
  });

  it('paginates', async () => {
    const first = await staffGet(
      '/api/admin/vehicles?pageSize=2&page=1&sortBy=manufacturer&sortOrder=asc',
    );
    const second = await staffGet(
      '/api/admin/vehicles?pageSize=2&page=2&sortBy=manufacturer&sortOrder=asc',
    );

    expect(first.body.data).toMatchObject({ total: 3, totalPages: 2 });
    expect(first.body.data.items.map((v: { manufacturer: string }) => v.manufacturer)).toEqual([
      'Audi',
      'Ferrari',
    ]);
    expect(second.body.data.items.map((v: { manufacturer: string }) => v.manufacturer)).toEqual([
      'Porsche',
    ]);
  });

  it('sorts by year, power and price with missing prices last', async () => {
    const byYear = await staffGet('/api/admin/vehicles?sortBy=year&sortOrder=asc');
    const byPower = await staffGet('/api/admin/vehicles?sortBy=powerHp&sortOrder=desc');
    const priceAsc = await staffGet('/api/admin/vehicles?sortBy=priceFrom&sortOrder=asc');
    const priceDesc = await staffGet('/api/admin/vehicles?sortBy=priceFrom&sortOrder=desc');

    expect(byYear.body.data.items[0].year).toBe(2023);
    expect(byPower.body.data.items[0].powerHp).toBe(637);
    expect(priceAsc.body.data.items.at(-1).priceFrom).toBeNull();
    expect(priceDesc.body.data.items.at(-1).priceFrom).toBeNull();
  });

  it('rejects invalid filters and sorts with 422', async () => {
    const badSort = await staffGet('/api/admin/vehicles?sortBy=description');
    const badEnum = await staffGet('/api/admin/vehicles?fuelType=STEAM');
    const badId = await staffGet('/api/admin/vehicles?dealershipId=abc');
    const badSize = await staffGet('/api/admin/vehicles?pageSize=51');

    expect([badSort.status, badEnum.status, badId.status, badSize.status]).toEqual([
      422, 422, 422, 422,
    ]);
    expect(messageFor(badEnum, 'fuelType')).toContain('PETROL');
  });
});

describe('GET /api/admin/vehicles/:id', () => {
  it('returns the full record with ordered images and dealerships', async () => {
    const other = await createDealership('Prestige Deansgate', 'Manchester', { isActive: false });
    await linkVehicle(other.id, data.vehicle.id, false);
    await prisma.vehicleImage.createMany({
      data: [
        { vehicleId: data.vehicle.id, url: '/uploads/seed/b.svg', altText: 'B', sortOrder: 2 },
        {
          vehicleId: data.vehicle.id,
          url: '/uploads/seed/a.svg',
          altText: 'A',
          isPrimary: true,
          sortOrder: 1,
        },
      ],
    });
    await createBooking(data.customer.id, data.slot.id, 'PENDING');
    const res = await staffGet(`/api/admin/vehicles/${data.vehicle.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: data.vehicle.id,
      manufacturer: 'Porsche',
      features: ['Sport Chrono package'],
      upcomingActiveBookingCount: 1,
    });
    expect(res.body.data.images.map((i: { url: string }) => i.url)).toEqual([
      '/uploads/seed/a.svg',
      '/uploads/seed/b.svg',
    ]);
    expect(res.body.data.dealerships).toEqual([
      {
        id: other.id,
        name: 'Prestige Deansgate',
        city: 'Manchester',
        isActive: false,
        isAvailable: false,
      },
      {
        id: data.dealership.id,
        name: 'Prestige Mayfair',
        city: 'London',
        isActive: true,
        isAvailable: true,
      },
    ]);
  });

  it('returns 404 for unknown ids and 422 for malformed ones', async () => {
    expect(
      (await staffGet('/api/admin/vehicles/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).status,
    ).toBe(404);
    expect((await staffGet('/api/admin/vehicles/xyz')).status).toBe(422);
  });
});

describe('PATCH /api/admin/vehicles/:id', () => {
  const url = () => `/api/admin/vehicles/${data.vehicle.id}`;

  it('updates any field with the same validation', async () => {
    const res = await staffPatch(url(), {
      manufacturer: 'Porsche AG',
      model: '911 Carrera S',
      year: 2024,
      vehicleType: 'SPORTS',
      fuelType: 'HYBRID',
      transmission: 'DUAL_CLUTCH',
      engine: '3.6L hybrid flat-six',
      powerHp: 541,
      topSpeedKmh: 312,
      acceleration0to100: 3.2,
      seats: 4,
      color: 'Racing Yellow',
      priceFrom: 150000,
      description: 'An even sharper 911 with hybrid assistance.',
      features: ['Sport Chrono', 'sport chrono', 'Rear-axle steering'],
      availabilityNote: 'Arriving next month',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      model: '911 Carrera S',
      fuelType: 'HYBRID',
      powerHp: 541,
      acceleration0to100: 3.2,
      features: ['Sport Chrono', 'Rear-axle steering'],
      availabilityNote: 'Arriving next month',
    });
  });

  it('supports partial updates and clearing optional fields with null', async () => {
    await prisma.vehicle.update({
      where: { id: data.vehicle.id },
      data: { priceFrom: 100000, availabilityNote: 'Soon' },
    });
    const res = await staffPatch(url(), { priceFrom: null, availabilityNote: null });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      priceFrom: null,
      availabilityNote: null,
      model: '911 Carrera T',
    });
  });

  it('can replace the feature list with an empty one', async () => {
    const res = await staffPatch(url(), { features: [] });

    expect(res.body.data.features).toEqual([]);
  });

  it('validates fields', async () => {
    const res = await staffPatch(url(), {
      year: 1980,
      powerHp: 0,
      seats: 12,
      vehicleType: 'TRUCK',
    });

    expect(res.status).toBe(422);
    expect(fieldsOf(res)).toEqual(
      expect.arrayContaining(['year', 'powerHp', 'seats', 'vehicleType']),
    );
  });

  it('rejects empty bodies and unknown fields such as isActive', async () => {
    expect((await staffPatch(url(), {})).status).toBe(422);
    const res = await staffPatch(url(), { isActive: false });
    expect(res.status).toBe(422);
    const stored = await prisma.vehicle.findUniqueOrThrow({ where: { id: data.vehicle.id } });
    expect(stored.isActive).toBe(true);
  });

  it('returns 404 for an unknown vehicle', async () => {
    const res = await staffPatch('/api/admin/vehicles/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11', {
      color: 'Blue',
    });

    expect(res.status).toBe(404);
  });
});

describe('deactivate and activate', () => {
  const deactivate = (id = data.vehicle.id) => staffPatch(`/api/admin/vehicles/${id}/deactivate`);
  const activate = (id = data.vehicle.id) => staffPatch(`/api/admin/vehicles/${id}/activate`);

  it('deactivates a vehicle without upcoming bookings', async () => {
    const res = await deactivate();

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    const stillVisible = await staffGet(`/api/admin/vehicles/${data.vehicle.id}`);
    expect(stillVisible.body.data.isActive).toBe(false);
  });

  it.each(['PENDING', 'APPROVED', 'RESCHEDULED'] as const)(
    'is blocked by a future %s booking with the count',
    async status => {
      const second = await createSlot(data, 6, 10);
      await createBooking(data.customer.id, data.slot.id, status);
      await createBooking(data.customer.id, second.id, 'PENDING');
      const res = await deactivate();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('HAS_ACTIVE_BOOKINGS');
      expect(res.body.error.message).toContain('2 upcoming active bookings');
      expect(res.body.error.details).toEqual([{ field: 'activeBookingCount', message: '2' }]);
      const stored = await prisma.vehicle.findUniqueOrThrow({ where: { id: data.vehicle.id } });
      expect(stored.isActive).toBe(true);
    },
  );

  it('counts bookings at every dealership offering the vehicle', async () => {
    const other = await createDealership('Prestige Deansgate', 'Manchester');
    await linkVehicle(other.id, data.vehicle.id);
    const elsewhere = await createSlot({ ...data, dealership: other }, 9, 14);
    await createBooking(data.customer.id, elsewhere.id, 'APPROVED');
    const res = await deactivate();

    expect(res.status).toBe(409);
  });

  it('is not blocked by past, final or other-vehicle bookings', async () => {
    const past = await createSlot(data, -3, 10);
    const cancelled = await createSlot(data, 5, 10);
    await createBooking(data.customer.id, past.id, 'APPROVED');
    await createBooking(data.customer.id, cancelled.id, 'CANCELLED');
    const otherVehicle = await createVehicle({ model: 'Flying Spur' });
    await linkVehicle(data.dealership.id, otherVehicle.id);
    const otherSlot = await createSlot({ ...data, vehicle: otherVehicle }, 7, 10);
    await createBooking(data.customer.id, otherSlot.id, 'PENDING');

    expect((await deactivate()).status).toBe(200);
  });

  it('is idempotent and can be reversed with activate', async () => {
    await deactivate();
    expect((await deactivate()).status).toBe(200);
    const res = await activate();

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
    expect((await activate()).status).toBe(200);
  });

  it('returns 404 for unknown vehicles', async () => {
    const id = '0bbe7e55-75e7-4355-b1e3-af30b7b9ee11';

    expect((await deactivate(id)).status).toBe(404);
    expect((await activate(id)).status).toBe(404);
  });

  it('has no hard delete', async () => {
    const res = await request(app)
      .delete(`/api/admin/vehicles/${data.vehicle.id}`)
      .set('Cookie', staffCookie);

    expect(res.status).toBe(404);
    expect(await prisma.vehicle.count({ where: { id: data.vehicle.id } })).toBe(1);
  });
});
