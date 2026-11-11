import { expect, test } from '@playwright/test';
import {
  apiAs,
  book,
  call,
  contextFor,
  freeSlots,
  newCustomer,
  ok,
  publicVehicles,
  staffApi,
} from './helpers';

const confirmDialog = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('dialog').getByRole('button', { name, exact: true });

test('E2E-02 staff approve a pending booking; the customer sees it as upcoming with a new notification', async ({
  browser,
}) => {
  const staff = await staffApi();
  const customer = await newCustomer('approve');
  const vehicle = (await publicVehicles(staff))[1];
  const [slot] = await freeSlots(staff, vehicle.id, 3);
  await book(customer, slot.id);

  const staffPage = await (await contextFor(browser, staff)).newPage();
  await staffPage.goto('/admin');
  const kpi = staffPage.getByRole('link', { name: /Awaiting your decision: \d+/ });
  await expect(kpi).toBeVisible();
  expect(
    Number((await kpi.getAttribute('aria-label'))?.match(/: (\d+)/)?.[1]),
  ).toBeGreaterThanOrEqual(1);
  await kpi.click();
  await expect(staffPage).toHaveURL(/status=PENDING/);

  await staffPage.goto(`/admin/bookings?q=${customer.lastName}`);
  const row = staffPage.getByRole('row').filter({ hasText: customer.lastName });
  await expect(row).toContainText('Pending');
  await row.getByRole('button', { name: 'Approve' }).click();
  await confirmDialog(staffPage, 'Approve booking').click();
  await expect(
    staffPage.getByText('Booking approved. The customer has been notified.'),
  ).toBeVisible();

  const customerPage = await (await contextFor(browser, customer.api)).newPage();
  await customerPage.goto('/my-bookings?view=upcoming');
  await expect(customerPage.getByRole('link', { name: vehicle.name })).toBeVisible();
  await expect(customerPage.getByText('Approved').first()).toBeVisible();
  await expect(
    customerPage.getByRole('button', { name: /Notifications, \d+ unread/ }),
  ).toBeVisible();
  await customerPage.goto('/notifications');
  await expect(customerPage.getByText(/Test drive confirmed|approved/i).first()).toBeVisible();
  await expect(customerPage.getByText('(unread)').first()).toBeAttached();
});

test('E2E-03 staff reject a request with a reason; the customer sees it under Cancelled with that reason', async ({
  browser,
}) => {
  const staff = await staffApi();
  const customer = await newCustomer('reject');
  const vehicle = (await publicVehicles(staff))[2];
  const [slot] = await freeSlots(staff, vehicle.id, 3);
  await book(customer, slot.id);

  const staffPage = await (await contextFor(browser, staff)).newPage();
  await staffPage.goto(`/admin/bookings?q=${customer.lastName}`);
  const row = staffPage.getByRole('row').filter({ hasText: customer.lastName });
  await row.getByRole('button', { name: 'Reject' }).click();

  await confirmDialog(staffPage, 'Reject request').click();
  await expect(staffPage.getByText(/Please give a reason of at least 5 characters/)).toBeVisible();
  await staffPage
    .getByRole('dialog')
    .getByLabel(/Reason for the customer/)
    .fill('The vehicle is booked for a private event that day.');
  await confirmDialog(staffPage, 'Reject request').click();
  await expect(
    staffPage.getByText('Booking rejected. The customer has been notified.'),
  ).toBeVisible();

  const customerPage = await (await contextFor(browser, customer.api)).newPage();
  await customerPage.goto('/my-bookings?view=cancelled');
  await expect(customerPage.getByRole('link', { name: vehicle.name })).toBeVisible();
  await expect(customerPage.getByText('Rejected')).toBeVisible();
  await expect(
    customerPage.getByText('The vehicle is booked for a private event that day.'),
  ).toBeVisible();
});

test('E2E-04 staff reschedule a booking; the customer sees the new time and the history', async ({
  browser,
}) => {
  const staff = await staffApi();
  const customer = await newCustomer('reschedule');
  const vehicle = (await publicVehicles(staff))[3];
  const slots = await freeSlots(staff, vehicle.id, 3);
  const booking = await book(customer, slots[0].id);

  const staffPage = await (await contextFor(browser, staff)).newPage();
  await staffPage.goto(`/admin/bookings/${booking.id}`);
  await staffPage.getByRole('button', { name: 'Reschedule', exact: true }).click();
  const dialog = staffPage.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Reschedule this test drive' })).toBeVisible();
  const days = dialog.getByRole('button', { name: /slots available/ });
  await days.last().click();
  await dialog.getByRole('button', { name: /–/ }).last().click();
  const chosen = (
    await dialog.getByRole('status').filter({ hasText: 'New time' }).innerText()
  ).replace('New time: ', '');
  await dialog.getByRole('button', { name: 'Move to this time' }).click();
  await expect(
    staffPage.getByText('Booking rescheduled. The customer has been notified.'),
  ).toBeVisible();

  const customerPage = await (await contextFor(browser, customer.api)).newPage();
  await customerPage.goto(`/my-bookings/${booking.id}`);
  await expect(customerPage.getByText('Rescheduled').first()).toBeVisible();
  await expect(customerPage.getByText('Moved to a new time')).toBeVisible();
  await expect(customerPage.getByText('Request submitted', { exact: true })).toBeVisible();
  const day = chosen.split(' at ')[0].split(',')[0];
  await expect(customerPage.getByText(day).first()).toBeVisible();
});

test('E2E-07 staff complete a past approved booking; the customer sees it as completed and previous', async ({
  browser,
}) => {
  const staff = await staffApi();
  const past = await ok<{
    items: { id: string; customer: { email: string }; vehicle: { name: string } }[];
  }>(
    staff,
    'get',
    `/api/admin/bookings?status=APPROVED,RESCHEDULED&dateTo=${encodeURIComponent(new Date().toISOString())}&pageSize=10`,
  );
  expect(
    past.items.length,
    'the seed contains an approved booking whose time has passed',
  ).toBeGreaterThan(0);
  const target = past.items[0];

  const staffPage = await (await contextFor(browser, staff)).newPage();
  await staffPage.goto(`/admin/bookings/${target.id}`);
  await staffPage.getByRole('button', { name: 'Complete', exact: true }).click();
  await confirmDialog(staffPage, 'Mark completed').click();
  await expect(staffPage.getByText('Test drive marked as completed.')).toBeVisible();

  const customer = await apiAs(target.customer.email);
  const customerPage = await (await contextFor(browser, customer)).newPage();
  for (const view of ['completed', 'previous']) {
    await customerPage.goto(`/my-bookings?view=${view}`);
    await expect(
      customerPage.getByRole('link', { name: target.vehicle.name }).first(),
    ).toBeVisible();
    await expect(customerPage.getByText('Completed').first()).toBeVisible();
  }

  const again = await call(staff, 'patch', `/api/admin/bookings/${target.id}/complete`, {});
  expect(again.status).toBe(409);
  expect(again.body.error?.code).toBe('INVALID_STATUS_TRANSITION');
});
