import { expect, PASSWORD, signIn, signInForm, test } from './fixtures.js';

test.describe('Sign in', () => {
  test('a store employee signs in with only the keyboard and sees their name and store', async ({
    page,
  }) => {
    await page.goto('/login');
    const form = signInForm(page);

    await expect(form.username).toBeFocused();
    await page.keyboard.type('staff_b01');
    await page.keyboard.press('Tab');
    await expect(form.password).toBeFocused();
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press('Enter');

    const header = page.getByRole('banner');
    await expect(header).toContainText('Staff B01');
    await expect(header).toContainText('B01 Central Store');
  });

  test('a wrong password and an unknown username show the same Thai message, with no retry', async ({
    page,
  }) => {
    const alert = page.getByRole('alert');

    await signIn(page, 'staff_b01', 'wrong-password');
    await expect(alert).toHaveText('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    await expect(page.getByRole('button', { name: 'ลองอีกครั้ง' })).toHaveCount(0);

    await signIn(page, 'nobody_here', PASSWORD);
    await expect(alert).toHaveText('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  });

  test('the username is matched ignoring case and surrounding spaces', async ({ page }) => {
    await signIn(page, ' STAFF_B01 ');

    await expect(page.getByRole('banner')).toContainText('Staff B01');
    const me = await (await page.request.get('/api/auth/me')).json();
    expect(me.user.username).toBe('staff_b01');
  });

  test('the session cookie is HTTP-only and expires 12 hours after sign-in', async ({
    page,
    context,
  }) => {
    const signedInAt = Date.now() / 1000;
    await signIn(page, 'staff_b01');
    await expect(page.getByRole('banner')).toContainText('Staff B01');

    const session = (await context.cookies()).find((cookie) => cookie.name === 'erp_session');
    expect(session?.httpOnly).toBe(true);
    expect(session!.expires - signedInAt).toBeGreaterThan(12 * 3600 - 60);
    expect(session!.expires - signedInAt).toBeLessThan(12 * 3600 + 60);
  });
});
