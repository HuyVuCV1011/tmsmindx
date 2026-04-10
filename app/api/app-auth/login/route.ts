import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'tps-app-secret-key-2024';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email và password là bắt buộc' },
                { status: 400 }
            );
        }

        const normalizedInput = email.trim().toLowerCase();
        
        let userResult;

        if (normalizedInput.includes('@')) {
            // Standard email login or username with explicit marker
            userResult = await pool.query(
                `SELECT * FROM app_users 
                 WHERE (email = $1 OR LOWER(username) = $1) 
                 AND is_active = true
                 LIMIT 1`,
                [normalizedInput]
            );
        } else {
            // Username or Email prefix case (e.g. "baotc01")
            // Priority: 
            // 1. Exact username match
            // 2. Email match with @mindx.edu.vn (standard)
            // 3. Email match with @mindx.net.vn (legacy)
            // 4. Email match with @mindx.com.vn (internal)
            
            const suffixes = [
                '@mindx.edu.vn',
                '@mindx.net.vn', 
                '@mindx.com.vn'
            ];
            const possibleEmails = suffixes.map(s => `${normalizedInput}${s}`);
            
            // Check username first, then emails
            userResult = await pool.query(
                `SELECT * FROM app_users 
                 WHERE (LOWER(username) = $1 OR email = ANY($2::text[])) 
                 AND is_active = true
                 ORDER BY 
                   CASE 
                     WHEN LOWER(username) = $1 THEN 1 
                     WHEN email LIKE $3 THEN 2  -- Prefer .edu.vn
                     ELSE 3 
                   END
                 LIMIT 1`,
                [normalizedInput, possibleEmails, `%@mindx.edu.vn`]
            );
        }

        if (userResult.rows.length === 0) {
            // Not an app user — signal client to fallback to Firebase
            return NextResponse.json({ appUser: false });
        }

        const user = userResult.rows[0];

        // If the user is marked as a firebase user in the database, 
        // fallback to Firebase auth instead of trying to authenticate locally.
        if (user.auth_type === 'firebase') {
            return NextResponse.json({ appUser: false });
        }

        // Verify password
        if (!user.password_hash) {
            return NextResponse.json(
                { error: 'Tài khoản không có mật khẩu hợp lệ.' },
                { status: 401 }
            );
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Email hoặc mật khẩu không chính xác' },
                { status: 401 }
            );
        }

        // Fetch direct and role-based permissions in one round-trip to reduce
        // pressure on the shared pool during login.
        const permissionsResult = await pool.query(
            `SELECT DISTINCT route_path
             FROM (
               SELECT route_path
               FROM app_permissions
               WHERE user_id = $1 AND can_access = true

               UNION

               SELECT rp.route_path
               FROM user_roles ur
               JOIN role_permissions rp ON rp.role_code = ur.role_code
               WHERE ur.user_id = $1
             ) permissions`,
            [user.id]
        );

        const permissions = permissionsResult.rows.map((row: { route_path: string }) => row.route_path);

        const hasAdminPerms = permissions.some(p => p.startsWith('/admin'));
        const isAdmin = ['super_admin', 'admin', 'manager'].includes(user.role) || hasAdminPerms;

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return NextResponse.json({
            appUser: true,
            idToken: token,
            email: user.email,
            localId: `app_${user.id}`,
            displayName: user.display_name,
            role: user.role,
            isAdmin,
            permissions,
        });
    } catch (error: any) {
        console.error('App auth login error:', error);
        return NextResponse.json(
            { error: 'Đã xảy ra lỗi server. Vui lòng thử lại sau.' },
            { status: 500 }
        );
    }
}
