-- Sign-in moves from email to username, and the two starter roles become the four release 1 roles.
-- The starter's demo users can't be converted, so they are removed; `pnpm db:seed` loads the §8.1 users.
DELETE FROM "User";

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'PURCHASING', 'STORE_STAFF', 'MANAGER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "email",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sessionsRevokedAt" TIMESTAMP(3),
ADD COLUMN     "storeId" TEXT,
ADD COLUMN     "username" TEXT NOT NULL,
ALTER COLUMN "role" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Usernames are stored trimmed and lower-cased, so the unique index is case-insensitive [C-20].
ALTER TABLE "User" ADD CONSTRAINT "User_username_normalized" CHECK ("username" = lower(btrim("username")) AND "username" <> '');

-- A store employee has exactly one assigned store; every other role has none [C-18].
ALTER TABLE "User" ADD CONSTRAINT "User_store_only_for_store_staff" CHECK (("role" = 'STORE_STAFF') = ("storeId" IS NOT NULL));
