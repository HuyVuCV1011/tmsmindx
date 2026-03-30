
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function checkTeacher() {
  try {
    const res = await pool.query(`
      SELECT teacher_code, full_name, center, teaching_block, status 
      FROM training_teacher_stats 
      WHERE teacher_code = 'baotc01'
    `);
    console.log('training_teacher_stats:', res.rows[0]);

    const res2 = await pool.query(`SELECT code, full_name, main_centre, course_line, status FROM teachers WHERE code = 'baotc01'`);
    console.log('teachers:', res2.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkTeacher();
