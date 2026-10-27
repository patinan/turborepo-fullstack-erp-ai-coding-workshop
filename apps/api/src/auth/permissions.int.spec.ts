import { contract } from '@erp/contracts';
import { FIXTURE_PASSWORD } from '@erp/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type ApiCaller, startApi, type TestApi } from '../test/api.js';
import { db } from '../test/db.js';

/**
 * The release 1 spec §4.2 permission matrix, route by caller (NFR-01.2, ADR-0004). Every contract
 * route needs a row, so a new route can't ship without deciding who may call it.
 */
const CALLERS = ['anonymous', 'admin01', 'buyer01', 'staff_b01', 'staff_b02', 'manager01'] as const;
type Caller = (typeof CALLERS)[number];

/** `own-store`: allowed for the caller's assigned store, FORBIDDEN for any other. */
type Access = 'allow' | 'deny' | 'own-store';

type Row = {
  /** The request to send. Store-scoped routes are called once for B01 and once for B02. */
  request: (storeId: string) => { method: 'GET' | 'POST'; path: string; body?: unknown };
  storeScoped?: boolean;
  access: Record<Caller, Access>;
};

const everyone = (access: Access): Record<Caller, Access> =>
  Object.fromEntries(CALLERS.map((caller) => [caller, access])) as Record<Caller, Access>;
const signedIn = (access: Omit<Record<Caller, Access>, 'anonymous'>) => ({
  anonymous: 'deny' as const,
  ...access,
});

const MATRIX: Record<string, Row> = {
  'health.check': {
    request: () => ({ method: 'GET', path: '/health' }),
    access: everyone('allow'),
  },
  'auth.login': {
    request: () => ({
      method: 'POST',
      path: '/auth/login',
      body: { username: 'staff_b01', password: FIXTURE_PASSWORD },
    }),
    access: everyone('allow'),
  },
  'auth.me': { request: () => ({ method: 'GET', path: '/auth/me' }), access: everyone('allow') },
  'auth.logout': {
    request: () => ({ method: 'POST', path: '/auth/logout' }),
    access: signedIn({
      admin01: 'allow',
      buyer01: 'allow',
      staff_b01: 'allow',
      staff_b02: 'allow',
      manager01: 'allow',
    }),
  },
  // Stock and low-stock screen: purchasing all stores [C-01], store employee own store, manager all,
  // administrator none [C-17].
  'stock.list': {
    request: (storeId) => ({ method: 'GET', path: `/stock?storeId=${storeId}` }),
    storeScoped: true,
    access: signedIn({
      admin01: 'deny',
      buyer01: 'allow',
      staff_b01: 'own-store',
      staff_b02: 'own-store',
      manager01: 'allow',
    }),
  },
};

/** Every route in the contract, as `feature.route` keys. */
function contractRoutes(router: object = contract, prefix = ''): string[] {
  return Object.entries(router).flatMap(([name, value]: [string, object]) =>
    '~orpc' in value ? [`${prefix}${name}`] : contractRoutes(value, `${prefix}${name}.`),
  );
}

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.close());

const STORE_OF: Partial<Record<Caller, string>> = { staff_b01: 'B01', staff_b02: 'B02' };

async function caller(name: Caller): Promise<ApiCaller> {
  return name === 'anonymous' ? api.anonymous : api.signIn(name);
}

describe('Permission matrix', () => {
  it('has exactly one row for every contract route', () => {
    expect(Object.keys(MATRIX).sort()).toEqual(contractRoutes().sort());
  });

  it('allows or denies every route for every caller as §4.2 says (NFR-01.2)', async () => {
    const stores = await db.store.findMany({ where: { code: { in: ['B01', 'B02'] } } });
    const results: string[] = [];
    const expected: string[] = [];

    for (const [route, row] of Object.entries(MATRIX)) {
      const storeCodes = row.storeScoped ? ['B01', 'B02'] : ['B01'];
      for (const name of CALLERS) {
        for (const code of storeCodes) {
          const storeId = stores.find((store) => store.code === code)!.id;
          const { method, path, body } = row.request(storeId);
          // A fresh session per call, as signing out ends the caller's earlier sessions.
          const response = await (await caller(name)).send(method, path, body);

          const access = row.access[name];
          const allowed = access === 'own-store' ? STORE_OF[name] === code : access === 'allow';
          const label = `${route} as ${name}${row.storeScoped ? ` for ${code}` : ''}`;
          expected.push(
            `${label}: ${allowed ? 'allowed' : name === 'anonymous' ? 'UNAUTHENTICATED' : 'FORBIDDEN'}`,
          );
          results.push(`${label}: ${outcome(response)}`);
        }
      }
    }

    expect(results).toEqual(expected);
  });

  it('answers every route but sign-in, the current user and health with UNAUTHENTICATED and no data when signed out (NFR-01.1)', async () => {
    const stores = await db.store.findMany();
    const open: string[] = [];

    for (const route of contractRoutes()) {
      const { method, path, body } = MATRIX[route]!.request(stores[0]!.id);
      const response = await api.anonymous.send(method, path, body);
      if (outcome(response) === 'allowed') open.push(route);
      else
        expect(response).toEqual({
          status: 401,
          body: { code: 'UNAUTHENTICATED', kind: 'correct' },
        });
    }

    expect(open.sort()).toEqual(['auth.login', 'auth.me', 'health.check']);
  });
});

/** `allowed`, or the error code when the body is exactly a refusal with no business data. */
function outcome(response: { status: number; body: unknown }): string {
  if (response.status < 400) return 'allowed';
  const { body } = response;
  const refusals = [
    { status: 401, body: { code: 'UNAUTHENTICATED', kind: 'correct' } },
    { status: 403, body: { code: 'FORBIDDEN', kind: 'correct' } },
  ];
  const refusal = refusals.find(
    (candidate) =>
      candidate.status === response.status &&
      JSON.stringify(candidate.body) === JSON.stringify(body),
  );
  return refusal ? refusal.body.code : `unexpected ${response.status} ${JSON.stringify(body)}`;
}
