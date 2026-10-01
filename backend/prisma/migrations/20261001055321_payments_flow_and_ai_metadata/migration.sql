-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "OrderOrigin" AS ENUM ('DIRECT_SALE', 'AUCTION');

-- DropIndex
DROP INDEX "orders_vehicleId_key";

-- AlterTable
ALTER TABLE "ai_diagnostic_messages" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "expiresAt" TIMESTAMPTZ(3),
ADD COLUMN     "origin" "OrderOrigin" NOT NULL DEFAULT 'DIRECT_SALE',
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentReference" TEXT;

-- CreateIndex
CREATE INDEX "orders_vehicleId_idx" ON "orders"("vehicleId");

-- CreateIndex
CREATE INDEX "orders_status_expiresAt_idx" ON "orders"("status", "expiresAt");

-- Las ordenes previas no tenian limite: se les asigna el de 30 minutos desde su creacion.
UPDATE "orders" SET "expiresAt" = "createdAt" + INTERVAL '30 minutes' WHERE "expiresAt" IS NULL AND "status" = 'PENDING_PAYMENT';

-- Una sola orden activa (pendiente o pagada) por vehiculo. Las canceladas, fallidas o reembolsadas
-- quedan como historial y no impiden volver a vender el vehiculo. Prisma no modela indices parciales.
CREATE UNIQUE INDEX "orders_active_vehicle_key" ON "orders"("vehicleId") WHERE "status" IN ('PENDING_PAYMENT', 'PAID');
