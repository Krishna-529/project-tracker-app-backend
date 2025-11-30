import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const maxPoolSize = Number(process.env.DB_POOL_MAX ?? 10);
const client = postgres(connectionString, {
  max: Number.isNaN(maxPoolSize) ? 10 : maxPoolSize,
  idle_timeout: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 10_000),
  connect_timeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5_000),
  keep_alive: Number(process.env.DB_KEEP_ALIVE_INTERVAL_MS ?? 30_000),
});

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development',
});

export type Database = typeof db;
