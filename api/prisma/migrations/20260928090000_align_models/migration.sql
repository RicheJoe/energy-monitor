-- CreateEnum
CREATE TYPE "DeviceKind" AS ENUM ('cluster', 'pcs');

-- CreateEnum
CREATE TYPE "AlarmLevel" AS ENUM ('critical', 'warning', 'info');

-- AlterTable
ALTER TABLE "Device" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Device" ALTER COLUMN "kind" TYPE "DeviceKind" USING ("kind"::text::"DeviceKind");

-- AlterTable
ALTER TABLE "Alarm" ALTER COLUMN "level" TYPE "AlarmLevel" USING ("level"::text::"AlarmLevel");

-- DropIndex
DROP INDEX "Device_cabinetId_idx";

-- CreateIndex
CREATE INDEX "Device_cabinetId_kind_idx" ON "Device"("cabinetId", "kind");

-- CreateIndex
CREATE INDEX "Alarm_cabinetId_createdAt_idx" ON "Alarm"("cabinetId", "createdAt");

-- CreateIndex
CREATE INDEX "Alarm_deviceId_createdAt_idx" ON "Alarm"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "Alarm_createdAt_idx" ON "Alarm"("createdAt" DESC);

-- DropForeignKey
ALTER TABLE "Telemetry" DROP CONSTRAINT "Telemetry_deviceId_fkey";

-- AddForeignKey
ALTER TABLE "Telemetry" ADD CONSTRAINT "Telemetry_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
