import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'tms-app-secret-key-2024';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email và password là bắt buộc' },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if email exists in app_users
        const userResult = await pool.query(
            'SELECT * FROM app_users WHERE email = $1 AND is_active = true',
            [normalizedEmail]
        );

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

        // Get direct permissions
        const directPerms = await pool.query(
            'SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true',
            [user.id]
        );

        // Get role-based permissions (via user_roles → role_permissions)
        const rolePerms = await pool.query(`
            SELECT DISTINCT rp.route_path
            FROM user_roles ur
            JOIN role_permissions rp ON rp.role_code = ur.role_code
            WHERE ur.user_id = $1
        `, [user.id]);

        // Merge: union of direct + role-based
        const allPerms = new Set<string>();
        directPerms.rows.forEach((r: { route_path: string }) => allPerms.add(r.route_path));
        rolePerms.rows.forEach((r: { route_path: string }) => allPerms.add(r.route_path));
        const permissions = Array.from(allPerms);

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
            isAdmin: ['super_admin', 'admin', 'manager'].includes(user.role),
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
