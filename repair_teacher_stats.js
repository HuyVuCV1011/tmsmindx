
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

async function repairTeacherStats() {
  try {
    // 1. Find all teachers in training_teacher_stats with invalid center/block
    const badStatsRes = await pool.query(`
      SELECT teacher_code, full_name, center, teaching_block 
      FROM training_teacher_stats 
      WHERE center = 'Active' OR teaching_block = 'Active'
    `);
    
    console.log(`Found ${badStatsRes.rows.length} records to repair.`);

    for (const stat of badStatsRes.rows) {
      console.log(`Repairing ${stat.teacher_code} (${stat.full_name})...`);
      
      // 2. Get correct info from teachers table
      const teacherRes = await pool.query(`
        SELECT full_name, main_centre, course_line 
        FROM teachers 
        WHERE code = $1
      `, [stat.teacher_code]);

      if (teacherRes.rows.length > 0) {
        const correct = teacherRes.rows[0];
        console.log(`  -> Valid data: Center="${correct.main_centre}", Block="${correct.course_line}"`);

        // 3. Update training_teacher_stats
        await pool.query(`
          UPDATE training_teacher_stats
          SET 
            center = $1,
            teaching_block = $2,
            updated_at = NOW()
          WHERE teacher_code = $3
        `, [correct.main_centre, correct.course_line, stat.teacher_code]);
        
        console.log(`  -> Fixed.`);
      } else {
        console.log(`  -> No record found in 'teachers' table for ${stat.teacher_code}. Skipping.`);
      }
    }

  } catch (err) {
    console.error("Error repairing stats:", err);
  } finally {
    await pool.end();
  }
}

repairTeacherStats();
