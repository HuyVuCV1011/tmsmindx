require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const fs = require('fs');

async function check() {
    console.log('Starting DB check...');
    const pool = new Pool({
        host: (process.env.DB_HOST || '').trim(),
        port: parseInt((process.env.DB_PORT || '5432').trim()),
        database: (process.env.DB_NAME || '').trim(),
        user: (process.env.DB_USER || '').trim(),
        password: (process.env.DB_PASSWORD || '').trim(),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        console.log('Connecting to pool...');
        const client = await pool.connect();
        console.log('Connected successfully!');

        const emails = ['baotc@mindx.com.vn', 'teachingho@mindx.com.vn'];
        const query = `
      SELECT u.email, u.role, u.is_active, u.auth_type,
             (SELECT json_agg(role_code) FROM user_roles WHERE user_id = u.id) as assigned_roles,
             (SELECT json_agg(rp.route_path) FROM role_permissions rp 
              JOIN user_roles ur ON rp.role_code = ur.role_code 
              WHERE ur.user_id = u.id) as role_permissions
      FROM app_users u
      WHERE u.email IN ($1, $2)
    `;

        const res = await client.query(query, emails);
        fs.writeFileSync('user_perms_check.json', JSON.stringify(res.rows, null, 2));
        console.log('Verification data written to user_perms_check.json');
        client.release();
    } catch (err) {
        console.error('Error during verification:', err.message);
        fs.writeFileSync('user_perms_check.json', JSON.stringify({ error: err.message }, null, 2));
    } finally {
        await pool.end();
        console.log('Finished.');
    }
}

check();
