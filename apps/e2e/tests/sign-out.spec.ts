import { expect, signIn, signInForm, test } from './fixtures.js';

test('after sign-out the app returns to sign-in and the old session no longer works', async ({
  page,
  context,
}) => {
  await signIn(page, 'manager01');
  await expect(page.getByRole('banner')).toContainText('Manager 01');
  const signedInCookies = await context.cookies();

  await page.getByRole('button', { name: 'ออกจากระบบ' }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(signInForm(page).username).toBeVisible();

  // Someone who copied the cookie before sign-out can't use it.
  await context.addCookies(signedInCookies);
  const me = await (await page.request.get('/api/auth/me')).json();
  expect(me).toEqual({ user: null });
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});
