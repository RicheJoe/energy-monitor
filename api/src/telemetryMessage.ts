import { z } from 'zod';

export const telemetryMessageSchema = z.object({
  deviceId: z.string().min(1).max(64),
  soc: z.number().min(0).max(100),
  soh: z.number().min(0).max(100),
  voltage: z.number().min(0),
  current: z.number(),
  temp: z.number(),
  power: z.number(),
  online: z.boolean().optional(),
  alarm: z.boolean().optional(),
  alarmText: z.string().min(1).max(200).optional(),
});

export type TelemetryMessage = z.infer<typeof telemetryMessageSchema>;

export const TELEMETRY_TOPIC = 'energy/v1/devices/+/telemetry';

export function deviceTopic(deviceId: string): string {
  return `energy/v1/devices/${deviceId}/telemetry`;
}

export function deviceIdFromTopic(topic: string): string | undefined {
  const parts = topic.split('/');
  if (parts.length !== 5 || parts[0] !== 'energy' || parts[1] !== 'v1' || parts[2] !== 'devices') {
    return undefined;
  }
  if (parts[4] !== 'telemetry') return undefined;
  return parts[3];
}
