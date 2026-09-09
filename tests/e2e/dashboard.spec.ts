import { expect, test } from '@playwright/test';
import { openFilters, signIn } from './helpers';

// Q1: the dashboard is login-gated. This lives outside the signed-in describe
// below so it runs against a session-less page.
test('dashboard sends an anonymous visitor to sign in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/signin/);
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('shows the map and a live result count', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('tree-map')).toBeVisible();
    await expect(page.getByText(/\d+ trees?$/)).toBeVisible({ timeout: 20_000 });
  });

  test('filters are reflected in the URL and survive a reload', async ({ page }) => {
    // T5.4's done-when: copying the URL into a new tab reproduces the same view.
    await page.goto('/dashboard?view=list');
    await openFilters(page);

    await page.getByRole('button', { name: 'Apricot', exact: false }).first().click();
    await expect(page).toHaveURL(/species=apricot/);

    const url = page.url();
    await page.goto(url);
    await openFilters(page);
    await expect(page.getByRole('button', { name: 'Apricot', exact: false }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('the list view shows the same filtered data as a table', async ({ page }) => {
    await page.goto('/dashboard?view=list&city=Yerevan');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    // Every visible row must belong to the filtered city.
    const cities = await page.locator('tbody tr td:nth-child(5)').allTextContents();
    expect(cities.every((city) => city.trim() === 'Yerevan')).toBe(true);
  });

  test('resetting the filters clears the query string', async ({ page }) => {
    await page.goto('/dashboard?view=list&condition=GOOD');
    await openFilters(page);
    await page.getByRole('button', { name: /^Reset/ }).click();
    await expect(page).not.toHaveURL(/condition=/);
  });

  test('opens a tree’s details from the list', async ({ page }) => {
    await page.goto('/dashboard?view=list');
    await page.locator('tbody tr').first().click();
    await expect(page).toHaveURL(/tree=/);
    await expect(page.getByRole('button', { name: 'Close details' })).toBeVisible();
  });
});
