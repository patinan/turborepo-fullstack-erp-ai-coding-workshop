import { mkdirSync, writeFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

export const PASSWORD = 'password';

export const test = base.extend<object, { recordBrowserVersion: void }>({
  // Writes e.g. "chrome: 142.0.7444.59" to test-results/browsers/, once per browser per run.
  recordBrowserVersion: [
    async ({ browser }, use, workerInfo) => {
      const line = `${workerInfo.project.name}: ${browser.version()}`;
      console.log(`Browser ${line}`);
      mkdirSync('test-results/browsers', { recursive: true });
      writeFileSync(`test-results/browsers/${workerInfo.project.name}.txt`, `${line}\n`);
      await use();
    },
    { scope: 'worker', auto: true },
  ],
});

/** The sign-in form, found by its Thai labels. */
export function signInForm(page: Page) {
  return {
    username: page.getByLabel('ชื่อผู้ใช้'),
    password: page.getByLabel('รหัสผ่าน'),
    submit: page.getByRole('button', { name: 'เข้าสู่ระบบ' }),
  };
}

export async function signIn(page: Page, username: string, password = PASSWORD) {
  await page.goto('/login');
  const form = signInForm(page);
  await form.username.fill(username);
  await form.password.fill(password);
  await form.submit.click();
}
