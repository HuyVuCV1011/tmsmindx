import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherCode = searchParams.get('teacher_code');
    const teacherCodesRaw = searchParams.get('teacher_codes');
    const month = searchParams.get('month');
    const since = searchParams.get('since');
    const before = searchParams.get('before');

    if (!teacherCode && !teacherCodesRaw) {
      return NextResponse.json(
        { success: false, error: 'teacher_code or teacher_codes is required' },
        { status: 400 }
      );
    }

    // Guard: kiểm tra bảng chuyen_sau_results có tồn tại không
    const tableCheck = await pool.query(`
      SELECT
        to_regclass('public.chuyen_sau_results') IS NOT NULL AS has_results,
        to_regclass('public.chuyen_sau_giaitrinh') IS NOT NULL AS has_giaitrinh
    `);
    const hasResults = Boolean(tableCheck.rows[0]?.has_results);
    const hasGiaitrinh = Boolean(tableCheck.rows[0]?.has_giaitrinh);

    if (!hasResults) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }

    const teacherCodes = (teacherCodesRaw || '')
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const normalizedPrimary = (teacherCode || '').trim().toLowerCase();

    // JOIN với chuyen_sau_giaitrinh nếu tồn tại
    const giaitrinh_join = hasGiaitrinh
      ? `
      LEFT JOIN LATERAL (
        SELECT csg.tru_diem
        FROM chuyen_sau_giaitrinh csg
        WHERE csg.id_ket_qua = csr.id
        ORDER BY csg.tao_luc DESC
        LIMIT 1
      ) csg ON TRUE
      `
      : '';

    const giaitrinh_select = hasGiaitrinh
      ? `COALESCE(csg.tru_diem, 0)::numeric AS penalty_deduction,`
      : `0::numeric AS penalty_deduction,`;

    let query = `
      SELECT
        csr.id                                                    AS result_id,
        csr.id                                                    AS id,
        LOWER(TRIM(COALESCE(csr.ma_giao_vien, '')))              AS teacher_code,
        csr.ho_ten,
        csr.dia_chi_email,
        csr.co_so_lam_viec,
        csr.khu_vuc,
        COALESCE(csr.hinh_thuc, 'Chính Thức')                    AS registration_type,
        csr.khoi_giang_day                                       AS block_code,
        csm.ma_mon                                               AS subject_code,
        csm.ten_mon                                              AS subject_name,
        csm.ma_khoi                                              AS subject_block,
        csr.id_mon,
        csr.id_de_thi                                            AS selected_set_id,
        csr.id_su_kien::text                                     AS event_schedule_id,
        csr.thang_dk,
        csr.nam_dk,
        csr.dot,
        -- Thời điểm thi (open_at)
        COALESCE(
          CASE
            WHEN COALESCE(csr.thoi_gian_kiem_tra, '') ~ '^[0-9]{1,2}:[0-9]{2} [0-9]{2}/[0-9]{2}/[0-9]{4}$'
              THEN (to_timestamp(csr.thoi_gian_kiem_tra, 'HH24:MI DD/MM/YYYY')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
            ELSE NULL
          END,
          csr.dang_ky_luc,
          make_timestamp(csr.nam_dk, csr.thang_dk, 1, 0, 0, 0)
        ) AS open_at,
        COALESCE(
          CASE
            WHEN COALESCE(csr.thoi_gian_kiem_tra, '') ~ '^[0-9]{1,2}:[0-9]{2} [0-9]{2}/[0-9]{2}/[0-9]{4}$'
              THEN (to_timestamp(csr.thoi_gian_kiem_tra, 'HH24:MI DD/MM/YYYY')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
                    + make_interval(mins => COALESCE(csm.thoi_gian_thi_phut, 90))
            ELSE NULL
          END,
          csr.dang_ky_luc + make_interval(mins => COALESCE(csm.thoi_gian_thi_phut, 90)),
          make_timestamp(csr.nam_dk, csr.thang_dk, 1, 0, 0, 0) + make_interval(mins => 90)
        ) AS close_at,
        -- Trạng thái bài thi
        CASE
          WHEN LOWER(TRIM(COALESCE(csr.xu_ly_diem, ''))) = 'da thi' THEN 'graded'
          WHEN COALESCE(csr.diem, 0) > 0                            THEN 'graded'
          ELSE 'assigned'
        END AS assignment_status,
        csr.diem::numeric                                        AS score,
        CASE
          WHEN csr.diem IS NULL                                  THEN 'null'
          ELSE 'graded'
        END AS score_status,
        COALESCE(csr.xu_ly_diem, '')::text                       AS score_handling_note,
        COALESCE(csr.cau_dung, 0)::int                           AS correct_answers,
        csr.da_giai_thich,
        csr.so_lan_giai_thich,
        csr.tong_diem_bi_tru,
        ${giaitrinh_select}
        -- Thông tin bộ đề
        es.ma_de                                                 AS set_code,
        es.ten_de                                                AS set_name,
        es.tong_diem                                             AS total_points,
        es.diem_dat                                              AS passing_score,
        es.trang_thai                                            AS set_status,
        NULL::timestamp                                          AS set_valid_from,
        NULL::timestamp                                          AS set_valid_to,
        COALESCE((
          SELECT COUNT(*)::int
          FROM chuyen_sau_bode_cauhoi bq
          WHERE bq.id_de = csr.id_de_thi
        ), 0) AS total_questions,
        EXISTS (
          SELECT 1
          FROM chuyen_sau_bode_cauhoi bq
          WHERE bq.id_de = csr.id_de_thi
        ) AS has_questions,
        -- Explanation status từ xu_ly_diem
        CASE
          WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%khong tinh diem%' THEN 'accepted'
          WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%tu choi%'         THEN 'rejected'
          WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%giu diem 0%'      THEN 'rejected'
          WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%cho duyet%'       THEN 'pending'
          WHEN NULLIF(TRIM(COALESCE(csr.email_giai_trinh, '')), '') IS NOT NULL THEN 'pending'
          ELSE NULL
        END::text AS explanation_status,
        NULL::text AS admin_note,
        csr.tao_luc  AS created_at,
        csr.tao_luc  AS updated_at
      FROM chuyen_sau_results csr
      LEFT JOIN chuyen_sau_monhoc csm ON csm.id = csr.id_mon
      LEFT JOIN chuyen_sau_bode   es  ON es.id  = csr.id_de_thi
      ${giaitrinh_join}
      WHERE TRUE
    `;

    const values: any[] = [];

    if (teacherCodes.length > 0) {
      values.push(teacherCodes);
      query += `
        AND LOWER(TRIM(COALESCE(csr.ma_giao_vien, ''))) = ANY($${values.length}::text[])
      `;
    } else {
      values.push(normalizedPrimary);
      query += `
        AND LOWER(TRIM(COALESCE(csr.ma_giao_vien, ''))) = $${values.length}
      `;
    }

    if (month) {
      const [monthYear, monthNumber] = month.split('-').map(Number);
      if (Number.isFinite(monthYear) && Number.isFinite(monthNumber)) {
        values.push(monthYear);
        values.push(monthNumber);
        query += `
          AND csr.nam_dk = $${values.length - 1}
          AND csr.thang_dk = $${values.length}
        `;
      }
    }

    if (since) {
      values.push(since);
      query += `
        AND COALESCE(csr.dang_ky_luc::date, make_date(csr.nam_dk, csr.thang_dk, 1)) >= $${values.length}::date
      `;
    }

    if (before) {
      values.push(before);
      query += `
        AND COALESCE(csr.dang_ky_luc::date, make_date(csr.nam_dk, csr.thang_dk, 1)) < $${values.length}::date
      `;
    }

    query += `
      ORDER BY csr.nam_dk DESC, csr.thang_dk DESC, csr.tao_luc DESC
    `;

    const result = await pool.query(query, values);

    const now = new Date();
    const mapped = result.rows.map((row) => {
      const openAt = row.open_at ? new Date(row.open_at) : null;
      const closeAt = row.close_at ? new Date(row.close_at) : null;
      const isOpen = openAt && closeAt ? now >= openAt && now <= closeAt : false;

      const isSetActive = row.set_status === 'hoat_dong' || row.set_status === 'active';
      const selectedSetId = Number(row.selected_set_id || 0);
      const hasSet = Number.isFinite(selectedSetId) && selectedSetId > 0;
      const resultId = Number(row.result_id || 0);
      const hasRuntimeId = Number.isFinite(resultId) && resultId > 0;

      const rawStatus = String(row.assignment_status || '').toLowerCase();
      const handlingNote = String(row.score_handling_note || '').toLowerCase();
      const isDefaultZeroNeedExplanation =
        handlingNote.includes('mac dinh 0') || handlingNote.includes('mặc định 0');
      const isSubmittedOrGraded = rawStatus === 'submitted' || rawStatus === 'graded';
      const isExpiredByTime = closeAt ? now > closeAt : false;

      let effectiveAssignmentStatus = rawStatus || 'assigned';
      let effectiveExplanationStatus = row.explanation_status || null;

      if (isDefaultZeroNeedExplanation && !isSubmittedOrGraded) {
        if (isExpiredByTime) {
          effectiveAssignmentStatus = 'expired';
          if (!effectiveExplanationStatus || effectiveExplanationStatus === 'rejected') {
            effectiveExplanationStatus = 'pending';
          }
        } else {
          effectiveExplanationStatus = null;
          if (!['assigned', 'in_progress'].includes(effectiveAssignmentStatus)) {
            effectiveAssignmentStatus = 'assigned';
          }
        }
      }

      const isAllowedStatus = ['assigned', 'in_progress'].includes(effectiveAssignmentStatus);
      const canTake =
        hasRuntimeId &&
        hasSet &&
        isOpen &&
        isSetActive &&
        row.has_questions === true &&
        isAllowedStatus &&
        effectiveExplanationStatus !== 'accepted';

      return {
        ...row,
        assignment_status: effectiveAssignmentStatus,
        explanation_status: effectiveExplanationStatus,
        id: resultId,
        is_open: isOpen,
        is_set_active_now: isSetActive,
        can_take: canTake,
      };
    });

    return NextResponse.json({
      success: true,
      data: mapped,
      count: mapped.length,
    });
  } catch (error: any) {
    console.error('Error fetching exam assignments:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch exam assignments' },
      { status: 500 }
    );
  }
}
