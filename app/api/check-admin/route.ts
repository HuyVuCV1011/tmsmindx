import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required', isAdmin: false }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check local database — app_users table
    try {
      const dbResult = await pool.query(
        `SELECT id, role, is_active, auth_type FROM app_users WHERE email = $1`,
        [normalizedEmail]
      );

      if (dbResult.rows.length > 0) {
        const appUser = dbResult.rows[0];

        // Get direct permissions
        const directPerms = await pool.query(
          'SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true',
          [appUser.id]
        );

        // Get role-based permissions (via user_roles → role_permissions)
        const rolePerms = await pool.query(`
          SELECT DISTINCT rp.route_path
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_code = ur.role_code
          WHERE ur.user_id = $1
        `, [appUser.id]);

        // Get user's assigned roles
        const userRoles = await pool.query(
          'SELECT role_code FROM user_roles WHERE user_id = $1',
          [appUser.id]
        );

        // Merge: union of direct + role-based permissions
        const allPerms = new Set<string>();
        directPerms.rows.forEach((r: { route_path: string }) => allPerms.add(r.route_path));
        rolePerms.rows.forEach((r: { route_path: string }) => allPerms.add(r.route_path));

        const permissions = Array.from(allPerms);
        const hasAdminPerms = permissions.some(p => p.startsWith('/admin'));
        const isAdmin = appUser.is_active && (['super_admin', 'admin', 'manager'].includes(appUser.role) || hasAdminPerms);

        return NextResponse.json({
          success: true,
          email: normalizedEmail,
          isAdmin,
          isAppUser: appUser.auth_type === 'app',
          role: appUser.role,
          permissions: Array.from(allPerms),
          userRoles: userRoles.rows.map((r: { role_code: string }) => r.role_code),
          message: 'Checked from app database',
        });
      }
    } catch (dbError) {
      console.error('⚠️ DB check failed:', dbError);
    }

    // Not found
    return NextResponse.json({
      success: true,
      email: normalizedEmail,
      isAdmin: false,
      isAppUser: false,
      permissions: [],
      userRoles: [],
      message: 'Email not found',
    });
  } catch (error) {
    console.error('❌ Admin check error:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status', isAdmin: false, isAppUser: false },
      { status: 500 }
    );
  }
}
