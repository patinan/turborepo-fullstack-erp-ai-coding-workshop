import { describe, expect, it } from 'vitest';
import { db, ledgerViolations } from '../test/db.js';

/** The B01 balance of a fixture product. */
async function b01Balance(sku: string) {
  return db.stockBalance.findFirstOrThrow({
    where: { product: { sku }, store: { code: 'B01' } },
  });
}

describe('Stock ledger in the database', () => {
  it('loads the §8.1 opening stock as OPENING movements', async () => {
    const movements = await db.stockMovement.findMany({
      select: {
        type: true,
        quantityChange: true,
        balanceBefore: true,
        balanceAfter: true,
        product: { select: { sku: true } },
        store: { select: { code: true } },
      },
      orderBy: { product: { sku: 'asc' } },
    });

    expect(movements).toEqual([
      {
        type: 'OPENING',
        quantityChange: 10,
        balanceBefore: 0,
        balanceAfter: 10,
        product: { sku: 'SKU001' },
        store: { code: 'B01' },
      },
      {
        type: 'OPENING',
        quantityChange: 5,
        balanceBefore: 0,
        balanceAfter: 5,
        product: { sku: 'SKU002' },
        store: { code: 'B01' },
      },
    ]);
  });

  it('rejects a direct SQL UPDATE of a movement (INV-02.2)', async () => {
    await expect(
      db.$executeRaw`UPDATE "StockMovement" SET "quantityChange" = 11, "balanceAfter" = 11`,
    ).rejects.toThrow(/cannot be changed or deleted/);
  });

  it('rejects a direct SQL DELETE of a movement (INV-02.2)', async () => {
    await expect(db.$executeRaw`DELETE FROM "StockMovement"`).rejects.toThrow(
      /cannot be changed or deleted/,
    );
    expect(await db.stockMovement.count()).toBe(2);
  });

  it('rejects a direct SQL update that sets a balance to -1 (INV-03.3)', async () => {
    const { id } = await b01Balance('SKU003');

    await expect(
      db.$executeRaw`UPDATE "StockBalance" SET "quantity" = -1 WHERE "id" = ${id}`,
    ).rejects.toThrow(/StockBalance_quantity_not_negative/);
    expect((await b01Balance('SKU003')).quantity).toBe(0);
  });

  it('reports a balance that differs from its movements until a movement explains it', async () => {
    const balance = await b01Balance('SKU003');
    await db.stockBalance.update({ where: { id: balance.id }, data: { quantity: 4 } });

    expect(await ledgerViolations()).toEqual([
      { productId: balance.productId, storeId: balance.storeId, quantity: 4, movements: 0 },
    ]);

    await db.stockMovement.create({
      data: {
        productId: balance.productId,
        storeId: balance.storeId,
        type: 'OPENING',
        quantityChange: 4,
        balanceBefore: 0,
        balanceAfter: 4,
      },
    });
    expect(await ledgerViolations()).toEqual([]);
  });
});
