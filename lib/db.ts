import { Pool } from 'pg';
import { initDatabase } from './migrations';

const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build';

// Keep the default pool intentionally small because Next.js may spawn multiple
// worker processes; a large per-process pool quickly exhausts Postgres slots.
const poolMax = Math.max(1, parseInt(process.env.DB_POOL_MAX || '2', 10));

// Prevent creating multiple pools during hot reloads in development (Next.js specific fix for serverless/HMR)
if (!global.pool) {
  const poolMax = Math.max(1, parseInt(process.env.DB_POOL_MAX || '2', 10));
  global.pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: poolMax,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 3000,
    allowExitOnIdle: true,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Handle pool errors
  global.pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    // Don't exit process in serverless, let it log and reconnect
  });

  // Avoid running migrations in each Next.js build worker process.
  if (!isBuildPhase) {
    global.migrationInitPromise = initDatabase(global.pool).catch((err) => {
      console.error('⚠️ Auto-migration failed (app vẫn chạy bình thường):', err.message);
    });
  }
}

const pool = global.pool;

export default pool;
