import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { User } from '@erp/contracts';
import { hashPassword } from '@erp/database';
import { call } from '@orpc/server';
import type { Response } from 'express';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Clock } from '../clock/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthController } from './auth.controller.js';
import { SESSION_COOKIE, verifySessionToken } from './session-token.js';

const secret = 'test-secret-that-is-at-least-32-characters';
const staff: User = {
  id: 'u1',
  username: 'staff_b01',
  name: 'Staff B01',
  role: 'STORE_STAFF',
  store: { id: 's1', code: 'B01', name: 'Central Store' },
};
const staffRow = { ...staff, active: true, sessionsRevokedAt: null };

async function createController(findUnique = vi.fn(), update = vi.fn()) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      Clock,
      { provide: PrismaService, useValue: { user: { findUnique, update } } },
      {
        provide: ConfigService,
        useValue: { get: (key: string) => (key === 'AUTH_SECRET' ? secret : 'test') },
      },
    ],
  }).compile();
  return moduleRef.get(AuthController);
}

function fakeResponse() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response & {
    cookie: ReturnType<typeof vi.fn>;
    clearCookie: ReturnType<typeof vi.fn>;
  };
}

describe('AuthController', () => {
  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await hashPassword('password');
  });

  it('signs in and sets a signed session cookie for 12 hours', async () => {
    const findUnique = vi.fn().mockResolvedValue({ ...staffRow, passwordHash });
    const controller = await createController(findUnique);
    const res = fakeResponse();

    await expect(
      call(controller.login(res), { username: ' STAFF_B01 ', password: 'password' }),
    ).resolves.toEqual(staff);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: 'staff_b01' } }),
    );
    const [name, token, options] = res.cookie.mock.calls[0]!;
    expect(name).toBe(SESSION_COOKIE);
    expect(verifySessionToken(token, secret)?.userId).toBe('u1');
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 });
  });

  it('rejects a wrong password without setting a cookie', async () => {
    const controller = await createController(
      vi.fn().mockResolvedValue({ ...staffRow, passwordHash }),
    );
    const res = fakeResponse();

    await expect(
      call(controller.login(res), { username: 'staff_b01', password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rejects an unknown username with the same error', async () => {
    const controller = await createController(vi.fn().mockResolvedValue(null));

    await expect(
      call(controller.login(fakeResponse()), { username: 'nobody', password: 'password' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('rejects a deactivated user with the right password', async () => {
    const controller = await createController(
      vi.fn().mockResolvedValue({ ...staffRow, active: false, passwordHash }),
    );

    await expect(
      call(controller.login(fakeResponse()), { username: 'staff_b01', password: 'password' }),
    ).rejects.toMatchObject({ code: 'USER_INACTIVE' });
  });

  it('ends the user’s sessions and clears the cookie on logout', async () => {
    const update = vi.fn();
    const controller = await createController(vi.fn(), update);
    const res = fakeResponse();

    await call(controller.logout(staff, res), undefined);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { sessionsRevokedAt: expect.any(Date) },
    });
    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE, expect.any(Object));
  });

  it('returns the current user, or null when signed out', async () => {
    const controller = await createController();

    await expect(call(controller.me(staff), undefined)).resolves.toEqual({ user: staff });
    await expect(call(controller.me(undefined), undefined)).resolves.toEqual({ user: null });
  });
});
