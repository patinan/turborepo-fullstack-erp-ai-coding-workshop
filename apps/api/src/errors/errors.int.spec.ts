import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { startApi, type TestApi } from '../test/api.js';

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => api.close());

describe('Unexpected failures (NFR-04.3)', () => {
  it('answer INTERNAL_ERROR, kind retry, without a stack trace, SQL, table name or Prisma text', async () => {
    const staff = await api.signIn('staff_b01');
    const prisma = api.app.get(PrismaService);
    // What Prisma throws for a missing table: SQL, a table name and Prisma's own wording.
    const failure = Object.assign(
      new Error(
        'Invalid `prisma.stockBalance.findMany()` invocation: The table `public.StockBalance` does not exist ' +
          'in the current database. SELECT "public"."StockBalance"."id" FROM "public"."StockBalance"',
      ),
      { name: 'PrismaClientKnownRequestError', code: 'P2021' },
    );
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValue(failure);

    const response = await staff.get('/stock');

    expect(transaction).toHaveBeenCalledOnce();
    expect(response).toEqual({ status: 500, body: { code: 'INTERNAL_ERROR', kind: 'retry' } });
    expect(JSON.stringify(response.body)).not.toMatch(/StockBalance|SELECT|prisma|P2021|at /i);
  });
});
