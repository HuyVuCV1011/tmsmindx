import { requireBearerSuperAdmin } from '@/lib/auth-server'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/app-auth/manager-centers?userId=123
 * Get centers assigned to a specific manager
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireBearerSuperAdmin(request)
    if (!gate.ok) return gate.response

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const result = await pool.query(
      `SELECT c.id, c.full_name, c.short_code, mc.assigned_at AS "assignedAt"
       FROM manager_centers mc
       JOIN centers c ON c.id = mc.center_id
       WHERE mc.user_id = $1
       ORDER BY c.full_name`,
      [userId],
    )

    return NextResponse.json({ success: true, centers: result.rows })
  } catch (error: any) {
    console.error('Error getting manager centers:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * POST /api/app-auth/manager-centers
 * Assign centers to a manager (replaces all existing assignments)
 * Body: { userId: number, centerIds: number[] }
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireBearerSuperAdmin(request)
    if (!gate.ok) return gate.response

    const { userId, centerIds } = await request.json()

    if (!userId || !Array.isArray(centerIds)) {
      return NextResponse.json(
        { error: 'userId and centerIds array are required' },
        { status: 400 },
      )
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Delete all existing assignments
      await client.query('DELETE FROM manager_centers WHERE user_id = $1', [
        userId,
      ])

      // Insert new assignments
      if (centerIds.length > 0) {
        await client.query(
          `INSERT INTO manager_centers (user_id, center_id, assigned_by_email, assigned_at)
           SELECT $1, x.center_id, $2, CURRENT_TIMESTAMP
           FROM UNNEST($3::int[]) AS x(center_id)`,
          [userId, gate.sessionEmail, centerIds],
        )
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        userId,
        assignedCenterCount: centerIds.length,
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Error setting manager centers:', error)
    return NextResponse.json(
      { error: 'Server error: ' + error.message },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/app-auth/manager-centers?userId=123&centerId=456
 * Remove a center assignment from a manager
 */
export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireBearerSuperAdmin(request)
    if (!gate.ok) return gate.response

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const centerId = searchParams.get('centerId')

    if (!userId || !centerId) {
      return NextResponse.json(
        { error: 'userId and centerId are required' },
        { status: 400 },
      )
    }

    await pool.query(
      'DELETE FROM manager_centers WHERE user_id = $1 AND center_id = $2',
      [userId, centerId],
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting manager center:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
