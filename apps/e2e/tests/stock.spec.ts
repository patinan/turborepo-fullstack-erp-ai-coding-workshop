import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, signIn, test } from './fixtures.js';

/** The stock screen, found by its Thai labels. */
function stockScreen(page: Page) {
  return {
    search: page.getByLabel('ค้นหาสินค้า'),
    lowOnly: page.getByLabel('เฉพาะสินค้าใกล้หมด'),
    table: page.getByRole('table'),
    row: (sku: string) => page.getByRole('row').filter({ hasText: sku }),
  };
}

/** Sign in, wait until it has finished, then open the stock screen at `path`. */
async function openStock(page: Page, username: string, path = '/stock') {
  await signIn(page, username);
  await expect(page.getByRole('button', { name: 'ออกจากระบบ' })).toBeVisible();
  await page.goto(path);
}

/** Press Tab until `target` has focus, as a keyboard-only user would. */
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 20; presses++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

test.describe('Stock screen', () => {
  test('staff_b01 searches stock with only the keyboard and sees SKU003 flagged low (INV-01.4)', async ({
    page,
  }) => {
    await signIn(page, 'staff_b01');
    const nav = page.getByRole('navigation').getByRole('link', { name: 'สต็อกสินค้า' });
    await tabTo(page, nav);
    await page.keyboard.press('Enter');

    const screen = stockScreen(page);
    await expect(screen.search).toBeFocused();
    await page.keyboard.type('SKU00');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/q=SKU00/);
    await expect(screen.row('SKU001')).toContainText('10');
    await expect(screen.row('SKU001')).not.toContainText('ใกล้หมด');
    await expect(screen.row('SKU003')).toContainText('ใกล้หมด');
    await expect(screen.table.getByRole('row')).toHaveCount(4); // header + 3 products

    // Only low stock: ticking the box applies it at once.
    await page.keyboard.press('Tab');
    await expect(screen.lowOnly).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page).toHaveURL(/lowOnly=true/);
    await expect(screen.table.getByRole('row')).toHaveCount(2);
    await expect(screen.row('SKU003')).toContainText('ใกล้หมด');
  });

  // staff_b01 as the ticket says; manager01 sees both stores, so the widest table.
  for (const username of ['staff_b01', 'manager01']) {
    test(`every field has a label, and the page fits 1366 px without horizontal scroll, for ${username} (NFR-06)`, async ({
      page,
    }) => {
      await openStock(page, username);
      await expect(stockScreen(page).row('SKU001').first()).toBeVisible();

      const { violations } = await new AxeBuilder({ page })
        .withRules(['label', 'aria-input-field-name', 'button-name', 'form-field-multiple-labels'])
        .analyze();
      expect(violations).toEqual([]);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }

  test('the navigation shows the stock screen to staff_b01 and not to admin01 (NFR-01.6)', async ({
    page,
  }) => {
    const stockLink = page.getByRole('navigation').getByRole('link', { name: 'สต็อกสินค้า' });

    await signIn(page, 'staff_b01');
    await expect(stockLink).toBeVisible();
    await page.getByRole('button', { name: 'ออกจากระบบ' }).click();

    await signIn(page, 'admin01');
    await expect(page.getByRole('banner')).toContainText('Admin 01');
    await expect(stockLink).toHaveCount(0);
  });

  test('shows a loading state, then the rows (UI-02.3)', async ({ page }) => {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/stock?*', async (route) => {
      await released;
      await route.continue();
    });

    await openStock(page, 'staff_b01');

    await expect(page.getByRole('status')).toHaveText('กำลังโหลด…');
    release();
    await expect(stockScreen(page).row('SKU002')).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('shows a retry error state that recovers (UI-02.3)', async ({ page }) => {
    // Fails until the user retries (the app already retries once on its own).
    let failing = true;
    await page.route('**/api/stock?*', async (route) => {
      if (failing) {
        await route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR', kind: 'retry' } });
      } else {
        await route.continue();
      }
    });

    await openStock(page, 'staff_b01');

    await expect(page.getByRole('alert')).toContainText('ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง');
    failing = false;
    await page.getByRole('button', { name: 'ลองอีกครั้ง' }).click();
    await expect(stockScreen(page).row('SKU001')).toBeVisible();
  });

  test('shows the empty-state message when nothing matches (UI-01.2)', async ({ page }) => {
    await openStock(page, 'staff_b01', '/stock?q=no-such-product');

    await expect(page.getByText('ไม่พบสินค้าที่ตรงกับเงื่อนไข')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});
