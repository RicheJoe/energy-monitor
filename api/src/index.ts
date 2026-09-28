import cors from 'cors';
import express from 'express';
import pinoHttp from 'pino-http';
import { prisma } from './db';
import { errorHandler } from './middleware/errorHandler';
import { redis } from './redis';
import alarmsRouter from './routes/alarms';
import devicesRouter from './routes/devices';

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
  const ok = db && cache;
  res.status(ok ? 200 : 503).json({ ok, db, redis: cache });
});

app.use('/api/devices', devicesRouter);
app.use('/api/alarms', alarmsRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Shutting down...');
  server.close();
  try {
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
