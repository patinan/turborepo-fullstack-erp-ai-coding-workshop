import { execFileSync } from 'node:child_process';
import { createPrismaClient } from '@erp/database';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The integration test database. Every test empties it and loads the §8.1 fixture. */
    databaseUrl: string;
  }
}

/**
 * Before the integration tests: create the `<database>_test` database next to DATABASE_URL's
 * (the compose Postgres locally, the service container in CI) and apply every migration.
 */
export default async function setup(project: TestProject) {
  const devUrl = process.env.DATABASE_URL ?? 'postgresql://erp:erp@localhost:5432/erp';
  const url = new URL(devUrl);
  const name = `${url.pathname.slice(1)}_test`;
  url.pathname = `/${name}`;

  const prisma = createPrismaClient(devUrl);
  try {
    const found = await prisma.$queryRaw<
      unknown[]
    >`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (!found.length) await prisma.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await prisma.$disconnect();
  }

  execFileSync('pnpm', ['--filter', '@erp/database', 'exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url.href },
    stdio: 'inherit',
  });

  project.provide('databaseUrl', url.href);
}
