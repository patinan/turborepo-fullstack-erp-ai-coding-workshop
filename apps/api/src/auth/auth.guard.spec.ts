import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../database/prisma.service.js';
import { type AuthenticatedRequest, Public, Roles } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';
import { createSessionToken, SESSION_COOKIE } from './session-token.js';
import type { UserRow } from './user.js';

const secret = 'test-secret-that-is-at-least-32-characters';
const b01 = { id: 's1', code: 'B01', name: 'Central Store' };
const staff = {
  id: 'u1',
  username: 'staff_b01',
  name: 'Staff B01',
  role: 'STORE_STAFF',
  store: b01,
};
const staffRow: UserRow = { ...staff, role: 'STORE_STAFF', active: true, sessionsRevokedAt: null };

class RoutesUnderTest {
  @Public()
  open() {}

  closed() {}

  @Roles('ADMIN')
  adminOnly() {}
}

function setup(user: UserRow | null) {
  const findUnique = vi.fn().mockResolvedValue(user);
  const guard = new AuthGuard(
    new Reflector(),
    { user: { findUnique } } as unknown as PrismaService,
    { get: () => secret } as unknown as ConfigService<Env, true>,
  );

  function run(route: keyof RoutesUnderTest, cookie?: string) {
    const request = { headers: { cookie } } as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => RoutesUnderTest.prototype[route],
      getClass: () => RoutesUnderTest,
    } as unknown as ExecutionContext;
    return { request, result: guard.canActivate(context) };
  }

  return { run, findUnique };
}

const sessionCookie = (userId: string, issuedAt = Date.now()) =>
  `${SESSION_COOKIE}=${createSessionToken(userId, secret, issuedAt)}`;
const rejectsWith = (code: string) => expect.objectContaining({ code });

describe('AuthGuard', () => {
  it('lets anyone call a @Public() route', async () => {
    const { run } = setup(null);

    await expect(run('open').result).resolves.toBe(true);
  });

  it('rejects a protected route without a session', async () => {
    const { run } = setup(staffRow);

    await expect(run('closed').result).rejects.toEqual(rejectsWith('UNAUTHENTICATED'));
  });

  it('rejects a tampered cookie', async () => {
    const { run, findUnique } = setup(staffRow);

    await expect(run('closed', `${SESSION_COOKIE}=u1.9999999999999.forged`).result).rejects.toEqual(
      rejectsWith('UNAUTHENTICATED'),
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a session whose user no longer exists', async () => {
    const { run } = setup(null);

    await expect(run('closed', sessionCookie('gone')).result).rejects.toEqual(
      rejectsWith('UNAUTHENTICATED'),
    );
  });

  it('attaches the signed-in user to the request', async () => {
    const { run } = setup(staffRow);
    const { request, result } = run('closed', sessionCookie('u1'));

    await expect(result).resolves.toBe(true);
    expect(request.user).toEqual(staff);
  });

  it('rejects a user without the required role', async () => {
    const { run } = setup(staffRow);

    await expect(run('adminOnly', sessionCookie('u1')).result).rejects.toEqual(
      rejectsWith('FORBIDDEN'),
    );
  });

  it('allows a user with the required role', async () => {
    const { run } = setup({ ...staffRow, role: 'ADMIN', store: null });

    await expect(run('adminOnly', sessionCookie('u1')).result).resolves.toBe(true);
  });

  it('rejects a deactivated user on their next request', async () => {
    const { run } = setup({ ...staffRow, active: false });

    await expect(run('closed', sessionCookie('u1')).result).rejects.toEqual(
      rejectsWith('USER_INACTIVE'),
    );
  });

  it('rejects a session issued before the user signed out', async () => {
    const signedOutAt = new Date();
    const { run } = setup({ ...staffRow, sessionsRevokedAt: signedOutAt });

    await expect(
      run('closed', sessionCookie('u1', signedOutAt.getTime() - 1000)).result,
    ).rejects.toEqual(rejectsWith('UNAUTHENTICATED'));
  });

  it('accepts a session issued after the user signed out', async () => {
    const signedOutAt = new Date(Date.now() - 1000);
    const { run } = setup({ ...staffRow, sessionsRevokedAt: signedOutAt });

    await expect(run('closed', sessionCookie('u1')).result).resolves.toBe(true);
  });
});
