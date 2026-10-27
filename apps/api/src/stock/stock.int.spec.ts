import type { StockList } from '@erp/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApi, type TestApi } from '../test/api.js';
import { db } from '../test/db.js';

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.close());

async function storeId(code: string) {
  return (await db.store.findUniqueOrThrow({ where: { code } })).id;
}

/** The rows as `SKU store quantity unit threshold low` lines, for readable comparisons. */
function rows(list: StockList) {
  return list.items.map(
    (row) =>
      `${row.product.sku} ${row.store.code} ${row.quantity} ${row.product.unit} ${row.reorderThreshold} ${row.lowStock ? 'low' : 'ok'}`,
  );
}

describe('GET /stock', () => {
  it('shows staff_b01 the B01 stock matching SKU00 with its low-stock flags (INV-01.1)', async () => {
    const staff = await api.signIn('staff_b01');

    const response = await staff.get<StockList>(`/stock?q=SKU00&storeId=${await storeId('B01')}`);

    expect(response.status).toBe(200);
    expect(rows(response.body)).toEqual([
      'SKU001 B01 10 pack 3 ok',
      'SKU002 B01 5 pack 3 ok',
      'SKU003 B01 0 bag 3 low',
    ]);
    expect(response.body).toMatchObject({ total: 3, page: 1, pageSize: 20 });
  });

  it('lists SKU003 among B01 low stock, as 0 is at or below its threshold of 3 (AC-08b)', async () => {
    const manager = await api.signIn('manager01');

    const response = await manager.get<StockList>(
      `/stock?storeId=${await storeId('B01')}&lowOnly=true`,
    );

    expect(rows(response.body)).toEqual(['SKU003 B01 0 bag 3 low']);
    expect(response.body.total).toBe(1);
  });

  it('matches a substring of the SKU or name, ignoring case, in English and Thai (INV-01.2)', async () => {
    const product = await db.product.create({
      data: {
        sku: 'SKU901',
        name: 'น้ำปลาแท้ Fish Sauce',
        category: 'Food',
        unit: 'ขวด',
        sellingPrice: '25.00',
      },
    });
    await db.stockBalance.create({
      data: { productId: product.id, storeId: await storeId('B01'), reorderThreshold: 0 },
    });
    const staff = await api.signIn('staff_b01');
    const skus = async (q: string) =>
      (await staff.get<StockList>(`/stock?q=${encodeURIComponent(q)}`)).body.items.map(
        (row) => row.product.sku,
      );

    expect(await skus('sku90')).toEqual(['SKU901']);
    expect(await skus('ปลาแท้')).toEqual(['SKU901']);
    expect(await skus('fish SAUCE')).toEqual(['SKU901']);
    expect(await skus('tissue')).toEqual(['SKU002']);
    expect(await skus('PAPER')).toEqual(['SKU002']);
    expect(await skus('no such product')).toEqual([]);
  });

  it('lists all three products at 0 in B02 (RPT-02.1)', async () => {
    const manager = await api.signIn('manager01');

    const response = await manager.get<StockList>(`/stock?storeId=${await storeId('B02')}`);

    expect(rows(response.body)).toEqual([
      'SKU001 B02 0 pack 3 low',
      'SKU002 B02 0 pack 3 low',
      'SKU003 B02 0 bag 3 low',
    ]);
  });

  it('hides inactive products unless includeInactive=true (RPT-02.2)', async () => {
    await db.product.update({ where: { sku: 'SKU002' }, data: { active: false } });
    const staff = await api.signIn('staff_b01');

    const active = await staff.get<StockList>('/stock');
    const all = await staff.get<StockList>('/stock?includeInactive=true');

    expect(active.body.items.map((row) => row.product.sku)).toEqual(['SKU001', 'SKU003']);
    expect(all.body.items.map((row) => [row.product.sku, row.product.active])).toEqual([
      ['SKU001', true],
      ['SKU002', false],
      ['SKU003', true],
    ]);
  });

  describe('store scope', () => {
    it('refuses staff_b01 asking for B02', async () => {
      const staff = await api.signIn('staff_b01');

      const response = await staff.get(`/stock?storeId=${await storeId('B02')}`);

      expect(response).toEqual({ status: 403, body: { code: 'FORBIDDEN', kind: 'correct' } });
    });

    it('refuses staff_b01 naming B01 and B02 together', async () => {
      const staff = await api.signIn('staff_b01');

      const response = await staff.get(
        `/stock?storeId=${await storeId('B01')}&storeId=${await storeId('B02')}`,
      );

      expect(response.status).toBe(403);
    });

    it('gives staff_b01 only B01 without a store filter', async () => {
      const staff = await api.signIn('staff_b01');

      const response = await staff.get<StockList>('/stock');

      expect(new Set(response.body.items.map((row) => row.store.code))).toEqual(new Set(['B01']));
      expect(response.body.total).toBe(3);
    });

    it.each(['buyer01', 'manager01'])(
      'gives %s both stores, ordered by SKU then store',
      async (username) => {
        const caller = await api.signIn(username);

        const response = await caller.get<StockList>('/stock');

        expect(rows(response.body)).toEqual([
          'SKU001 B01 10 pack 3 ok',
          'SKU001 B02 0 pack 3 low',
          'SKU002 B01 5 pack 3 ok',
          'SKU002 B02 0 pack 3 low',
          'SKU003 B01 0 bag 3 low',
          'SKU003 B02 0 bag 3 low',
        ]);
      },
    );

    it('refuses admin01 [C-17]', async () => {
      const admin = await api.signIn('admin01');

      const response = await admin.get('/stock');

      expect(response).toEqual({ status: 403, body: { code: 'FORBIDDEN', kind: 'correct' } });
    });
  });

  describe('paging (UI-02.1, UI-02.2)', () => {
    /** 25 more products, SKU100–SKU124, each with a B01 balance. */
    async function addProducts() {
      const b01 = await storeId('B01');
      for (let n = 100; n < 125; n++) {
        const product = await db.product.create({
          data: {
            sku: `SKU${n}`,
            name: `Product ${n}`,
            category: 'Test',
            unit: 'pc',
            sellingPrice: '1.00',
          },
        });
        await db.stockBalance.create({ data: { productId: product.id, storeId: b01 } });
      }
    }

    it('returns 20 rows by default, in SKU order, with the total', async () => {
      await addProducts();
      const staff = await api.signIn('staff_b01');

      const first = await staff.get<StockList>('/stock');
      const second = await staff.get<StockList>('/stock?page=2');

      expect(first.body).toMatchObject({ total: 28, page: 1, pageSize: 20 });
      expect(first.body.items).toHaveLength(20);
      expect(first.body.items[0]!.product.sku).toBe('SKU001');
      expect(second.body.items.map((row) => row.product.sku)).toEqual([
        'SKU117',
        'SKU118',
        'SKU119',
        'SKU120',
        'SKU121',
        'SKU122',
        'SKU123',
        'SKU124',
      ]);
    });

    it('accepts a page size of 100', async () => {
      await addProducts();
      const staff = await api.signIn('staff_b01');

      const response = await staff.get<StockList>('/stock?pageSize=100');

      expect(response.body.items).toHaveLength(28);
    });

    it('refuses a page size over 100 as a field error', async () => {
      const staff = await api.signIn('staff_b01');

      const response = await staff.get('/stock?pageSize=101');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        kind: 'correct',
        data: { issues: [{ path: ['pageSize'] }] },
      });
    });
  });
});
