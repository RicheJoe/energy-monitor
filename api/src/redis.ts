import Redis from 'ioredis';
import { loadEnv } from './loadEnv';

loadEnv();

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
