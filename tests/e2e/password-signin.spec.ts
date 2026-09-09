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

  test('the buttons are never disabled by what the fields look like', async ({ page }) => {
    // The bug this replaces: Chrome autofills before React hydrates, so the
    // fields are visibly full while React's state is empty. A button disabled
    // on that state is dead with no way to revive it except retyping.
    await page.goto('/signin');

    const linkButton = page.getByRole('button', { name: /Email me a sign-in link|development/i });
    const passwordForm = page.locator('form').filter({ has: page.getByLabel('Password') });

    await expect(linkButton).toBeEnabled();
    await expect(passwordForm.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('an empty password form does not submit', async ({ page }) => {
    // `required` is what enforces this now, not a disabled button.
    await page.goto('/signin');
    const passwordForm = page.locator('form').filter({ has: page.getByLabel('Password') });
    await passwordForm.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/signin/);
  });

  test('signs in when the browser autofilled the fields', async ({ page }) => {
    await page.goto('/signin');
    const passwordForm = page.locator('form').filter({ has: page.getByLabel('Password') });

    // Set the values the way an autofill does — straight onto the DOM node,
    // without the events React listens for.
    await passwordForm.getByLabel('Email address').evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
    }, EMAIL);
    await passwordForm.getByLabel('Password').evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
    }, PASSWORD);

    await expect(passwordForm.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
});
