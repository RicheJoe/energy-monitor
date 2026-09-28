import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const emptyToUndefined = (value: unknown) => (value === undefined || value === '' ? undefined : value);

const listQuerySchema = z.object({
  cabinetId: z.string().min(1).max(32).optional(),
  deviceId: z.string().min(1).max(64).optional(),
  acknowledged: z.enum(['true', 'false']).optional(),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().max(500).default(100)),
});

const createAlarmSchema = z.strictObject({
  id: z.string().min(1).max(64).optional(),
  deviceId: z.string().min(1).max(64).nullable().optional(),
  level: z.enum(['critical', 'warning', 'info']),
  cabinetId: z.string().min(1).max(32),
  cabinetName: z.string().min(1).max(64),
  deviceName: z.string().min(1).max(64),
  message: z.string().min(1).max(500),
});

function routeParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) throw new AppError(400, 'Missing id');
  return raw;
}

router.get('/', async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const alarms = await prisma.alarm.findMany({
    where: {
      ...(query.cabinetId ? { cabinetId: query.cabinetId } : {}),
      ...(query.deviceId ? { deviceId: query.deviceId } : {}),
      ...(query.acknowledged !== undefined ? { acknowledged: query.acknowledged === 'true' } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });
  res.json(alarms);
});

router.post('/', async (req, res) => {
  const body = createAlarmSchema.parse(req.body);
  const alarm = await prisma.alarm.create({
    data: {
      ...(body.id ? { id: body.id } : {}),
      deviceId: body.deviceId ?? null,
      level: body.level,
      cabinetId: body.cabinetId,
      cabinetName: body.cabinetName,
      deviceName: body.deviceName,
      message: body.message,
    },
  });
  res.status(201).json(alarm);
});

router.patch('/:id/ack', async (req, res) => {
  const alarm = await prisma.alarm.update({
    where: { id: routeParam(req.params.id) },
    data: { acknowledged: true },
  });
  res.json(alarm);
});

export default router;
