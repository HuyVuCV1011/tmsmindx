import pool from '@/lib/db'
import { withTracking } from '@/lib/withTracking'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/metrics/engagement?period=today|7d|30d
 * Returns user engagement metrics for Super Admin dashboard.
 */
async function getEngagement(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'

    let intervalSql: string
    let dayCount: number
    switch (period) {
      case 'today':
        intervalSql = '1 day'
        dayCount = 1
        break
      case '30d':
        intervalSql = '30 days'
        dayCount = 30
        break
      default: // 7d
        intervalSql = '7 days'
        dayCount = 7
    }

    // ── 1. DAU (Daily Active Users) ──
    const dauRes = await pool.query(`
      SELECT 
        DATE(created_at) AS date,
        COUNT(DISTINCT user_id) AS users
      FROM system_events
      WHERE event_name = 'page_view'
        AND user_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${intervalSql}'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)
    const dau = dauRes.rows.map((r) => ({
      date: r.date,
      users: parseInt(r.users, 10),
    }))

    // ── 2. WAU (Weekly Active Users) — aggregated by week ──
    const wauRes = await pool.query(`
      SELECT 
        DATE_TRUNC('week', created_at)::date AS week_start,
        COUNT(DISTINCT user_id) AS users
      FROM system_events
      WHERE event_name = 'page_view'
        AND user_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${Math.max(dayCount, 30)} days'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week_start ASC
    `)
    const wau = wauRes.rows.map((r) => ({
      date: r.week_start,
      users: parseInt(r.users, 10),
    }))

    // ── 3. Avg Session Duration (seconds) ──
    const sessionRes = await pool.query(`
      WITH sessions AS (
        SELECT 
          session_id,
          MIN(created_at) AS start_time,
          MAX(created_at) AS end_time
        FROM system_events
        WHERE session_id IS NOT NULL
          AND created_at >= NOW() - INTERVAL '${intervalSql}'
        GROUP BY session_id
        HAVING COUNT(*) > 1
      )
      SELECT AVG(EXTRACT(EPOCH FROM (end_time - start_time)))::int AS avg_duration
      FROM sessions
      WHERE EXTRACT(EPOCH FROM (end_time - start_time)) BETWEEN 10 AND 7200
    `)
    const avg_session_duration = parseInt(
      sessionRes.rows[0]?.avg_duration || '0',
      10,
    )

    // ── 4. Top Pages ──
    const topPagesRes = await pool.query(`
      SELECT 
        properties->>'page' AS page,
        COUNT(*) AS views
      FROM system_events
      WHERE event_name = 'page_view'
        AND properties->>'page' IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${intervalSql}'
      GROUP BY properties->>'page'
      ORDER BY views DESC
      LIMIT 10
    `)
    const totalViews = topPagesRes.rows.reduce(
      (sum, r) => sum + parseInt(r.views, 10),
      0,
    )
    const top_pages = topPagesRes.rows.map((r) => ({
      page: r.page,
      views: parseInt(r.views, 10),
      percentage:
        totalViews > 0
          ? parseFloat(((parseInt(r.views, 10) / totalViews) * 100).toFixed(1))
          : 0,
    }))

    // ── 5. Device Distribution ──
    const deviceRes = await pool.query(`
      SELECT 
        COALESCE(properties->>'device', 'desktop') AS device,
        COUNT(*) AS cnt
      FROM system_events
      WHERE event_name = 'page_view'
        AND created_at >= NOW() - INTERVAL '${intervalSql}'
      GROUP BY COALESCE(properties->>'device', 'desktop')
    `)
    const totalDeviceHits = deviceRes.rows.reduce(
      (sum, r) => sum + parseInt(r.cnt, 10),
      0,
    )
    const devices: Record<string, number> = { mobile: 0, desktop: 0 }
    deviceRes.rows.forEach((r) => {
      const key = r.device === 'mobile' ? 'mobile' : 'desktop'
      devices[key] =
        totalDeviceHits > 0
          ? parseFloat(
              ((parseInt(r.cnt, 10) / totalDeviceHits) * 100).toFixed(1),
            )
          : 0
    })

    // ── 6. Feature Usage (top features) ──
    const featureRes = await pool.query(`
      SELECT 
        event_name,
        COUNT(*) AS usage_count,
        COUNT(DISTINCT user_id) AS unique_users
      FROM system_events
      WHERE event_name NOT IN ('page_view', 'session_start', 'session_end', 'api_request', 'error')
        AND created_at >= NOW() - INTERVAL '${intervalSql}'
      GROUP BY event_name
      ORDER BY usage_count DESC
      LIMIT 10
    `)
    const feature_usage = featureRes.rows.map((r) => ({
      feature: r.event_name,
      usage_count: parseInt(r.usage_count, 10),
      unique_users: parseInt(r.unique_users, 10),
    }))

    // ── 7. Retention: D1 / D7 / D30 ──
    const retentionRes = await pool.query(`
      WITH first_seen AS (
        SELECT user_id, MIN(DATE(created_at)) AS first_date
        FROM system_events
        WHERE user_id IS NOT NULL AND event_name = 'page_view'
        GROUP BY user_id
      ),
      retention AS (
        SELECT 
          fs.user_id,
          fs.first_date,
          ARRAY_AGG(DISTINCT DATE(se.created_at)) AS active_dates
        FROM first_seen fs
        JOIN system_events se ON se.user_id = fs.user_id AND se.event_name = 'page_view'
        WHERE se.created_at >= NOW() - INTERVAL '35 days'
        GROUP BY fs.user_id, fs.first_date
      )
      SELECT
        COUNT(*) AS total_users,
        COUNT(*) FILTER (WHERE (first_date + 1) = ANY(active_dates)) AS d1,
        COUNT(*) FILTER (WHERE (first_date + 7) = ANY(active_dates)) AS d7,
        COUNT(*) FILTER (WHERE (first_date + 30) = ANY(active_dates)) AS d30
      FROM retention
      WHERE first_date >= NOW() - INTERVAL '35 days'
    `)
    const totalUsers = parseInt(retentionRes.rows[0]?.total_users || '0', 10)
    const retention = {
      d1:
        totalUsers > 0
          ? parseFloat(
              (
                (parseInt(retentionRes.rows[0]?.d1 || '0', 10) / totalUsers) *
                100
              ).toFixed(1),
            )
          : 0,
      d7:
        totalUsers > 0
          ? parseFloat(
              (
                (parseInt(retentionRes.rows[0]?.d7 || '0', 10) / totalUsers) *
                100
              ).toFixed(1),
            )
          : 0,
      d30:
        totalUsers > 0
          ? parseFloat(
              (
                (parseInt(retentionRes.rows[0]?.d30 || '0', 10) / totalUsers) *
                100
              ).toFixed(1),
            )
          : 0,
    }

    return NextResponse.json({
      dau,
      wau,
      avg_session_duration,
      top_pages,
      devices,
      feature_usage,
      retention,
    })
  } catch (error: any) {
    console.error('[metrics/engagement] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch engagement metrics' },
      { status: 500 },
    )
  }
}

export const GET = withTracking(getEngagement, {
  endpoint: '/api/metrics/engagement',
  requireSuperAdmin: true,
})
