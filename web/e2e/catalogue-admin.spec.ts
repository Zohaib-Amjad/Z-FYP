import { expect, test, type Page } from '@playwright/test';
import {
  book,
  call,
  contextFor,
  labelled,
  createSlotBetween,
  newCustomer,
  ok,
  staffApi,
  tomorrowPlus,
} from './helpers';

// A 1x1 transparent PNG, enough to pass the upload checks.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const field = labelled;

test('E2E-09 staff create a vehicle with a photo, assign a showroom and generate slots; the customer sees them', async ({
  browser,
}) => {
  const staff = await staffApi();
  const model = `Aurora ${Date.now().toString(36)}`;
  const staffPage = await (await contextFor(browser, staff)).newPage();

  // Create the vehicle through the form.
  await staffPage.goto('/admin/vehicles/new');
  await field(staffPage, 'Manufacturer').fill('E2E Motors');
  await field(staffPage, 'Model').fill(model);
  await field(staffPage, 'Colour').fill('Midnight Teal');
  await field(staffPage, 'Vehicle type').selectOption('COUPE');
  await field(staffPage, 'Fuel type').selectOption('ELECTRIC');
  await field(staffPage, 'Engine').fill('Dual-motor electric');
  await field(staffPage, 'Power (hp)').fill('612');
  await field(staffPage, 'Seats').fill('4');
  await field(staffPage, 'Starting price (£)').fill('99000');
  await field(staffPage, 'Description').fill('A vehicle created during the end-to-end test run.');
  await staffPage.getByRole('button', { name: 'Add vehicle' }).click();
  await expect(staffPage).toHaveURL(/\/admin\/vehicles\/[0-9a-f-]{36}$/);
  const vehicleId = staffPage.url().split('/').pop() as string;

  // Upload a photograph.
  await staffPage
    .locator('#image-files')
    .setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: PNG });
  await staffPage.getByRole('button', { name: /Upload 1 photograph/ }).click();
  await expect(staffPage.getByText('1 photograph uploaded.')).toBeVisible();
  await expect(staffPage.getByText('Primary', { exact: true })).toBeVisible();

  // Assign the first showroom.
  const firstShowroom = staffPage
    .getByRole('listitem')
    .filter({ hasText: 'Available for test drives' })
    .first();
  await firstShowroom.getByRole('checkbox').first().check();
  await staffPage.getByRole('button', { name: 'Save showrooms' }).click();
  await expect(staffPage.getByText('Showroom availability saved.')).toBeVisible();

  // Generate slots with the bulk generator (a live preview, then confirm).
  await staffPage.goto('/admin/slots/bulk');
  const showroomSelect = field(staffPage, 'Showroom');
  await expect(showroomSelect.locator('option')).not.toHaveCount(1);
  await showroomSelect.selectOption({ index: 1 });
  await field(staffPage, 'Vehicle').selectOption({ label: `E2E Motors ${model}` });
  await field(staffPage, 'From date').fill(tomorrowPlus(10));
  await field(staffPage, 'To date').fill(tomorrowPlus(16));
  for (const day of ['Sat', 'Sun']) {
    await staffPage.getByRole('button', { name: day, exact: true }).click();
  }
  await field(staffPage, 'Daily start').fill('09:00');
  await field(staffPage, 'Daily end').fill('12:00');
  await field(staffPage, 'Slot length (minutes)').fill('60');
  const create = staffPage.getByRole('button', { name: /^Create \d+ slots?$/ });
  await expect(create).toBeEnabled({ timeout: 20_000 });
  await create.click();
  await expect(staffPage).toHaveURL(/\/admin\/slots$/);

  // A customer finds the vehicle and its open dates.
  const customer = await newCustomer('catalogue');
  const customerPage = await (await contextFor(browser, customer.api)).newPage();
  await customerPage.goto(`/vehicles?q=${encodeURIComponent(model)}`);
  await customerPage.getByRole('link', { name: model, exact: true }).click();
  await expect(customerPage.getByRole('heading', { level: 1, name: model })).toBeVisible();
  await customerPage.getByLabel('1. Choose a showroom').selectOption({ index: 1 });
  await expect(customerPage.getByRole('button', { name: /slots available/ }).first()).toBeVisible();
  const detail = await ok<{ images: unknown[] }>(customer.api, 'get', `/api/vehicles/${vehicleId}`);
  expect(detail.images).toHaveLength(1);
});

test('E2E-10 deactivating a vehicle with future bookings is blocked; after cancelling it works and the vehicle leaves the catalogue', async ({
  browser,
}) => {
  const staff = await staffApi();
  const model = `Zenith ${Date.now().toString(36)}`;
  const vehicle = await ok<{ id: string }>(staff, 'post', '/api/admin/vehicles', {
    manufacturer: 'E2E Motors',
    model,
    year: new Date().getFullYear(),
    vehicleType: 'SEDAN',
    fuelType: 'HYBRID',
    transmission: 'AUTOMATIC',
    engine: 'Hybrid V6',
    powerHp: 400,
    seats: 5,
    color: 'Silver',
    description: 'A vehicle used to test deactivation rules.',
  });
  const dealerships = await ok<{ items: { id: string }[] }>(
    staff,
    'get',
    '/api/admin/dealerships?pageSize=5&isActive=true',
  );
  const dealershipId = dealerships.items[0].id;
  await ok(staff, 'put', `/api/admin/vehicles/${vehicle.id}/dealerships`, {
    dealerships: [{ dealershipId, isAvailable: true }],
  });
  const slot = await createSlotBetween(staff, { dealershipId, vehicleId: vehicle.id }, 72, 140);
  const customer = await newCustomer('deactivate');
  const booking = await book(customer, slot.id);

  const page = await (await contextFor(browser, staff)).newPage();
  const openDeactivate = async () => {
    await page.goto(`/admin/vehicles?q=${encodeURIComponent(model)}`);
    await page
      .getByRole('row')
      .filter({ hasText: model })
      .getByRole('button', { name: 'Deactivate' })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Deactivate', exact: true }).click();
  };

  // Blocked: shows the count and a link to the bookings.
  await openDeactivate();
  const blocked = page.getByRole('dialog');
  await expect(
    blocked.getByRole('heading', { name: 'This vehicle cannot be deactivated yet' }),
  ).toBeVisible();
  await expect(blocked).toContainText('1 upcoming booking');
  await expect(blocked.getByRole('link', { name: 'View those bookings' })).toHaveAttribute(
    'href',
    new RegExp(`vehicleId=${vehicle.id}`),
  );
  expect((await call(staff, 'get', `/api/vehicles/${vehicle.id}`)).status).toBe(200);

  // Cancel the booking, then deactivation works.
  await ok(staff, 'patch', `/api/admin/bookings/${booking.id}/cancel`, {
    cancellationReason: 'Vehicle withdrawn for servicing.',
  });
  await openDeactivate();
  await expect(page.getByText(/has been deactivated\./)).toBeVisible();

  // It disappears from the customer catalogue.
  expect((await call(customer.api, 'get', `/api/vehicles/${vehicle.id}`)).status).toBe(404);
  const customerPage = await (await contextFor(browser, customer.api)).newPage();
  await customerPage.goto(`/vehicles?q=${encodeURIComponent(model)}`);
  await expect(customerPage.getByText('No vehicles match your search')).toBeVisible();
});
