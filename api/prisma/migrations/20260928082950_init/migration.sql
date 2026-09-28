-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "cabinetName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "soc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "voltage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "current" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "temp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "power" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alarm" BOOLEAN NOT NULL DEFAULT false,
    "alarmText" TEXT NOT NULL DEFAULT '正常',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Telemetry" (
    "id" BIGSERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "soc" DOUBLE PRECISION NOT NULL,
    "soh" DOUBLE PRECISION NOT NULL,
    "voltage" DOUBLE PRECISION NOT NULL,
    "current" DOUBLE PRECISION NOT NULL,
    "temp" DOUBLE PRECISION NOT NULL,
    "power" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alarm" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "level" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "cabinetName" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alarm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Device_cabinetId_idx" ON "Device"("cabinetId");

-- CreateIndex
CREATE INDEX "Telemetry_deviceId_createdAt_idx" ON "Telemetry"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "Alarm_acknowledged_createdAt_idx" ON "Alarm"("acknowledged", "createdAt");

-- AddForeignKey
ALTER TABLE "Telemetry" ADD CONSTRAINT "Telemetry_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
