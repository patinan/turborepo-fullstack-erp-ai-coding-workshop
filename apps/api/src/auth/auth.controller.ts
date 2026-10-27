import { Controller, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { contract, type User } from '@erp/contracts';
import { hashPassword, verifyPassword } from '@erp/database';
import { Implement, implement } from '@orpc/nest';
import type { CookieOptions, Response } from 'express';
import { Clock } from '../clock/clock.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../database/prisma.service.js';
import { apiError } from '../errors/api-error.js';
import { ALL_ROLES, CurrentUser, Public, Roles } from './auth.decorators.js';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from './session-token.js';
import { toUser, USER_SELECT } from './user.js';

// Checked when the username is unknown, so that case takes as long as a wrong password.
const unknownUserHash = hashPassword('unknown-user');

@Controller()
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly clock: Clock,
  ) {}

  private get cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/',
    };
  }

  @Public()
  @Implement(contract.auth.login)
  login(@Res({ passthrough: true }) res: Response) {
    return implement(contract.auth.login).handler(async ({ input }) => {
      // The contract has already trimmed and lower-cased the username, as it is stored.
      const found = await this.prisma.user.findUnique({
        where: { username: input.username },
        select: { ...USER_SELECT, passwordHash: true },
      });
      const passwordOk = await verifyPassword(
        input.password,
        found?.passwordHash ?? (await unknownUserHash),
      );
      // The same error for both, so nobody learns which usernames exist.
      if (!found || !passwordOk) throw apiError('INVALID_CREDENTIALS');
      if (!found.active) throw apiError('USER_INACTIVE');

      const token = createSessionToken(
        found.id,
        this.config.get('AUTH_SECRET', { infer: true }),
        this.clock.now().getTime(),
      );
      res.cookie(SESSION_COOKIE, token, { ...this.cookieOptions, maxAge: SESSION_TTL_MS });
      return toUser(found);
    });
  }

  // Needs a session like every other route (NFR-01.1). The web treats the 401 for an already
  // expired session as signed out too.
  @Roles(...ALL_ROLES)
  @Implement(contract.auth.logout)
  logout(@CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
    return implement(contract.auth.logout).handler(async () => {
      // Ends every session issued until now, so a copied cookie stops working too.
      await this.prisma.user.update({
        where: { id: user.id },
        data: { sessionsRevokedAt: this.clock.now() },
      });
      res.clearCookie(SESSION_COOKIE, this.cookieOptions);
    });
  }

  @Public()
  @Implement(contract.auth.me)
  me(@CurrentUser() user: User | undefined) {
    return implement(contract.auth.me).handler(() => ({ user: user ?? null }));
  }
}
