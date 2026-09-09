import { expect, test } from '@playwright/test';

/**
 * Password sign-in, for deployments with no working mail server.
 *
 * The suite's dev server configures the operator account through
 * playwright.config.ts, alongside the dev-login provider — so this also covers
 * the case where two sign-in methods are on the page at once, which is where
 * the form's fields previously interfered with each other.
 */
const EMAIL = 'operator@example.org';
const PASSWORD = 'trees2026';

test.describe('password sign-in', () => {
  test('signs in with only the password block filled in', async ({ page }) => {
    await page.goto('/signin');

    const passwordForm = page.locator('form').filter({ has: page.getByLabel('Password') });

    // The regression: the button used to stay disabled until the *other*
    // form's email field was filled, with nothing on screen explaining why.
    await passwordForm.getByLabel('Email address').fill(EMAIL);
    await passwordForm.getByLabel('Password').fill(PASSWORD);
    await expect(passwordForm.getByRole('button', { name: 'Sign in' })).toBeEnabled();

    await passwordForm.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/signin'), { timeout: 30_000 });

    // Signed in, and with the role the environment grants the account.
    await page.goto('/add');
    await expect(page.getByRole('heading', { name: /Add a tree/i })).toBeVisible();
  });

  test('lands on the page that sent you to sign in', async ({ page }) => {
    await page.goto('/add');
    await expect(page).toHaveURL(/\/signin/);

    const passwordForm = page.locator('form').filter({ has: page.getByLabel('Password') });
    await passwordForm.getByLabel('Email address').fill(EMAIL);
    await passwordForm.getByLabel('Password').fill(PASSWORD);
    await passwordForm.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/add/, { timeout: 30_000 });
  });

  test('rejects the wrong password and says so', async ({ page }) => {
    await page.goto('/signin');

    const passwordForm = page.locator('form').filter({ has: page.getByLabel('Password') });
    await passwordForm.getByLabel('Email address').fill(EMAIL);
    await passwordForm.getByLabel('Password').fill('definitely-not-it');
    await passwordForm.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toContainText(/not recognised/i, { timeout: 30_000 });
  });

  test('each form works without the other being filled in', async ({ page }) => {
    await page.goto('/signin');

    // The magic-link button depends only on the magic-link email box.
    const linkButton = page.getByRole('button', { name: /Email me a sign-in link|development/i });
    const linkForm = page.locator('form').filter({ has: linkButton });
    await expect(linkButton).toBeDisabled();
    await linkForm.getByLabel('Email address').fill('someone@example.org');
    await expect(linkButton).toBeEnabled();

    // …and filling it in does not enable the password button.
    const passwordForm = page.locator('form').filter({ has: page.getByLabel('Password') });
    await expect(passwordForm.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });
});
