# AGENTS.md (apps/api)

Rules for `@erp/api` (NestJS 12, native ESM, oRPC via `@orpc/nest`, Prisma via `@erp/database`). The [root AGENTS.md](../../AGENTS.md) still applies.

- **One Nest module per feature** in `src/<feature>/` (`<feature>.module.ts`, `<feature>.controller.ts`), registered in `src/app.module.ts`.
- **Implement contract routes, don't declare your own.** Every handler is `@Implement(contract.<feature>.<route>)` returning `implement(contract.<feature>.<route>).handler(...)`. Reference: `src/health/health.controller.ts`.
- **No `class-validator` DTOs.** Input is already validated and typed by the contract's Zod schemas.
- **Database access** only through the injected `PrismaService` (`src/database`, global). Never create a `PrismaClient` yourself. The one exception is the integration-test harness (`src/test/db.ts`), which reads and resets the test database directly.
- **Every route declares who may call it** (global `AuthGuard`, ADR-0004): `@Public()` for anyone, or `@Roles(...)` for signed-in users with those roles (`@Roles(...ALL_ROLES)` for any). A route with neither is refused with `FORBIDDEN`. Store-scoped reads add `@StoreScope('<query param>')`: a store employee naming another store gets `FORBIDDEN`, and the handler must still limit them to `user.store` when the parameter is left out. Read the user with a `@CurrentUser() user: User` parameter on the `@Implement` method. All of these live in `src/auth/auth.decorators.ts`.
- **Every new route gets a row** in the permission matrix in `src/auth/permissions.int.spec.ts`, from the spec's §4.2. The test fails until it has one.
- **Read the time from the injected `Clock`** (`src/clock`), never `new Date()` or `Date.now()`, so integration tests can fix it.
- The global prefix is `/api`. Contract paths don't repeat it.
- Tests are colocated: `*.spec.ts` for unit specs with a stubbed Prisma, `*.int.spec.ts` for integration tests against the real API and Postgres. See the `write-tests` skill.
