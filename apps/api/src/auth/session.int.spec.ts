import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { startApi, type TestApi } from '../test/api.js';

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterEach(() => api.clock.set(null));
afterAll(() => api.close());

const HOUR = 60 * 60 * 1000;
const SECOND = 1000;

describe('Session lifetime [C-16]', () => {
  const signedInAt = new Date('2026-11-02T03:00:00Z');

  it('still works 12 hours less 1 second after sign-in', async () => {
    api.clock.set(signedInAt);
    const staff = await api.signIn('staff_b01');

    api.clock.set(new Date(signedInAt.getTime() + 12 * HOUR - SECOND));

    expect((await staff.get('/stock')).status).toBe(200);
  });

  it('returns UNAUTHENTICATED 12 hours and 1 second after sign-in (NFR-01.5)', async () => {
    api.clock.set(signedInAt);
    const staff = await api.signIn('staff_b01');

    api.clock.set(new Date(signedInAt.getTime() + 12 * HOUR + SECOND));

    expect(await staff.get('/stock')).toEqual({
      status: 401,
      body: { code: 'UNAUTHENTICATED', kind: 'correct' },
    });
  });
});
