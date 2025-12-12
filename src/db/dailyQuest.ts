// src/db/dailyQuest.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './dailyQuestSchema';

console.log(
  '[DailyQuest DB] Initializing connection to:',
  env.dailyQuestDatabaseUrl ? env.dailyQuestDatabaseUrl.replace(/:[^:@]+@/, ':****@') : '<<no url>>'
);

// Export schema so callers can import dailyQuestUsers etc.
export * from './dailyQuestSchema';

// Export a mutable binding that we'll assign below.
// Use `any` to avoid heavy typing here — you can replace with proper types later.
export let dailyQuestDb: any;

// If the env explicitly asks to skip DailyQuest, set a fast mock
if (process.env.SKIP_DAILY_QUEST === 'true' || !env.dailyQuestDatabaseUrl) {
  if (process.env.SKIP_DAILY_QUEST === 'true') {
    console.log('[DailyQuest DB] SKIP_DAILY_QUEST=true -> using mock DB (no external calls).');
  } else {
    console.warn('[DailyQuest DB] DAILY_QUEST_DATABASE_URL not set -> using mock DB.');
  }

  // Minimal mock that supports the pattern used in code:
  // dailyQuestDb.select().from(dailyQuestUsers).where(...)
  dailyQuestDb = {
    select: () => ({
      from: (_table: any) => ({
        where: async () => [], // always return empty result quickly
      }),
    }),
    // A pg-like query method in case other code calls it
    query: async (_sql: string, _params?: any[]) => ({ rows: [] }),
  } as any;
} else {
  // Create a pg Pool with reasonable timeouts and SSL for Supabase
  const pool = new Pool({
    connectionString: env.dailyQuestDatabaseUrl,
    // Supabase requires SSL; accept the managed cert
    ssl: { rejectUnauthorized: false },
    // fail faster on connect attempts
    connectionTimeoutMillis: 5000,
    // cleanup idle clients
    idleTimeoutMillis: 30000,
    // limit pool size to avoid resource churn
    max: 2,
    // keepalive to improve stability
    keepAlive: true as any,
  });

  pool.on('connect', () => {
    console.log('[DailyQuest DB] pg Pool "connect" event fired');
  });

  pool.on('error', (err) => {
    console.error('[DailyQuest DB] Pool error (non-fatal):', err && err.message ? err.message : err);
  });

  // Run a background test but don't block module initialization
  (async () => {
    try {
      const res = await Promise.race([
        pool.query('SELECT NOW()'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DailyQuest test query timed out (5s)')), 5000)
        ),
      ]);
      // @ts-ignore
      console.log('[DailyQuest DB] Test query successful. Database time:', res.rows?.[0]?.now ?? 'unknown');
    } catch (err: any) {
      console.error('[DailyQuest DB] Test query failed (non-fatal):', err && err.message ? err.message : err);
    }
  })().catch((e) => {
    console.error('[DailyQuest DB] unexpected error in testConnection:', e && e.message ? e.message : e);
  });

  // Final export assignment
  dailyQuestDb = drizzle(pool, { schema });
}
