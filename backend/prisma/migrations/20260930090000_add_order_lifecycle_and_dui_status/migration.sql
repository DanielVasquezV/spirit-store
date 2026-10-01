-- CreateEnum
CREATE TYPE "DuiStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "duiStatus" "DuiStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "users" ADD COLUMN "duiVerifiedAt" TIMESTAMPTZ(3);

-- Fase extra: ciclo de vida de ordenes + estado de DUI.
--
-- Las columnas nuevas de ORDERS son NOT NULL en el schema, asi que se agregan
-- nullable, se rellenan y recien ahi se vuelve a NOT NULL. Agregarlas directo
-- con NOT NULL revienta la migracion en cuanto la tabla tenga una sola fila.
ALTER TABLE "orders" ADD COLUMN "sellerId" UUID;
ALTER TABLE "orders" ADD COLUMN "orderNumber" TEXT;
ALTER TABLE "orders" ADD COLUMN "subtotal" DECIMAL(12,2);
ALTER TABLE "orders" ADD COLUMN "taxRate" DECIMAL(5,4);
ALTER TABLE "orders" ADD COLUMN "taxAmount" DECIMAL(12,2);
ALTER TABLE "orders" ADD COLUMN "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT';
ALTER TABLE "orders" ADD COLUMN "gatewaySessionId" TEXT;

-- El vendedor es el dueno del vehiculo: es la unica fuente de verdad disponible
-- para las ordenes que ya existian. El numero se deriva del id para que sea
-- unico sin depender de una secuencia.
UPDATE "orders" o
SET "sellerId" = v."sellerId",
    "subtotal" = v."basePrice",
    "taxRate" = 0,
    "taxAmount" = 0,
    "orderNumber" = 'ORD-LEGACY-' || LEFT(REPLACE(o."id"::text, '-', ''), 12)
FROM "vehicles" v
WHERE v."id" = o."vehicleId";

ALTER TABLE "orders" ALTER COLUMN "sellerId" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "orderNumber" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "subtotal" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "taxRate" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "taxAmount" SET NOT NULL;

CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE UNIQUE INDEX "orders_gatewaySessionId_key" ON "orders"("gatewaySessionId");
CREATE INDEX "orders_sellerId_idx" ON "orders"("sellerId");
CREATE INDEX "orders_status_idx" ON "orders"("status");

ALTER TABLE "orders" ADD CONSTRAINT "orders_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chats" ADD COLUMN "orderId" UUID;
CREATE UNIQUE INDEX "chats_orderId_key" ON "chats"("orderId");
ALTER TABLE "chats" ADD CONSTRAINT "chats_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;