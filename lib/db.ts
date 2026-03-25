import { Pool } from 'pg';
import { initDatabase } from './migrations';

// Prevent creating multiple pools during hot reloads in development (Next.js specific fix for serverless/HMR)
if (!global.pool) {
  global.pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20, // Limit maximum connections to avoid exhausting Postgres connection slots
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased to 10s to avoid timeout on slow networks
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Handle pool errors
  global.pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    // Don't exit process in serverless, let it log and reconnect
  });

  // Auto-init only once
  initDatabase(global.pool).catch((err) => {
    console.error('⚠️ Auto-migration failed (app vẫn chạy bình thường):', err.message);
  });
}

const pool = global.pool;

export default pool;
