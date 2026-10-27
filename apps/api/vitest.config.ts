import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Controller and service logic with a stubbed PrismaService.
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          exclude: ['src/**/*.int.spec.ts'],
        },
      },
      {
        // The real API against the `erp_test` database, reset to the §8.1 fixture before every test.
        test: {
          name: 'integration',
          include: ['src/**/*.int.spec.ts'],
          globalSetup: ['src/test/global-setup.ts'],
          setupFiles: ['src/test/setup.ts'],
          // Every file shares one database.
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
