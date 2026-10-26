import { describe, expect, it } from 'vitest';
import { LoginInputSchema, RoleSchema, SessionSchema } from './auth.js';

describe('LoginInputSchema', () => {
  it('accepts a username and password', () => {
    const result = LoginInputSchema.safeParse({ username: 'staff_b01', password: 'password' });

    expect(result.data).toEqual({ username: 'staff_b01', password: 'password' });
  });

  it('trims the username and ignores its case', () => {
    const result = LoginInputSchema.safeParse({ username: ' STAFF_B01 ', password: 'password' });

    expect(result.data?.username).toBe('staff_b01');
  });

  it('rejects an email field', () => {
    const result = LoginInputSchema.safeParse({
      username: 'staff_b01',
      email: 'staff@erp.local',
      password: 'password',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an email in place of a username', () => {
    const result = LoginInputSchema.safeParse({ email: 'staff@erp.local', password: 'password' });

    expect(result.success).toBe(false);
  });

  it('rejects a blank username', () => {
    const result = LoginInputSchema.safeParse({ username: '   ', password: 'password' });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['username']]);
  });

  it('rejects a blank password', () => {
    const result = LoginInputSchema.safeParse({ username: 'staff_b01', password: '' });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['password']]);
  });
});

describe('RoleSchema', () => {
  it('has exactly the four roles', () => {
    expect(RoleSchema.options).toEqual(['ADMIN', 'PURCHASING', 'STORE_STAFF', 'MANAGER']);
  });
});

describe('SessionSchema', () => {
  const b01 = { id: 's1', code: 'B01', name: 'Central Store' };
  const staff = { id: 'u1', username: 'staff_b01', name: 'Staff B01', role: 'STORE_STAFF' };
  const manager = { id: 'u2', username: 'manager01', name: 'Manager', role: 'MANAGER' };

  it('accepts a signed-out session', () => {
    expect(SessionSchema.safeParse({ user: null }).success).toBe(true);
  });

  it('accepts a store employee with their store', () => {
    const user = { ...staff, store: b01 };

    expect(SessionSchema.safeParse({ user }).data).toEqual({ user });
  });

  it('accepts another role without a store', () => {
    expect(SessionSchema.safeParse({ user: { ...manager, store: null } }).success).toBe(true);
  });

  it('rejects a store employee without a store', () => {
    expect(SessionSchema.safeParse({ user: { ...staff, store: null } }).success).toBe(false);
  });

  it('rejects another role with a store', () => {
    expect(SessionSchema.safeParse({ user: { ...manager, store: b01 } }).success).toBe(false);
  });

  it('rejects an unknown role', () => {
    const result = SessionSchema.safeParse({ user: { ...manager, role: 'STAFF', store: null } });

    expect(result.success).toBe(false);
  });
});
