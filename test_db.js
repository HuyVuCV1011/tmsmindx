const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT id, title, video_link, video_group_id, chunk_index FROM training_videos WHERE video_group_id IS NOT NULL LIMIT 5").then(res => {
  console.log(res.rows);
  process.exit(0);
});
