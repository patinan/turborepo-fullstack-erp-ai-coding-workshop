import { resetFixture } from '@erp/database';
import { afterAll, afterEach, beforeEach, expect, inject } from 'vitest';
import { db, ledgerViolations } from './db.js';

// Read by ConfigModule when a test file imports AppModule, which happens after this file runs.
process.env.DATABASE_URL = inject('databaseUrl');

beforeEach(async () => {
  await resetFixture(db);
});

// The ledger invariant holds after every integration test (INV-03.1).
afterEach(async () => {
  expect(await ledgerViolations()).toEqual([]);
});

afterAll(async () => {
  await db.$disconnect();
});
