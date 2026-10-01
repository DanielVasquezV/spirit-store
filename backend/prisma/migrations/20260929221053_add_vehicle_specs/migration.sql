/*
  Warnings:

  - Added the required column `category` to the `vehicles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `drivetrain` to the `vehicles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `engine` to the `vehicles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fuel` to the `vehicles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `power` to the `vehicles` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Fuel" AS ENUM ('GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('SUV', 'SEDAN', 'SPORT', 'ELECTRIC', 'PICKUP', 'COMPACT');

-- AlterTable
ALTER TABLE "vehicle_images" ADD COLUMN     "publicId" TEXT;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "category" "Category" NOT NULL,
ADD COLUMN     "drivetrain" TEXT NOT NULL,
ADD COLUMN     "engine" TEXT NOT NULL,
ADD COLUMN     "fuel" "Fuel" NOT NULL,
ADD COLUMN     "power" TEXT NOT NULL;
