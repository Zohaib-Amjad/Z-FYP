import { expect, test } from '@playwright/test';
import {
  book,
  call,
  contextFor,
  createSlotBetween,
  dealershipsOf,
  freeSlots,
  newCustomer,
  publicVehicles,
  staffApi,
} from './helpers';

test('E2E-05 a customer can cancel outside the 24 hour window and is blocked inside it', async ({
  browser,
}) => {
  const staff = await staffApi();
  const customer = await newCustomer('cancel');
  const vehicle = (await publicVehicles(staff))[4];
  const [dealership] = await dealershipsOf(staff, vehicle.id);
  const target = { dealershipId: dealership.id, vehicleId: vehicle.id };
  const outside = await createSlotBetween(staff, target, 72, 140);
  const inside = await createSlotBetween(staff, target, 3, 20);
  const outsideBooking = await book(customer, outside.id);
  const insideBooking = await book(customer, inside.id);

  const page = await (await contextFor(browser, customer.api)).newPage();
  await page.goto('/my-bookings?view=pending');
  const cards = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: vehicle.name }) });
  await expect(cards).toHaveCount(2);

  // Inside the window: no cancel button, the reason is shown, and the server refuses too.
  const insideCard = cards.filter({ hasText: /Bookings can only be cancelled at least 24 hours/ });
  await expect(insideCard).toHaveCount(1);
  await expect(insideCard.getByRole('button', { name: 'Cancel appointment' })).toHaveCount(0);
  const refused = await call(customer.api, 'patch', `/api/bookings/${insideBooking.id}/cancel`, {});
  expect(refused.status).toBe(409);
  expect(refused.body.error?.code).toBe('CANCELLATION_WINDOW_PASSED');

  // Outside the window: cancelling works.
  const outsideCard = cards.filter({
    has: page.getByRole('button', { name: 'Cancel appointment' }),
  });
  await expect(outsideCard).toHaveCount(1);
  await outsideCard.getByRole('button', { name: 'Cancel appointment' }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/Reason/)
    .fill('My plans have changed.');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel appointment' }).click();
  await expect(page.getByText('Your appointment has been cancelled.')).toBeVisible();

  await page.goto('/my-bookings?view=cancelled');
  await expect(page.getByText('My plans have changed.')).toBeVisible();
  const detail = await call<{ status: string }>(
    customer.api,
    'get',
    `/api/bookings/${outsideBooking.id}`,
  );
  expect(detail.body.data.status).toBe('CANCELLED');
});

test('E2E-06 two customers booking the same slot at the same moment: exactly one succeeds', async ({
  browser,
}) => {
  const staff = await staffApi();
  const first = await newCustomer('racer');
  const second = await newCustomer('racer');
  const vehicle = (await publicVehicles(staff))[5];
  const [slot] = await freeSlots(staff, vehicle.id, 4);

  const pageA = await (await contextFor(browser, first.api)).newPage();
  const pageB = await (await contextFor(browser, second.api)).newPage();
  for (const page of [pageA, pageB]) {
    await page.goto(`/book?slotId=${slot.id}`);
    await expect(page.getByRole('heading', { name: 'Confirm your test drive' })).toBeVisible();
    await page.getByLabel('I hold a valid driving licence').check();
  }

  await Promise.all([
    pageA.getByRole('button', { name: 'Confirm booking request' }).click(),
    pageB.getByRole('button', { name: 'Confirm booking request' }).click(),
  ]);

  const success = (page: typeof pageA) =>
    page.getByRole('heading', { name: 'Your test drive is requested' });
  const taken = (page: typeof pageA) => page.getByText('That time has just been taken');
  await expect
    .poll(
      async () =>
        (await success(pageA).count()) +
        (await success(pageB).count()) +
        (await taken(pageA).count()) +
        (await taken(pageB).count()),
    )
    .toBe(2);
  expect((await success(pageA).count()) + (await success(pageB).count())).toBe(1);
  expect((await taken(pageA).count()) + (await taken(pageB).count())).toBe(1);

  const bookings = await call<{ items: unknown[] }>(
    staff,
    'get',
    `/api/admin/bookings?vehicleId=${vehicle.id}&dateFrom=${encodeURIComponent(slot.startAt)}&dateTo=${encodeURIComponent(slot.startAt)}&status=PENDING`,
  );
  expect(bookings.body.data.items).toHaveLength(1);
});

test('E2E-08 access control: customers, visitors and staff stay within their areas', async ({
  browser,
  page,
}) => {
  // A signed-out visitor is sent to the sign-in page from private pages.
  await page.goto('/my-bookings');
  await expect(page).toHaveURL(/\/login\?next=%2Fmy-bookings/);
  await page.goto('/admin/bookings');
  await expect(page).toHaveURL(/\/admin\/login\?next=/);

  // A customer sees the friendly 403 page under /admin and cannot call staff endpoints.
  const customer = await newCustomer('access');
  const customerPage = await (await contextFor(browser, customer.api)).newPage();
  await customerPage.goto('/admin');
  await expect(
    customerPage.getByRole('heading', { name: 'This area is not available to you' }),
  ).toBeVisible();
  expect((await call(customer.api, 'get', '/api/admin/bookings')).status).toBe(403);

  // Staff cannot book, and the booking page explains why.
  const staff = await staffApi();
  const vehicle = (await publicVehicles(staff))[6];
  const [slot] = await freeSlots(staff, vehicle.id, 3);
  const forbidden = await call(staff, 'post', '/api/bookings', { slotId: slot.id });
  expect(forbidden.status).toBe(403);
  expect(forbidden.body.error?.code).toBe('FORBIDDEN');
  const staffPage = await (await contextFor(browser, staff)).newPage();
  await staffPage.goto(`/book?slotId=${slot.id}`);
  await expect(
    staffPage.getByRole('heading', { name: 'This area is not available to you' }),
  ).toBeVisible();
  await expect(staffPage.getByText(/Booking and profile pages are for customers/)).toBeVisible();
});
