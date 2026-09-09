import { expect, test } from '@playwright/test';
import { signIn, switchLanguage } from './helpers';

/**
 * Q4 — the interface ships in English and Armenian.
 *
 * These check the switch end to end rather than only the catalogue: a
 * translation that exists but never reaches the screen is not a translation.
 */
test.describe('language', () => {
  test('switches the whole interface to Armenian and back', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Map the fruit');

    await switchLanguage(page, 'hy');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Քարտեզագրիր');
    // The navigation is translated too, not just the page body. Scoped to the
    // nav and exact: Playwright matches accessible names case-insensitively,
    // and the page's own "Բացել քարտեզը" button would otherwise match too.
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Քարտեզ', exact: true }),
    ).toBeVisible();

    await switchLanguage(page, 'en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Map the fruit');
  });

  test('remembers the choice across pages and reloads', async ({ page }) => {
    await page.goto('/');
    await switchLanguage(page, 'hy');

    await page.goto('/signin');
    await expect(page.locator('html')).toHaveAttribute('lang', 'hy');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Մուտք');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hy');
  });

  test('translates the capture flow, including the enum choices', async ({ page }) => {
    await signIn(page);
    await page.goto('/add');
    await switchLanguage(page, 'hy');

    await expect(page.getByRole('heading', { name: '1. Որտե՞ղ է' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '3. Ի՞նչ վիճակում է' })).toBeVisible();
    // Condition options come from the shared constants, so this proves the
    // enum labels are translated and not just the page headings.
    await expect(page.getByRole('radio', { name: /Չորացած/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Պահպանել ծառը' })).toBeVisible();
  });

  test('follows the browser language when nothing has been chosen', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'hy-AM' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'hy');
    await context.close();
  });
});
