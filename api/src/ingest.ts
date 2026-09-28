import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { redis } from './redis';
import { TelemetryMessage } from './telemetryMessage';

export class UnknownDeviceError extends Error {
  constructor(deviceId: string) {
    super(`Unknown device ${deviceId}`);
    this.name = 'UnknownDeviceError';
  }
}

function alarmLevel(text: string): 'critical' | 'warning' {
  if (text.includes('过温') || text.includes('绝缘') || text.includes('通讯')) return 'critical';
  return 'warning';
}

export async function persistTelemetry(message: TelemetryMessage): Promise<void> {
  const updated = await prisma.$transaction(async (tx) => {
    const previous = await tx.device.findUnique({ where: { id: message.deviceId } });
    if (!previous) throw new UnknownDeviceError(message.deviceId);

    const device = await tx.device.update({
      where: { id: message.deviceId },
      data: {
        soc: message.soc,
        soh: message.soh,
        voltage: message.voltage,
        current: message.current,
        temp: message.temp,
        power: message.power,
        ...(message.online !== undefined ? { online: message.online } : {}),
        ...(message.alarm !== undefined ? { alarm: message.alarm } : {}),
        ...(message.alarmText !== undefined ? { alarmText: message.alarmText } : {}),
      },
    });

    await tx.telemetry.create({
      data: {
        deviceId: message.deviceId,
        soc: message.soc,
        soh: message.soh,
        voltage: message.voltage,
        current: message.current,
        temp: message.temp,
        power: message.power,
      },
    });

    const wentOffline = message.online === false && previous.online;
    const alarmRaised = message.alarm === true && !previous.alarm;
    if (wentOffline || alarmRaised) {
      const text = message.alarmText || (wentOffline ? '通讯中断' : '告警');
      await tx.alarm.create({
        data: {
          deviceId: device.id,
          level: wentOffline ? 'critical' : alarmLevel(text),
          cabinetId: device.cabinetId,
          cabinetName: device.cabinetName,
          deviceName: device.name,
          message: text,
        },
      });
    }

    return device;
  });

  try {
    await redis.hset(`device:${updated.id}:latest`, {
      soc: String(updated.soc),
      soh: String(updated.soh),
      voltage: String(updated.voltage),
      current: String(updated.current),
      temp: String(updated.temp),
      power: String(updated.power),
      online: String(updated.online),
      alarm: String(updated.alarm),
      alarmText: updated.alarmText,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to cache latest telemetry', error);
  }
}

export function isUnknownDevice(error: unknown): boolean {
  return (
    error instanceof UnknownDeviceError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
  );
}
