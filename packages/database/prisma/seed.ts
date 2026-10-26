import { createPrismaClient, FIXTURE_PASSWORD, fixtureUsers, loadFixture } from '../src/index.js';

const prisma = createPrismaClient(
  process.env.DATABASE_URL ?? 'postgresql://erp:erp@localhost:5432/erp',
);

// The §8.1 test stores and users (also shown on the sign-in page). Re-running the seed resets them.
try {
  await loadFixture(prisma);
  console.log(`Seeded ${fixtureUsers.length} test users (password: "${FIXTURE_PASSWORD}").`);
} finally {
  await prisma.$disconnect();
}
