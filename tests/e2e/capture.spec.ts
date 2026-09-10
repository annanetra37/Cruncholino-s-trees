import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('capture flow', () => {
  test('records a tree from GPS in a few taps', async ({ page }) => {
    await signIn(page);
    await page.goto('/add');

    // Two waits, not one: the first absorbs the dev server compiling this route
    // on a cold run, the second is the actual thing under test. Rolled into a
    // single assertion they share one budget, and a slow compile reads as a GPS
    // failure.
    await expect(page.getByTestId('location-map')).toBeVisible({ timeout: 60_000 });

    // The GPS fix is requested on load; the form should show a position without
    // the contributor doing anything.
    await expect(page.getByText(/40\.1872/)).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole('radio', { name: /Apricot/ })
      .first()
      .click();
    await page.getByRole('radio', { name: 'Good Healthy, no visible damage' }).click();
    await page.getByRole('radio', { name: 'Old Thick trunk, veteran' }).click();

    await page.getByRole('button', { name: 'Save tree' }).click();

    await expect(page.getByRole('heading', { name: 'Tree recorded' })).toBeVisible({
      timeout: 30_000,
    });

    // T4.3 — the address confirmation step is part of the flow, and is present
    // whether or not the geocoder answered.
    await expect(page.getByText('Address we found')).toBeVisible();
  });

  test('shows the address of the pin before the tree is saved', async ({ page }) => {
    // The geocoder is a live third-party service, so the route is stubbed here:
    // what this covers is that the form asks for the address of the current pin
    // and shows the answer, which is what a contributor standing under the tree
    // needs in order to trust the position before committing it.
    let asked: URL | null = null;
    await page.route('**/api/geocode/reverse**', async (route) => {
      asked = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'OK',
          cached: false,
          address: { addressLine: 'Abovyan St 12, Yerevan' },
        }),
      });
    });

    await signIn(page);
    await page.goto('/add');

    await expect(page.getByTestId('location-address')).toContainText('Abovyan St 12, Yerevan', {
      timeout: 20_000,
    });
    expect(asked?.searchParams.get('lat')).toBeTruthy();
    expect(asked?.searchParams.get('lng')).toBeTruthy();
  });

  test('says so plainly when the geocoder has no address for the spot', async ({ page }) => {
    await page.route('**/api/geocode/reverse**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'FAILED', cached: false, address: null }),
      }),
    );

    await signIn(page);
    await page.goto('/add');

    // A missing address must not read as a broken form: the tree still saves.
    await expect(page.getByTestId('location-address')).toContainText(/No address found/i, {
      timeout: 20_000,
    });
    await page
      .getByRole('radio', { name: /Apricot/ })
      .first()
      .click();
    await expect(page.getByRole('button', { name: 'Save tree' })).toBeEnabled();
  });

  test('requires a species before it will save', async ({ page }) => {
    await signIn(page);
    await page.goto('/add');
    await expect(page.getByRole('button', { name: 'Save tree' })).toBeDisabled();
  });

  test('sends an anonymous visitor to sign in', async ({ page }) => {
    await page.goto('/add');
    await expect(page).toHaveURL(/\/signin/);
  });
});

test.describe('capture flow without location permission', () => {
  // T4.1's done-when: the flow must complete with location permission denied.
  test.use({ permissions: [] });

  test('falls back to dropping a pin on the map', async ({ page }) => {
    await signIn(page);
    await page.goto('/add');

    await expect(page.getByTestId('location-map')).toBeVisible();

    // Tapping the map is the manual fallback; the pin lands where it is tapped.
    const map = page.getByTestId('location-map');
    await map.click({ position: { x: 160, y: 120 } });

    await expect(page.getByText('MANUAL')).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole('radio', { name: /Walnut/ })
      .first()
      .click();
    await expect(page.getByRole('button', { name: 'Save tree' })).toBeEnabled();
  });
});
