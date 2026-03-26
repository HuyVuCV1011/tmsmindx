const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST?.trim(),
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD?.trim(), // Trim to remove potential spaces
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

async function checkAllColumns() {
  try {
    const tables = ['training_videos', 'training_video_assignments', 'training_teacher_video_scores'];
    for (const table of tables) {
      console.log(`Checking table: ${table}`);
      const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1;
      `, [table]);
      console.log(`Columns in ${table}:`, res.rows.map(r => r.column_name));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkAllColumns();