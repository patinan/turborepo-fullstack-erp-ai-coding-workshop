import type { PrismaClient } from './generated/prisma/client.js';
import { Role } from './generated/prisma/enums.js';
import { hashPassword } from './password.js';

/**
 * The release 1 spec §2.3 (TOR §8.1) fixture, shared by the dev seed and the integration tests.
 * Loading it again resets these rows to their fixture values.
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
}
