import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const WEB_URL = 'http://localhost:3100';
export const SEED_PASSWORD = 'Prestige#2026';
const STAFF_EMAIL = 'staff1@prestige.test';
const HOUR_MS = 3_600_000;

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

/** Calls the API through the web origin (like the browser does) and unwraps the envelope. */
export async function call<T>(
  api: APIRequestContext,
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  path: string,
  data?: unknown,
): Promise<{ status: number; body: Envelope<T> }> {
  const response = await api[method](`${WEB_URL}${path}`, data === undefined ? {} : { data });
  return { status: response.status(), body: (await response.json()) as Envelope<T> };
}

export async function ok<T>(
  api: APIRequestContext,
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  path: string,
  data?: unknown,
): Promise<T> {
  const { status, body } = await call<T>(api, method, path, data);
  expect(
    status,
    `${method.toUpperCase()} ${path} -> ${JSON.stringify(body.error ?? body)}`,
  ).toBeLessThan(300);
  return body.data;
}

export async function apiAs(email: string, password = SEED_PASSWORD): Promise<APIRequestContext> {
  const api = await playwrightRequest.newContext();
  await ok(api, 'post', '/api/auth/login', { email, password });
  return api;
}

export const staffApi = (): Promise<APIRequestContext> => apiAs(STAFF_EMAIL);

export interface TestCustomer {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  api: APIRequestContext;
}

let counter = 0;

/** Registers a brand-new customer (signed in on the returned API context). */
export async function newCustomer(label: string, withLicence = true): Promise<TestCustomer> {
  counter += 1;
  const stamp = `${Date.now().toString(36)}${counter}`;
  const customer = {
    email: `e2e.${label}.${stamp}@example.test`,
    password: 'Prestige#2026',
    firstName: 'Eliza',
    lastName: `${label.charAt(0).toUpperCase()}${label.slice(1)}${counter}`,
  };
  const api = await playwrightRequest.newContext();
  await ok(api, 'post', '/api/auth/register', {
    ...customer,
    confirmPassword: customer.password,
    phone: '+44 7700 900123',
    ...(withLicence ? { drivingLicenseNumber: `E2E${stamp}`.toUpperCase().slice(0, 16) } : {}),
  });
  return { ...customer, api };
}

/** A browser context that is already signed in as the given API context's user. */
export async function contextFor(
  browser: Browser,
  api: APIRequestContext,
): Promise<BrowserContext> {
  return browser.newContext({ storageState: await api.storageState() });
}

export interface VehicleRow {
  id: string;
  manufacturer: string;
  model: string;
  vehicleType: string;
  fuelType: string;
  name: string;
}

export async function publicVehicles(api: APIRequestContext): Promise<VehicleRow[]> {
  const page = await ok<{ items: VehicleRow[] }>(
    api,
    'get',
    '/api/vehicles?pageSize=50&sort=manufacturerAsc&availableOnly=true',
  );
  return page.items.map(item => ({ ...item, name: `${item.manufacturer} ${item.model}` }));
}

export interface SlotRow {
  id: string;
  startAt: string;
  endAt: string;
  dealership: { id: string; name: string; city: string };
}

/** Free slots of a vehicle from tomorrow on, earliest first. */
export async function freeSlots(
  api: APIRequestContext,
  vehicleId: string,
  fromDays = 2,
): Promise<SlotRow[]> {
  const from = new Date(Date.now() + fromDays * 24 * HOUR_MS).toISOString();
  const to = new Date(Date.now() + 30 * 24 * HOUR_MS).toISOString();
  const data = await ok<{ slotsByDate: Record<string, SlotRow[]> }>(
    api,
    'get',
    `/api/vehicles/${vehicleId}/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  return Object.values(data.slotsByDate).flat();
}

export async function book(
  customer: TestCustomer,
  slotId: string,
  note?: string,
): Promise<{ id: string }> {
  return ok(customer.api, 'post', '/api/bookings', {
    slotId,
    customerNote: note ?? 'End-to-end test booking',
  });
}

/**
 * Creates a one-hour slot for a vehicle at a showroom starting between `minHours` and `maxHours`
 * from now, trying each whole hour until one does not clash with an existing slot.
 */
export async function createSlotBetween(
  staff: APIRequestContext,
  target: { dealershipId: string; vehicleId: string },
  minHours: number,
  maxHours: number,
): Promise<SlotRow> {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  for (let offset = minHours; offset <= maxHours; offset += 1) {
    const start = new Date(base.getTime() + offset * HOUR_MS);
    const { status, body } = await call<SlotRow>(staff, 'post', '/api/admin/slots', {
      ...target,
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + HOUR_MS).toISOString(),
    });
    if (status === 201) return body.data;
  }
  throw new Error(`No free hour between ${minHours} and ${maxHours} hours from now`);
}

export async function dealershipsOf(
  api: APIRequestContext,
  vehicleId: string,
): Promise<{ id: string; name: string }[]> {
  const vehicle = await ok<{ dealerships: { id: string; name: string }[] }>(
    api,
    'get',
    `/api/vehicles/${vehicleId}`,
  );
  return vehicle.dealerships;
}

/** A form control by its label text, ignoring the required-field asterisk. */
export const labelled = (page: Page, text: string) => {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, match => `\\${match}`);
  return page.getByLabel(new RegExp(`^${escaped}\\s*\\*?$`));
};

export const tomorrowPlus = (days: number): string => {
  const date = new Date(Date.now() + days * 24 * HOUR_MS);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
