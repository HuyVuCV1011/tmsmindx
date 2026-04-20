import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Mapping: region → group (các region cùng nhóm sẽ thấy nhau)
const REGION_GROUPS: Record<string, string> = {
  'HCM 1': 'HCM1_HCM4',
  'HCM 4': 'HCM1_HCM4',
  'HCM 2': 'HCM2_HCM3',
  'HCM 3': 'HCM2_HCM3',
  'TỈNH NAM': 'TINH_NAM',
  'ONLINE': 'ONLINE',
  'HN 1': 'HN1_HN2',
  'HN 2': 'HN1_HN2',
  'TỈNH BẮC': 'TINH_BAC',
  'TỈNH TRUNG': 'TINH_TRUNG',
}

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ success: false, error: 'Thiếu email' }, { status: 400 })
    }

    // 0. Kiểm tra nếu là super_admin → trả về tất cả centers
    const adminCheck = await pool.query(
      `SELECT role FROM app_users WHERE LOWER(TRIM(email)) = $1 AND is_active = true LIMIT 1`,
      [email]
    )
    
    if (adminCheck.rows.length > 0 && adminCheck.rows[0].role === 'super_admin') {
      const allCentersResult = await pool.query(
        `SELECT id, region, short_code, full_name
         FROM centers
         WHERE status = 'Active'
         ORDER BY region, full_name`
      )
      return NextResponse.json({
        success: true,
        mainCentre: 'ALL',
        region: 'ALL',
        group: 'ALL',
        isSuperAdmin: true,
        centers: allCentersResult.rows,
      })
    }

    // 1. Lấy main_centre của teacher
    const teacherResult = await pool.query(
      `SELECT COALESCE(main_centre, "Main centre", centers) AS main_centre
       FROM teachers
       WHERE LOWER(TRIM(work_email)) = $1
          OR LOWER(TRIM("Work email")) = $1
       LIMIT 1`,
      [email]
    )

    if (teacherResult.rows.length === 0) {
      return NextResponse.json({ success: true, centers: [], region: null, group: null })
    }

    const mainCentre = teacherResult.rows[0].main_centre?.trim()
    if (!mainCentre) {
      return NextResponse.json({ success: true, centers: [], region: null, group: null })
    }

    // 2. Map main_centre → region qua bảng centers
    const centerResult = await pool.query(
      `SELECT region FROM centers WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1)) LIMIT 1`,
      [mainCentre]
    )

    if (centerResult.rows.length === 0) {
      return NextResponse.json({ success: true, centers: [], region: null, group: null, mainCentre })
    }

    const region = centerResult.rows[0].region?.trim()
    const group = REGION_GROUPS[region] || region

    // 3. Lấy tất cả regions trong cùng group
    const groupRegions = Object.entries(REGION_GROUPS)
      .filter(([, g]) => g === group)
      .map(([r]) => r)

    // 4. Lấy tất cả cơ sở thuộc các region đó
    const centersResult = await pool.query(
      `SELECT id, region, short_code, full_name
       FROM centers
       WHERE region = ANY($1::text[])
         AND status = 'Active'
       ORDER BY region, full_name`,
      [groupRegions]
    )

    return NextResponse.json({
      success: true,
      mainCentre,
      region,
      group,
      centers: centersResult.rows,
    })
  } catch (error: any) {
    console.error('Error in centers-by-user:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
