import { Prisma } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import { redis } from '../redis';

const router = Router();

const kindSchema = z.enum(['cluster', 'pcs']);

const metricFields = {
  soc: z.number().min(0).max(100).optional(),
  soh: z.number().min(0).max(100).optional(),
  voltage: z.number().min(0).optional(),
  current: z.number().optional(),
  temp: z.number().optional(),
  power: z.number().optional(),
  online: z.boolean().optional(),
  alarm: z.boolean().optional(),
  alarmText: z.string().min(1).max(200).optional(),
};

const createDeviceSchema = z.strictObject({
  id: z.string().min(1).max(64),
  cabinetId: z.string().min(1).max(32),
  cabinetName: z.string().min(1).max(64),
  kind: kindSchema,
  name: z.string().min(1).max(50),
  ...metricFields,
});

const updateDeviceSchema = z
  .strictObject({
    cabinetId: z.string().min(1).max(32).optional(),
    cabinetName: z.string().min(1).max(64).optional(),
    kind: kindSchema.optional(),
    name: z.string().min(1).max(50).optional(),
    ...metricFields,
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' });

const telemetrySchema = z.strictObject({
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

const listQuerySchema = z.object({
  cabinetId: z.string().min(1).max(32).optional(),
  kind: kindSchema.optional(),
  online: z.enum(['true', 'false']).optional(),
});

const emptyToUndefined = (value: unknown) => (value === undefined || value === '' ? undefined : value);

const historyQuerySchema = z.object({
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().max(1000).default(100)),
  from: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  to: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});

function routeParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) throw new AppError(400, 'Missing id');
  return raw;
}

router.get('/', async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const devices = await prisma.device.findMany({
    where: {
      ...(query.cabinetId ? { cabinetId: query.cabinetId } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.online !== undefined ? { online: query.online === 'true' } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });
  res.json(devices);
});

router.post('/', async (req, res) => {
  const data = createDeviceSchema.parse(req.body);
  const device = await prisma.device.create({ data });
  res.status(201).json(device);
});

router.get('/:id/latest', async (req, res) => {
  const id = routeParam(req.params.id);
  const latest = await redis.hgetall(`device:${id}:latest`);
  if (latest && Object.keys(latest).length > 0) {
    res.json({ deviceId: id, source: 'redis', ...latest });
    return;
  }

  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) throw new AppError(404, 'Device not found');
  res.json({
    deviceId: id,
    source: 'db',
    soc: device.soc,
    soh: device.soh,
    voltage: device.voltage,
    current: device.current,
    temp: device.temp,
    power: device.power,
    online: device.online,
    alarm: device.alarm,
    alarmText: device.alarmText,
    updatedAt: device.updatedAt,
  });
});

async function listTelemetry(req: Request, res: Response) {
  const id = routeParam(req.params.id);
  const query = historyQuerySchema.parse(req.query);
  const device = await prisma.device.findUnique({ where: { id }, select: { id: true } });
  if (!device) throw new AppError(404, 'Device not found');

  const createdAt: Prisma.DateTimeFilter = {};
  if (query.from) createdAt.gte = query.from;
  if (query.to) createdAt.lte = query.to;

  const points = await prisma.telemetry.findMany({
    where: {
      deviceId: id,
      ...(query.from || query.to ? { createdAt } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
  });
  res.json(points);
}

router.get('/:id/telemetry', async (req, res) => {
  await listTelemetry(req, res);
});
router.get('/:id/readings', async (req, res) => {
  await listTelemetry(req, res);
});

router.post('/:id/telemetry', async (req, res) => {
  const id = routeParam(req.params.id);
  const body = telemetrySchema.parse(req.body);
  const { online, alarm, alarmText, ...metrics } = body;

  const result = await prisma.$transaction(async (tx) => {
    const device = await tx.device.update({
      where: { id },
      data: {
        ...metrics,
        ...(online !== undefined ? { online } : {}),
        ...(alarm !== undefined ? { alarm } : {}),
        ...(alarmText !== undefined ? { alarmText } : {}),
      },
    });
    const point = await tx.telemetry.create({
      data: { deviceId: id, ...metrics },
    });
    return { device, point };
  });

  res.status(201).json(result);
});

router.get('/:id', async (req, res) => {
  const device = await prisma.device.findUnique({
    where: { id: routeParam(req.params.id) },
  });
  if (!device) throw new AppError(404, 'Device not found');
  res.json(device);
});

router.patch('/:id', async (req, res) => {
  const data = updateDeviceSchema.parse(req.body);
  const device = await prisma.device.update({
    where: { id: routeParam(req.params.id) },
    data,
  });
  res.json(device);
});

export default router;
