import { createPrismaClient } from '@erp/database';
import { inject } from 'vitest';

/** Direct access to the integration test database, for setting up and checking what the API can't. */
export const db = createPrismaClient(inject('databaseUrl'));

/** Product × store pairs whose balance is negative or differs from the sum of their movements (INV-03). */
export function ledgerViolations() {
  return db.$queryRaw<
    { productId: string; storeId: string; quantity: number | null; movements: number }[]
  >`
    SELECT COALESCE(b."productId", m."productId") AS "productId",
           COALESCE(b."storeId", m."storeId") AS "storeId",
           b."quantity",
           COALESCE(m."total", 0)::int AS "movements"
    FROM "StockBalance" b
    FULL JOIN (
      SELECT "productId", "storeId", SUM("quantityChange") AS "total"
      FROM "StockMovement"
      GROUP BY "productId", "storeId"
    ) m ON m."productId" = b."productId" AND m."storeId" = b."storeId"
    WHERE b."quantity" IS NULL OR b."quantity" < 0 OR b."quantity" <> COALESCE(m."total", 0)`;
}
