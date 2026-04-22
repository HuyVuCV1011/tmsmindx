import pool from '@/lib/db'

/**
 * Get list of centers accessible by a user.
 * - super_admin: all centers
 * - admin/manager: only assigned centers
 * - others: no centers
 */
export async function getAccessibleCenters(
  email: string | undefined | null,
): Promise<
  Array<{ id: number; full_name: string; short_code: string | null }>
> {
  if (!email?.trim()) return []

  const normalized = email.trim().toLowerCase()

  try {
    const dbResult = await pool.query(
      `SELECT id, role FROM app_users WHERE email = $1 AND is_active = true`,
      [normalized],
    )

    if (dbResult.rows.length === 0) return []

    const appUser = dbResult.rows[0] as { id: number; role: string }

    // super_admin sees all centers
    if (appUser.role === 'super_admin') {
      const allCenters = await pool.query(`
        SELECT id, full_name, short_code FROM centers WHERE status = 'Active'
        ORDER BY full_name
      `)
      return allCenters.rows
    }

    // admin/manager see assigned centers
    if (['admin', 'manager'].includes(appUser.role)) {
      const assignedCenters = await pool.query(
        `SELECT DISTINCT c.id, c.full_name, c.short_code
         FROM manager_centers mc
         JOIN centers c ON c.id = mc.center_id
         WHERE mc.user_id = $1 AND c.status = 'Active'
         ORDER BY c.full_name`,
        [appUser.id],
      )
      return assignedCenters.rows
    }

    // others see no centers
    return []
  } catch (e) {
    console.error('getAccessibleCenters:', e)
    return []
  }
}

/**
 * Check if user can access a specific center
 */
export async function canAccessCenter(
  email: string | undefined | null,
  centerId: number,
): Promise<boolean> {
  const centers = await getAccessibleCenters(email)
  return centers.some((c) => c.id === centerId)
}

/**
 * Get center IDs accessible by user (for filtering queries)
 */
export async function getAccessibleCenterIds(
  email: string | undefined | null,
): Promise<number[]> {
  const centers = await getAccessibleCenters(email)
  return centers.map((c) => c.id)
}
