/**
 * Script chạy tất cả database migrations
 * Sử dụng: npm run db:migrate
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function main() {
    console.log('🔌 Connecting to database...');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Database: ${process.env.DB_NAME}`);

    try {
        // Test connection
        const res = await pool.query('SELECT NOW()');
        console.log(`✅ Connected! Server time: ${res.rows[0].now}\n`);
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    }

    // Import migrations dynamically (need to handle TS → JS)
    // Since this is a JS script, we read the migrations from a simplified approach
    console.log('🔄 Running migrations...\n');

    // Step 1: Create _migrations table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      version INTEGER NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

    // Step 2: Get applied migrations
    const applied = await pool.query('SELECT name FROM _migrations');
    const appliedSet = new Set(applied.rows.map(r => r.name));

    // Step 3: Read SQL files from scripts directory and also run inline migrations
    const fs = require('fs');
    const path = require('path');

    const sqlFiles = [
        {
            name: 'create_communications', file: null, sql: `
      CREATE TABLE IF NOT EXISTS communications (
        id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
        description TEXT, content TEXT, featured_image TEXT, banner_image TEXT,
        post_type TEXT, audience TEXT, status TEXT DEFAULT 'draft',
        published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER DEFAULT 0, like_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `},
        {
            name: 'create_communication_likes', file: null, sql: `
      CREATE TABLE IF NOT EXISTS communication_likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES communications(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      );
    `},
        { name: 'create_explanations', file: 'create_explanations_table.sql' },
        { name: 'create_teacher_certificates', file: 'create_teacher_certificates_table.sql' },
        { name: 'create_teacher_privacy_settings', file: 'create_teacher_privacy_settings_table.sql' },
        { name: 'create_truyenthong_comments', file: 'create_truyenthong_comments_tables.sql' },
        { name: 'create_training_tables', file: 'create_training_tables_postgres.sql' },
    ];

    let appliedCount = 0;
    let errorCount = 0;

    for (const entry of sqlFiles) {
        if (appliedSet.has(entry.name)) {
            console.log(`  ⏭️  Skip: ${entry.name} (already applied)`);
            continue;
        }

        let sql = entry.sql;
        if (entry.file) {
            const filePath = path.join(__dirname, entry.file);
            if (!fs.existsSync(filePath)) {
                console.log(`  ⚠️  File not found: ${entry.file}`);
                continue;
            }
            sql = fs.readFileSync(filePath, 'utf8');
        }

        try {
            await pool.query('BEGIN');
            await pool.query(sql);
            await pool.query(
                'INSERT INTO _migrations (name, version) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
                [entry.name, appliedCount + 1]
            );
            await pool.query('COMMIT');
            console.log(`  ✅ Applied: ${entry.name}`);
            appliedCount++;
        } catch (err) {
            await pool.query('ROLLBACK');
            console.error(`  ❌ Failed: ${entry.name} - ${err.message}`);
            errorCount++;
        }
    }

    console.log(`\n📊 Summary: ${appliedCount} applied, ${errorCount} errors, ${appliedSet.size} already up-to-date`);

    // Show all tables
    const tables = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
    console.log(`\n📋 All tables (${tables.rows.length}):`);
    tables.rows.forEach(t => console.log(`   - ${t.tablename}`));

    await pool.end();
    console.log('\n✨ Done!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
