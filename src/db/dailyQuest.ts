import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './dailyQuestSchema';

console.log('[DailyQuest DB] Initializing connection to:', env.dailyQuestDatabaseUrl.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({
  connectionString: env.dailyQuestDatabaseUrl,
});

// Test connection
pool.on('connect', () => {
  console.log('[DailyQuest DB] Successfully connected to Daily Quest database');
});

pool.on('error', (err) => {
  console.error('[DailyQuest DB] Connection error:', err);
});

// Test the connection immediately
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('[DailyQuest DB] Test query failed:', err.message);
  } else {
    console.log('[DailyQuest DB] Test query successful. Database time:', res.rows[0]?.now);
  }
});

export const dailyQuestDb = drizzle(pool, { schema });
