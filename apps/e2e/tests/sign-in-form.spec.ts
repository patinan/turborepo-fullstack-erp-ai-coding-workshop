import AxeBuilder from '@axe-core/playwright';
import { expect, PASSWORD, signInForm, test } from './fixtures.js';

test.describe('Sign-in screen', () => {
  test('every field has a label, and the page fits 1366 px without horizontal scroll', async ({
    page,
  }) => {
    await page.goto('/login');
    const form = signInForm(page);
    await expect(form.username).toBeVisible();
    await expect(form.password).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withRules(['label', 'aria-input-field-name', 'button-name', 'form-field-multiple-labels'])
      .analyze();
    expect(violations).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test('a blank field is reported beside that field, with no retry', async ({ page }) => {
    await page.goto('/login');
    const form = signInForm(page);
    await form.username.fill('staff_b01');
    await form.submit.click();

    await expect(form.password).toHaveAttribute('aria-invalid', 'true');
    await expect(form.password).toHaveAccessibleDescription('กรุณากรอกรหัสผ่าน');
    await expect(form.username).not.toHaveAttribute('aria-invalid');
    await expect(page.getByRole('button', { name: 'ลองอีกครั้ง' })).toHaveCount(0);
  });

  test('a temporary failure offers a retry that signs in', async ({ page }) => {
    let attempts = 0;
    await page.route('**/api/auth/login', async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR', kind: 'retry' } });
      } else {
        await route.continue();
      }
    });

    await page.goto('/login');
    const form = signInForm(page);
    await form.username.fill('staff_b01');
    await form.password.fill(PASSWORD);
    await form.submit.click();

    await expect(page.getByRole('alert')).toContainText('ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง');
    await page.getByRole('button', { name: 'ลองอีกครั้ง' }).click();

    await expect(page.getByRole('banner')).toContainText('Staff B01');
    expect(attempts).toBe(2);
  });
});
