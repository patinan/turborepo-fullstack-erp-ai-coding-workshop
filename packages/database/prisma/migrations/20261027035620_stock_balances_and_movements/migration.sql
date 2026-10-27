-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'RECEIPT', 'SALE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderThreshold" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceNumber" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_productId_storeId_key" ON "StockBalance"("productId", "storeId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_storeId_idx" ON "StockMovement"("productId", "storeId");

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stock is never negative and thresholds are whole quantities ≥ 0 (ADR-0001, INV-03).
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_quantity_not_negative" CHECK ("quantity" >= 0);
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_reorderThreshold_not_negative" CHECK ("reorderThreshold" >= 0);

-- Every movement is a real change whose before and after balances agree with it.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_balances_chain" CHECK (
  "quantityChange" <> 0 AND "balanceAfter" = "balanceBefore" + "quantityChange" AND "balanceAfter" >= 0
);

-- The ledger is append-only (INV-02): UPDATE and DELETE fail. TRUNCATE (test resets only) is unaffected.
CREATE FUNCTION "stock_movement_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'stock movements cannot be changed or deleted';
END;
$$;

CREATE TRIGGER "StockMovement_append_only"
BEFORE UPDATE OR DELETE ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION "stock_movement_append_only"();
