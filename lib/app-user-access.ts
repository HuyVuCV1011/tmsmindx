import pool from '@/lib/db'

export type AppUserAccess = {
  found: boolean
  /** Email chuẩn hóa (lower case). */
  email: string
  role: string
  isAdmin: boolean
  permissions: string[]
  userRoles: string[]
  isAppUser: boolean
  isActive: boolean
  /** Centers assigned to this manager/admin */
  assignedCenters: Array<{
    id: number
    full_name: string
    short_code: string | null
  }>
}

/**
 * Quyền thực tế từ DB — dùng cho đăng nhập và check-admin (không tin client).
 */
export async function resolveAppUserAccessForEmail(
  rawEmail: string,
): Promise<AppUserAccess> {
  const normalized = rawEmail.trim().toLowerCase()

  try {
    const dbResult = await pool.query(
      `SELECT id, role, is_active, auth_type FROM app_users WHERE email = $1`,
      [normalized],
    )

    if (dbResult.rows.length === 0) {
      return {
        found: false,
        email: normalized,
        role: 'teacher',
        isAdmin: false,
        permissions: [],
        userRoles: [],
        isAppUser: false,
        isActive: true,
        assignedCenters: [],
      }
    }

    const appUser = dbResult.rows[0] as {
      id: number
      role: string
      is_active: boolean
      auth_type: string
    }

    const directPerms = await pool.query(
      'SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true',
      [appUser.id],
    )

    const rolePerms = await pool.query(
      `
      SELECT DISTINCT rp.route_path
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_code = ur.role_code
      WHERE ur.user_id = $1
    `,
      [appUser.id],
    )

    const userRoles = await pool.query(
      'SELECT role_code FROM user_roles WHERE user_id = $1',
      [appUser.id],
    )

    const allPerms = new Set<string>()
    directPerms.rows.forEach((r: { route_path: string }) =>
      allPerms.add(r.route_path),
    )
    rolePerms.rows.forEach((r: { route_path: string }) =>
      allPerms.add(r.route_path),
    )

    const permissions = Array.from(allPerms)
    const roleCodes = userRoles.rows.map((r: { role_code: string }) =>
      (r.role_code || '').toUpperCase(),
    )
    const hasTrainingInputRole = roleCodes.some(
      (code) => code === 'HR' || code === 'TE' || code === 'TF',
    )
    const hasAdminPerms = permissions.some((p) => p.startsWith('/admin'))
    const isAdmin =
      appUser.is_active &&
      (['super_admin', 'admin', 'manager'].includes(appUser.role) ||
        hasAdminPerms ||
        hasTrainingInputRole)

    // Fetch assigned centers for managers/admins
    let assignedCenters: Array<{
      id: number
      full_name: string
      short_code: string | null
    }> = []
    if (['admin', 'manager'].includes(appUser.role)) {
      const centersRes = await pool.query(
        `SELECT DISTINCT c.id, c.full_name, c.short_code
         FROM manager_centers mc
         JOIN centers c ON c.id = mc.center_id
         WHERE mc.user_id = $1
         ORDER BY c.full_name`,
        [appUser.id],
      )
      assignedCenters = centersRes.rows
    }

    return {
      found: true,
      email: normalized,
      role: appUser.role,
      isAdmin,
      permissions,
      userRoles: userRoles.rows.map((r: { role_code: string }) => r.role_code),
      isAppUser: appUser.auth_type === 'app',
      isActive: Boolean(appUser.is_active),
      assignedCenters,
    }
  } catch (e) {
    console.error('resolveAppUserAccessForEmail:', e)
    return {
      found: false,
      email: normalized,
      role: 'teacher',
      isAdmin: false,
      permissions: [],
      userRoles: [],
      isAppUser: false,
      isActive: true,
      assignedCenters: [],
    }
  }
}
