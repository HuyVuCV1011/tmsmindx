import { Pool } from 'pg';
import { initDatabase } from './migrations';

// Tạo connection pool cho database
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

// Xử lý lỗi pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Auto-init: chạy migrations khi import lần đầu
// Sử dụng .then() để không block module loading
initDatabase(pool).catch((err) => {
  console.error('⚠️ Auto-migration failed (app vẫn chạy bình thường):', err.message);
});

export default pool;
