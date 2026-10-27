import {
  createPrismaClient,
  FIXTURE_PASSWORD,
  fixtureProducts,
  fixtureUsers,
  loadFixture,
} from '../src/index.js';

const prisma = createPrismaClient(
  process.env.DATABASE_URL ?? 'postgresql://erp:erp@localhost:5432/erp',
);

// The §8.1 stores, users, products and opening stock. Re-running the seed resets the stores, users
// and products, and leaves stock that has movements alone.
try {
  await loadFixture(prisma);
  console.log(
    `Seeded ${fixtureUsers.length} test users (password: "${FIXTURE_PASSWORD}") and ${fixtureProducts.length} products.`,
  );
} finally {
  await prisma.$disconnect();
}
