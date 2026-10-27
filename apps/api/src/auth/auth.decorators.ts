import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import { type Role, RoleSchema, type User } from '@erp/contracts';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';
export const STORE_SCOPE_KEY = 'auth:storeScope';

/**
 * Every route declares who may call it (ADR-0004): `@Public()` for anyone, or `@Roles(...)`.
 * A route with neither is refused with FORBIDDEN, so a forgotten declaration fails closed.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Only signed-in users with one of these roles may call the route, e.g. `@Roles('ADMIN')`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Every role: for routes any signed-in user may call. */
export const ALL_ROLES = RoleSchema.options;

/**
 * The route reads store data, chosen by this query parameter. A store employee naming any store
 * but their assigned one gets FORBIDDEN. The handler must still limit them to their store when
 * the parameter is left out.
 */
export const StoreScope = (queryParameter: string) => SetMetadata(STORE_SCOPE_KEY, queryParameter);

/** The request after `AuthGuard` has run. `user` is unset on public routes without a session. */
export type AuthenticatedRequest = Request & { user?: User };

/** The signed-in user, set by `AuthGuard`. Use as a parameter decorator next to `@Implement(...)`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
