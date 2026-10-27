import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Role } from '@erp/contracts';
import { Clock } from '../clock/clock.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../database/prisma.service.js';
import { apiError } from '../errors/api-error.js';
import {
  type AuthenticatedRequest,
  IS_PUBLIC_KEY,
  ROLES_KEY,
  STORE_SCOPE_KEY,
} from './auth.decorators.js';
import { readCookie, SESSION_COOKIE, verifySessionToken } from './session-token.js';
import { toUser, USER_SELECT, type UserRow } from './user.js';

/**
 * Registered globally in AuthModule. Loads the user from the session cookie into `request.user`
 * on every request, so deactivation or a role change applies at once (ADR-0004). Then, unless the
 * route is `@Public()`, rejects the request without a valid session (UNAUTHENTICATED,
 * USER_INACTIVE), when the role isn't in `@Roles()` or the route declares none (FORBIDDEN), and
 * when a store employee asks a `@StoreScope()` route for another store (FORBIDDEN).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly clock: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const targets = [context.getHandler(), context.getClass()];

    const row = await this.loadSessionUser(request);
    if (row?.active) request.user = toUser(row);

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (row && !row.active) throw apiError('USER_INACTIVE');
    if (!request.user) throw apiError('UNAUTHENTICATED');

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (!roles?.includes(request.user.role)) throw apiError('FORBIDDEN');

    const storeParameter = this.reflector.getAllAndOverride<string | undefined>(
      STORE_SCOPE_KEY,
      targets,
    );
    if (storeParameter && request.user.store) {
      // A repeated parameter arrives as an array: every value must be the employee's own store.
      const asked = [request.query?.[storeParameter] ?? []].flat();
      if (asked.some((storeId) => storeId !== request.user!.store!.id)) throw apiError('FORBIDDEN');
    }

    return true;
  }

  /** The user behind a valid, unexpired session that was not signed out, or null. */
  private async loadSessionUser(request: AuthenticatedRequest): Promise<UserRow | null> {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const secret = this.config.get('AUTH_SECRET', { infer: true });
    const session = token && verifySessionToken(token, secret, this.clock.now().getTime());
    if (!session) return null;

    const row = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: USER_SELECT,
    });
    const signedOut = row?.sessionsRevokedAt && session.issuedAt <= row.sessionsRevokedAt;
    return row && !signedOut ? row : null;
  }
}
