import type { PrismaClient } from './generated/prisma/client.js';
import { Role } from './generated/prisma/enums.js';
import { hashPassword } from './password.js';

/**
 * The release 1 spec §2.3 (TOR §8.1) fixture, shared by the dev seed and the integration tests.
 * Loading it again resets the stores, users and products to their fixture values. Stock is only
 * written where a balance has no movements yet, because movements can't be deleted (ADR-0001);
 * `resetFixture` empties the database first, so tests always start from the fixture stock.
 */

/** Every fixture user's password (also listed on the sign-in page). */
export const FIXTURE_PASSWORD = 'password';

export const fixtureStores = [
  { code: 'B01', name: 'Central Store' },
  { code: 'B02', name: 'Riverside Store' },
] as const;

type StoreCode = (typeof fixtureStores)[number]['code'];

export const fixtureUsers: { username: string; name: string; role: Role; store?: StoreCode }[] = [
  { username: 'admin01', name: 'Admin 01', role: Role.ADMIN },
  { username: 'buyer01', name: 'Buyer 01', role: Role.PURCHASING },
  { username: 'staff_b01', name: 'Staff B01', role: Role.STORE_STAFF, store: 'B01' },
  { username: 'staff_b02', name: 'Staff B02', role: Role.STORE_STAFF, store: 'B02' },
  { username: 'manager01', name: 'Manager 01', role: Role.MANAGER },
];

export const fixtureProducts = [
  {
    sku: 'SKU001',
    name: 'Drinking water pack of 6',
    category: 'Beverages',
    unit: 'pack',
    sellingPrice: '60.00',
  },
  {
    sku: 'SKU002',
    name: 'Tissue paper',
    category: 'Household',
    unit: 'pack',
    sellingPrice: '35.00',
  },
  {
    sku: 'SKU003',
    name: 'Laundry detergent',
    category: 'Household',
    unit: 'bag',
    sellingPrice: '120.00',
  },
] as const;

type Sku = (typeof fixtureProducts)[number]['sku'];

/** Every product's reorder threshold, in both stores. */
export const FIXTURE_REORDER_THRESHOLD = 3;

/** Opening stock, each written as an `OPENING` movement. Every other balance is 0 with no movement. */
export const fixtureOpeningStock: { store: StoreCode; sku: Sku; quantity: number }[] = [
  { store: 'B01', sku: 'SKU001', quantity: 10 },
  { store: 'B01', sku: 'SKU002', quantity: 5 },
];

export async function loadFixture(prisma: PrismaClient) {
  const storeIds = new Map<string, string>();
  for (const store of fixtureStores) {
    const { id } = await prisma.store.upsert({
      where: { code: store.code },
      update: { name: store.name },
      create: store,
    });
    storeIds.set(store.code, id);
  }

  const passwordHash = await hashPassword(FIXTURE_PASSWORD);
  for (const { store, ...user } of fixtureUsers) {
    const values = {
      ...user,
      passwordHash,
      storeId: store ? storeIds.get(store)! : null,
      active: true,
      sessionsRevokedAt: null,
    };
    await prisma.user.upsert({
      where: { username: user.username },
      update: values,
      create: values,
    });
  }

  const productIds = new Map<string, string>();
  for (const product of fixtureProducts) {
    const values = { ...product, active: true };
    const { id } = await prisma.product.upsert({
      where: { sku: product.sku },
      update: values,
      create: values,
    });
    productIds.set(product.sku, id);
  }

  // One balance row per product × store, created eagerly.
  for (const productId of productIds.values()) {
    for (const storeId of storeIds.values()) {
      await prisma.stockBalance.upsert({
        where: { productId_storeId: { productId, storeId } },
        update: { reorderThreshold: FIXTURE_REORDER_THRESHOLD },
        create: { productId, storeId, reorderThreshold: FIXTURE_REORDER_THRESHOLD },
      });
    }
  }

  for (const opening of fixtureOpeningStock) {
    const productId = productIds.get(opening.sku)!;
    const storeId = storeIds.get(opening.store)!;
    await prisma.$transaction(async (tx) => {
      if (await tx.stockMovement.count({ where: { productId, storeId } })) return;
      const { quantity } = await tx.stockBalance.update({
        where: { productId_storeId: { productId, storeId } },
        data: { quantity: { increment: opening.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId,
          storeId,
          type: 'OPENING',
          quantityChange: opening.quantity,
          balanceBefore: quantity - opening.quantity,
          balanceAfter: quantity,
        },
      });
    });
  }
}

/**
 * Empty every table and load the fixture: the state each integration test starts from.
 * TRUNCATE is used because the movement trigger rejects DELETE (ADR-0001). Never run it on real data.
 */
export async function resetFixture(prisma: PrismaClient) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
  await loadFixture(prisma);
}
