const http = require('http');

const data = JSON.stringify({
  action: 'query',
  secret: 'mindx-teaching-internal-2025',
  sql: `
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN SELECT role_code FROM role_permissions WHERE route_path = '/admin/page4'
          LOOP
              INSERT INTO role_permissions (role_code, route_path) VALUES (r.role_code, '/admin/page4/lich-danh-gia') ON CONFLICT DO NOTHING;
              INSERT INTO role_permissions (role_code, route_path) VALUES (r.role_code, '/admin/page4/danh-sach-dang-ky') ON CONFLICT DO NOTHING;
              INSERT INTO role_permissions (role_code, route_path) VALUES (r.role_code, '/admin/page4/thu-vien-de') ON CONFLICT DO NOTHING;
          END LOOP;
          DELETE FROM role_permissions WHERE route_path = '/admin/page4';
      END $$;
  `
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/database',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('RESPONSE:', body));
});

req.on('error', e => console.error('ERROR:', e.message));
req.write(data);
req.end();
