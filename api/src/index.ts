import cors from 'cors';
import express from 'express';
import pinoHttp from 'pino-http';
import { prisma } from './db';
import { startIngestion, stopIngestion } from './ingestion';
import { errorHandler } from './middleware/errorHandler';
import { mqttReady } from './mqtt';
import { rabbitReady } from './queue';
import { redis } from './redis';
import alarmsRouter from './routes/alarms';
import devicesRouter from './routes/devices';
import stationRouter from './routes/station';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value
);

app.use(cors());
app.use(express.json());
app.use(pinoHttp());

app.get('/health', async (_req, res) => {
  let db = false;
  let cache = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  try {
    cache = (await redis.ping()) === 'PONG';
  } catch {
    cache = false;
  }
  const mqtt = mqttReady();
  const rabbitmq = rabbitReady();
  const ok = db && cache && mqtt && rabbitmq;
  res.status(ok ? 200 : 503).json({ ok, db, redis: cache, mqtt, rabbitmq });
});

app.use('/api/devices', devicesRouter);
app.use('/api/alarms', alarmsRouter);
app.use('/api/station', stationRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
  void startIngestion().catch((error) => {
    console.error('Failed to start ingestion', error);
  });
});

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Shutting down...');
  server.close();
  try {
    await stopIngestion();
    await prisma.$disconnect();
    await redis.quit();
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
