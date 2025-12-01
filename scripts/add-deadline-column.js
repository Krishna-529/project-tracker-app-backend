/*
 * Adds the deadline column to the nodes table if it is missing.
 * Usage:
 *   DATABASE_URL=postgres://user:pass@host:port/db node scripts/add-deadline-column.js
 */
const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const sql = postgres(connectionString, {
  max: Number(process.env.DB_POOL_MAX ?? 1),
  idle_timeout: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 10_000),
  connect_timeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5_000),
});

async function main() {
  console.log('Checking for deadline column on nodes table...');

  const result = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'nodes'
        AND column_name = 'deadline'
    ) AS "exists";
  `;

  const exists = result[0]?.exists === true;

  if (exists) {
    console.log('Deadline column already exists. No changes made.');
    return;
  }

  console.log('Adding deadline column (timestamptz, nullable)...');
  await sql`ALTER TABLE public.nodes ADD COLUMN deadline timestamptz;`;
  console.log('Deadline column added successfully.');
}

main()
  .catch((error) => {
    console.error('Failed to add deadline column:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
