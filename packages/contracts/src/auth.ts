import { oc } from '@orpc/contract';
import * as z from 'zod';

/** Administrator, Purchasing officer, Store employee, Manager. */
export const RoleSchema = z.enum(['ADMIN', 'PURCHASING', 'STORE_STAFF', 'MANAGER']);
export type Role = z.infer<typeof RoleSchema>;

export const StoreRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type StoreRef = z.infer<typeof StoreRefSchema>;

const userFields = {
  id: z.string(),
  username: z.string(),
  name: z.string(),
};

/**
 * The signed-in user as the API exposes it (never includes the password hash).
 * A store employee has exactly one assigned store; every other role has none [C-18].
 */
export const UserSchema = z.discriminatedUnion('role', [
  z.object({ ...userFields, role: z.literal('STORE_STAFF'), store: StoreRefSchema }),
  z.object({
    ...userFields,
    role: RoleSchema.exclude(['STORE_STAFF']),
    store: z.null(),
  }),
]);
export type User = z.infer<typeof UserSchema>;

/** Usernames are trimmed and case-insensitive [C-20], so they are compared in this form. */
export const UsernameSchema = z.string().trim().toLowerCase().min(1);

// Strict: an `email` field from an old client is an error, not silently ignored.
export const LoginInputSchema = z.strictObject({
  username: UsernameSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const SessionSchema = z.object({
  user: UserSchema.nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

export const authContract = {
  login: oc
    .route({
      method: 'POST',
      path: '/auth/login',
      summary: 'Sign in with username and password',
      tags: ['Auth'],
    })
    .input(LoginInputSchema)
    .output(UserSchema),
  logout: oc.route({ method: 'POST', path: '/auth/logout', summary: 'Sign out', tags: ['Auth'] }),
  me: oc
    .route({
      method: 'GET',
      path: '/auth/me',
      summary: 'The signed-in user, or null',
      tags: ['Auth'],
    })
    .output(SessionSchema),
};
