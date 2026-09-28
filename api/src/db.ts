import { PrismaClient } from '@prisma/client';
import { loadEnv } from './loadEnv';

loadEnv();

export const prisma = new PrismaClient({
  log: ['warn', 'error'],
});
