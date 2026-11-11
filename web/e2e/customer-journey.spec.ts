import { expect, test } from '@playwright/test';
import { apiAs, labelled, publicVehicles, SEED_PASSWORD } from './helpers';

test('E2E-01 a new customer registers, browses, filters, books a test drive and sees it as pending', async ({
  page,
  playwright,
}) => {
  const api = await playwright.request.newContext();
  const [vehicle] = await publicVehicles(api);
  const stamp = Date.now().toString(36);
  const email = `e2e.journey.${stamp}@example.test`;

  // Register: an account without a licence number, so the booking page asks for it.
  await page.goto('/register');
  await labelled(page, 'First name').fill('Eliza');
  await labelled(page, 'Last name').fill(`Journey${stamp}`);
  await labelled(page, 'Email address').fill(email);
  await labelled(page, 'Phone number').fill('+44 7700 900321');
  await labelled(page, 'Password').fill(SEED_PASSWORD);
  await labelled(page, 'Confirm password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/vehicles$/);
  await expect(page.getByRole('button', { name: /Account menu for/ })).toBeVisible();

  // Browse and filter by manufacturer, vehicle type and fuel type.
  await page.getByLabel('Manufacturer').selectOption(vehicle.manufacturer);
  await page.getByLabel('Vehicle type').selectOption(vehicle.vehicleType);
  await page.getByLabel('Fuel type').selectOption(vehicle.fuelType);
  await expect(page).toHaveURL(
    new RegExp(
      `manufacturer=${encodeURIComponent(vehicle.manufacturer).replace(/%20/g, '(%20|\\+)')}`,
    ),
  );
  await expect(page.getByRole('link', { name: vehicle.model, exact: true }).first()).toBeVisible();

  // Open the vehicle and pick showroom, date and time.
  await page.getByRole('link', { name: vehicle.model, exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: vehicle.model })).toBeVisible();
  const showroom = page.getByLabel('1. Choose a showroom');
  await showroom.selectOption({ index: 1 });
  await page
    .getByRole('button', { name: /slots available/ })
    .first()
    .click();
  await page.getByRole('button', { name: /–/ }).first().click();
  await page.getByRole('link', { name: 'Continue to confirmation' }).click();

  // Confirm: licence number is required because the profile has none.
  await expect(page.getByRole('heading', { name: 'Confirm your test drive' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm booking request' }).click();
  await expect(
    page.getByText('Please confirm that you hold a valid driving licence'),
  ).toBeVisible();
  await expect(page.getByText('Enter your driving licence number')).toBeVisible();
  await page.getByLabel('Driving licence number').fill(`E2E${stamp}`.toUpperCase());
  await page.getByLabel('I hold a valid driving licence').check();
  await page.getByRole('button', { name: 'Confirm booking request' }).click();
  await expect(page.getByRole('heading', { name: 'Your test drive is requested' })).toBeVisible();
  await expect(page.getByText('Pending approval')).toBeVisible();

  // It appears under Pending.
  await page.goto('/my-bookings?view=pending');
  await expect(
    page.getByRole('link', { name: `${vehicle.manufacturer} ${vehicle.model}` }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: /Pending/ })).toContainText('1');
});

test('E2E-11 an existing customer can sign in and out from the interface', async ({ page }) => {
  const api = await apiAs('amelia.hart@prestige.test');
  await api.dispose();

  await page.goto('/login');
  await labelled(page, 'Email address').fill('amelia.hart@prestige.test');
  await labelled(page, 'Password').fill('wrong-password1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('The email or password you entered is incorrect')).toBeVisible();

  await labelled(page, 'Password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/vehicles$/);

  await page.getByRole('button', { name: /Account menu for/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByText('You have been signed out.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
});
