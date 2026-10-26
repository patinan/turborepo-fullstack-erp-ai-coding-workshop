import type { User } from '@erp/contracts';
import type { Prisma } from '@erp/database';

/** What the guard and login load for a user: the contract `User` plus the session checks. */
export const USER_SELECT = {
  id: true,
  username: true,
  name: true,
  role: true,
  active: true,
  sessionsRevokedAt: true,
  store: { select: { id: true, code: true, name: true } },
} as const satisfies Prisma.UserSelect;

export type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/** The user as the API exposes it. A CHECK guarantees a store exactly for STORE_STAFF [C-18]. */
export function toUser({ id, username, name, role, store }: UserRow): User {
  return role === 'STORE_STAFF'
    ? { id, username, name, role, store: store! }
    : { id, username, name, role, store: null };
}
