import { expect, test, type Page } from '@playwright/test';

/**
 * The filter panel is a sidebar on desktop and a bottom sheet behind a
 * "Filters" button on a phone. Tests drive it the way a user would rather than
 * assuming one of the two layouts.
 */
async function openFilters(page: Page) {
  const toggle = page.getByRole('button', { name: 'Filters' });
  if (await toggle.isVisible()) await toggle.click();
  await expect(page.getByRole('heading', { name: 'Filters' })).toBeVisible();
}

test.describe('dashboard', () => {
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
