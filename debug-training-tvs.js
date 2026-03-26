const { Pool } = require('pg');

// Parse connection string or use default
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

async function checkColumns() {
  try {
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'training_teacher_video_scores';
    `);
    console.log('Columns in training_teacher_video_scores:', res.rows.map(r => r.column_name));
  } catch (err) {
    console.error('Error checking columns:', err);
  } finally {
    await pool.end();
  }
}

checkColumns();