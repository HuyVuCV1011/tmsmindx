import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function ensureRegistrationSchema(client?: { query: (text: string) => Promise<any> }) {
  const db = client ?? pool;
  await db.query(`
    ALTER TABLE chuyen_sau_results
      ADD COLUMN IF NOT EXISTS explanation_id BIGINT;
  `);

  await db.query(`
    ALTER TABLE chuyen_sau_dangky
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS registration_type VARCHAR(30),
      ADD COLUMN IF NOT EXISTS source_form VARCHAR(50),
      ADD COLUMN IF NOT EXISTS center_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS event_schedule_id UUID;
  `);

  await db.query(`
    DO $$
    BEGIN
      IF to_regclass('public.chuyen_sau_giaitrinh') IS NOT NULL THEN
        ALTER TABLE chuyen_sau_giaitrinh
          ADD COLUMN IF NOT EXISTS explanation_id BIGINT,
          ADD COLUMN IF NOT EXISTS registration_id BIGINT;
      END IF;
    END $$;
  `);
}

export async function GET(request: NextRequest) {
  try {
    await ensureRegistrationSchema();

    const { searchParams } = new URL(request.url);
    const teacherCode = searchParams.get('teacher_code');
    const teacherCodesRaw = searchParams.get('teacher_codes');
    const month = searchParams.get('month');

    const eventScheduleColumnCheck = await pool.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'chuyen_sau_dangky'
          AND column_name = 'event_schedule_id'
      ) AS exists
      `
    );
    const hasEventScheduleIdColumn = Boolean(eventScheduleColumnCheck.rows[0]?.exists);
    const eventScheduleSelect = hasEventScheduleIdColumn
      ? `csd.event_schedule_id::text AS event_schedule_id,`
      : `CASE
          WHEN csd.registration_note IS NOT NULL AND csd.registration_note LIKE '{%'
            THEN NULLIF(csd.registration_note::jsonb ->> 'scheduled_event_id', '')
          ELSE NULL
        END AS event_schedule_id,`;

    if (!teacherCode && !teacherCodesRaw) {
      return NextResponse.json(
        { success: false, error: 'teacher_code or teacher_codes is required' },
        { status: 400 }
      );
    }

    const chuyenSauExplanationTableCheck = await pool.query(
      `SELECT to_regclass('public.chuyen_sau_giaitrinh') IS NOT NULL AS exists`
    );
    const hasChuyenSauExplanationTable = Boolean(chuyenSauExplanationTableCheck.rows[0]?.exists);

    const chuyenSauExplanationRegistrationColumnCheck = await pool.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'chuyen_sau_giaitrinh'
          AND column_name = 'registration_id'
      ) AS exists
      `
    );
    const hasChuyenSauExplanationRegistrationColumn = Boolean(chuyenSauExplanationRegistrationColumnCheck.rows[0]?.exists);

    const csgJoin = hasChuyenSauExplanationTable
      ? `
      LEFT JOIN LATERAL (
        SELECT csg.status::text AS status, csg.reviewer_note
        FROM chuyen_sau_giaitrinh csg
        WHERE (
          csr.assignment_id IS NOT NULL
          AND csg.assignment_id = csr.assignment_id
        )
        ${hasChuyenSauExplanationRegistrationColumn ? `OR (
          csr.registration_id IS NOT NULL
          AND csg.registration_id = csr.registration_id
        )` : ''}
        OR (
          csr.explanation_id IS NOT NULL
          AND csg.explanation_id = csr.explanation_id
        )
        ORDER BY csg.updated_at DESC, csg.created_at DESC, csg.id DESC
        LIMIT 1
      ) csg_ex ON TRUE
      `
      : '';

    let query = `
      SELECT
        csr.id AS result_id,
        csp.id AS assignment_id,
        csp.id AS id,
        csp.registration_id,
        LOWER(TRIM(csd.teacher_code)) AS teacher_code,
        csd.exam_type,
        COALESCE(csd.registration_type, 'official') AS registration_type,
        csd.block_code,
        csd.subject_code,
        COALESCE(
          csp.open_at,
          CASE
            WHEN COALESCE(csr.thoi_gian_kiem_tra, '') ~ '^[0-9]{1,2}:[0-9]{2} [0-9]{2}/[0-9]{2}/[0-9]{4}$'
              THEN (to_timestamp(csr.thoi_gian_kiem_tra, 'HH24:MI DD/MM/YYYY')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
            ELSE NULL
          END,
          csd.scheduled_at,
          make_timestamp(csd.year, csd.month, 1, 0, 0, 0)
        ) AS open_at,
        COALESCE(
          csp.close_at,
          CASE
            WHEN COALESCE(csr.thoi_gian_kiem_tra, '') ~ '^[0-9]{1,2}:[0-9]{2} [0-9]{2}/[0-9]{2}/[0-9]{4}$'
              THEN (to_timestamp(csr.thoi_gian_kiem_tra, 'HH24:MI DD/MM/YYYY')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') + make_interval(mins => 90)
            ELSE NULL
          END,
          csd.scheduled_at + make_interval(mins => 90),
          make_timestamp(csd.year, csd.month, 1, 0, 0, 0) + make_interval(mins => 90)
        ) AS close_at,
        CASE
          WHEN LOWER(TRIM(COALESCE(csr.xu_ly_diem, ''))) = 'da thi' AND csr.assignment_id = csp.id THEN 'graded'
          WHEN sb.submitted_at IS NOT NULL OR LOWER(COALESCE(sb.status, '')) IN ('submitted', 'graded') THEN 'graded'
          WHEN LOWER(COALESCE(csp.assignment_status, '')) IN ('submitted', 'graded') THEN 'graded'
          WHEN LOWER(COALESCE(csp.assignment_status, '')) IN ('in_progress', 'expired') THEN LOWER(csp.assignment_status)
          WHEN COALESCE(csr.diem, 0) > 0 THEN 'submitted'
          ELSE 'assigned'
        END AS assignment_status,
        COALESCE(csr.diem, csp.score, NULL)::numeric AS score,
        CASE
          WHEN csr.id IS NOT NULL THEN
            CASE
              WHEN csr.diem IS NULL THEN 'null'
              WHEN COALESCE(csr.diem, 0) = 0
                AND (
                  LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%mac dinh 0%'
                  OR LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%mặc định 0%'
                )
                THEN 'auto_zero'
              ELSE 'graded'
            END
          ELSE COALESCE(csp.score_status, CASE WHEN COALESCE(csr.diem, 0) > 0 THEN 'graded' ELSE 'null' END)
        END AS score_status,
        COALESCE(csr.xu_ly_diem, '')::text AS score_handling_note,
        csp.selected_set_id,
        csp.created_at,
        csp.updated_at,
        es.set_code,
        es.set_name,
        es.total_points,
        es.passing_score,
        COALESCE(csr.cau_dung, 0)::int AS correct_answers,
        COALESCE((
          SELECT COUNT(*)::int
          FROM chuyen_sau_bode_cauhoi esq_count
          WHERE esq_count.set_id = csp.selected_set_id
        ), 0)::int AS total_questions,
        es.status AS set_status,
        es.valid_from AS set_valid_from,
        es.valid_to AS set_valid_to,
        EXISTS (
          SELECT 1
          FROM chuyen_sau_bode_cauhoi esq
          WHERE esq.set_id = csp.selected_set_id
        ) AS has_questions,
        ${eventScheduleSelect}
        COALESCE(
          csg_ex.status,
          CASE
            WHEN LOWER(COALESCE(ex_link.status, '')) IN ('accepted', 'approved') THEN 'accepted'
            WHEN LOWER(COALESCE(ex_link.status, '')) = 'rejected' THEN 'rejected'
            WHEN LOWER(COALESCE(ex_link.status, '')) = 'pending' THEN 'pending'
            ELSE NULL
          END,
          CASE
            WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%khong tinh diem%' THEN 'accepted'
            WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%tu choi%' THEN 'rejected'
            WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%giu diem 0%' THEN 'rejected'
            WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%cho duyet giai trinh%' THEN 'pending'
            WHEN NULLIF(TRIM(COALESCE(csr.email_giai_trinh, '')), '') IS NOT NULL THEN 'pending'
            ELSE NULL
          END
        )::text AS explanation_status,
        csr.explanation_id AS explanation_id,
        csg_ex.reviewer_note AS admin_note
      FROM chuyen_sau_phancong csp
      JOIN chuyen_sau_dangky csd ON csd.id = csp.registration_id
      LEFT JOIN chuyen_sau_bode es ON es.id = csp.selected_set_id
      LEFT JOIN LATERAL (
        SELECT csb.status, csb.submitted_at
        FROM chuyen_sau_bainop csb
        WHERE csb.assignment_id = csp.id
        ORDER BY
          CASE WHEN csb.submitted_at IS NOT NULL THEN 0 ELSE 1 END,
          csb.updated_at DESC,
          csb.created_at DESC
        LIMIT 1
      ) sb ON TRUE
      LEFT JOIN LATERAL (
        SELECT r.*
        FROM chuyen_sau_results r
        WHERE r.assignment_id = csp.id
           OR (r.assignment_id IS NULL AND r.registration_id = csp.registration_id)
        ORDER BY
          CASE WHEN r.assignment_id = csp.id THEN 0 ELSE 1 END,
          r.updated_at DESC,
          r.created_at DESC
        LIMIT 1
      ) csr ON TRUE
      LEFT JOIN explanations ex_link ON ex_link.id = csr.explanation_id
      ${csgJoin}
      WHERE TRUE
    `;

    const values: any[] = [];

    const teacherCodes = (teacherCodesRaw || '')
      .split(',')
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean);

    const normalizedPrimaryTeacherCode = (teacherCode || '').trim().toLowerCase();

    if (teacherCodes.length > 0) {
      values.push(teacherCodes);
      query += `
        AND (
          LOWER(TRIM(csd.teacher_code)) = ANY($${values.length}::text[])
          OR LOWER(TRIM(COALESCE(csr.ma_lms, ''))) = ANY($${values.length}::text[])
        )
      `;
    } else {
      values.push(normalizedPrimaryTeacherCode);
      query += `
        AND (
          LOWER(TRIM(csd.teacher_code)) = $${values.length}
          OR LOWER(TRIM(COALESCE(csr.ma_lms, ''))) = $${values.length}
        )
      `;
    }

    if (month) {
      const [monthYear, monthNumber] = month.split('-').map(Number);
      if (Number.isFinite(monthYear) && Number.isFinite(monthNumber)) {
        values.push(monthYear);
        values.push(monthNumber);
        query += `
          AND csd.year = $${values.length - 1}
          AND csd.month = $${values.length}
        `;
      }
    }

    const since = searchParams.get('since');
    if (since) {
      values.push(since);
      query += `
        AND COALESCE(csp.open_at::date, csd.scheduled_at::date, make_date(csd.year, csd.month, 1)) >= $${values.length}::date
      `;
    }

    const before = searchParams.get('before');
    if (before) {
      values.push(before);
      query += `
        AND COALESCE(csp.open_at::date, csd.scheduled_at::date, make_date(csd.year, csd.month, 1)) < $${values.length}::date
      `;
    }

    query += `
      ORDER BY csd.year DESC, csd.month DESC, csp.updated_at DESC
    `;

    const assignmentResult = await pool.query(query, values);

    let resultsOnlyQuery = `
      SELECT
        csr.id AS result_id,
        NULL::bigint AS assignment_id,
        NULL::bigint AS id,
        csr.registration_id,
        LOWER(TRIM(COALESCE(csd.teacher_code, csr.ma_lms))) AS teacher_code,
        COALESCE(csd.exam_type, 'expertise') AS exam_type,
        COALESCE(csd.registration_type, 'official') AS registration_type,
        COALESCE(
          csd.block_code,
          CASE
            WHEN LOWER(COALESCE(csr.bo_mon, '')) LIKE '%quy trinh%' THEN 'PROCESS'
            ELSE 'CODING'
          END
        ) AS block_code,
        COALESCE(csd.subject_code, csr.bo_mon) AS subject_code,
        COALESCE(
          CASE
            WHEN COALESCE(csr.thoi_gian_kiem_tra, '') ~ '^[0-9]{1,2}:[0-9]{2} [0-9]{2}/[0-9]{2}/[0-9]{4}$'
              THEN (to_timestamp(csr.thoi_gian_kiem_tra, 'HH24:MI DD/MM/YYYY')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
            ELSE NULL
          END,
          csd.scheduled_at,
          make_timestamp(csr.nam_dk, csr.thang_dk, 1, 0, 0, 0)
        ) AS open_at,
        COALESCE(
          CASE
            WHEN COALESCE(csr.thoi_gian_kiem_tra, '') ~ '^[0-9]{1,2}:[0-9]{2} [0-9]{2}/[0-9]{2}/[0-9]{4}$'
              THEN (to_timestamp(csr.thoi_gian_kiem_tra, 'HH24:MI DD/MM/YYYY')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') + make_interval(mins => 90)
            ELSE NULL
          END,
          csd.scheduled_at + make_interval(mins => 90),
          make_timestamp(csr.nam_dk, csr.thang_dk, 1, 0, 0, 0) + make_interval(mins => 90)
        ) AS close_at,
        CASE
          WHEN LOWER(TRIM(COALESCE(csr.xu_ly_diem, ''))) = 'da thi' THEN 'graded'
          WHEN COALESCE(csr.diem, 0) > 0 THEN 'graded'
          ELSE 'assigned'
        END AS assignment_status,
        csr.diem::numeric AS score,
        CASE
          WHEN csr.diem IS NULL THEN 'null'
          ELSE 'graded'
        END AS score_status,
        COALESCE(csr.xu_ly_diem, '')::text AS score_handling_note,
        CASE
          WHEN COALESCE(csr.de, '') ~ '^[0-9]+$' THEN csr.de::bigint
          ELSE NULL
        END AS selected_set_id,
        csr.created_at,
        csr.updated_at,
        es.set_code,
        es.set_name,
        es.total_points,
        es.passing_score,
        COALESCE(csr.cau_dung, 0)::int AS correct_answers,
        COALESCE((
          SELECT COUNT(*)::int
          FROM chuyen_sau_bode_cauhoi esq_count
          WHERE esq_count.set_id = es.id
        ), 0)::int AS total_questions,
        es.status AS set_status,
        es.valid_from AS set_valid_from,
        es.valid_to AS set_valid_to,
        EXISTS (
          SELECT 1
          FROM chuyen_sau_bode_cauhoi esq
          WHERE esq.set_id = es.id
        ) AS has_questions,
        ${eventScheduleSelect}
        CASE
          WHEN LOWER(COALESCE(ex_link.status, '')) IN ('accepted', 'approved') THEN 'accepted'
          WHEN LOWER(COALESCE(ex_link.status, '')) = 'rejected' THEN 'rejected'
          WHEN LOWER(COALESCE(ex_link.status, '')) = 'pending' THEN 'pending'
          WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%khong tinh diem%' THEN 'accepted'
          WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%tu choi%' THEN 'rejected'
          WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%giu diem 0%' THEN 'rejected'
          WHEN LOWER(COALESCE(csr.xu_ly_diem, '')) LIKE '%cho duyet giai trinh%' THEN 'pending'
          WHEN NULLIF(TRIM(COALESCE(csr.email_giai_trinh, '')), '') IS NOT NULL THEN 'pending'
          ELSE NULL
        END::text AS explanation_status,
        csr.explanation_id AS explanation_id,
        NULL::text AS admin_note
      FROM chuyen_sau_results csr
      LEFT JOIN explanations ex_link ON ex_link.id = csr.explanation_id
      LEFT JOIN chuyen_sau_dangky csd ON csd.id = csr.registration_id
      LEFT JOIN chuyen_sau_bode es
        ON es.id = CASE
          WHEN COALESCE(csr.de, '') ~ '^[0-9]+$' THEN csr.de::bigint
          ELSE NULL
        END
      WHERE TRUE
    `;

    const resultValues: any[] = [];
    if (teacherCodes.length > 0) {
      resultValues.push(teacherCodes);
      resultsOnlyQuery += `
        AND (
          LOWER(TRIM(COALESCE(csd.teacher_code, ''))) = ANY($${resultValues.length}::text[])
          OR LOWER(TRIM(COALESCE(csr.ma_lms, ''))) = ANY($${resultValues.length}::text[])
        )
      `;
    } else {
      resultValues.push(normalizedPrimaryTeacherCode);
      resultsOnlyQuery += `
        AND (
          LOWER(TRIM(COALESCE(csd.teacher_code, ''))) = $${resultValues.length}
          OR LOWER(TRIM(COALESCE(csr.ma_lms, ''))) = $${resultValues.length}
        )
      `;
    }

    if (month) {
      const [monthYear, monthNumber] = month.split('-').map(Number);
      if (Number.isFinite(monthYear) && Number.isFinite(monthNumber)) {
        resultValues.push(monthYear);
        resultValues.push(monthNumber);
        resultsOnlyQuery += `
          AND COALESCE(csd.year, csr.nam_dk) = $${resultValues.length - 1}
          AND COALESCE(csd.month, csr.thang_dk) = $${resultValues.length}
        `;
      }
    }

    if (since) {
      resultValues.push(since);
      resultsOnlyQuery += `
        AND COALESCE(csd.scheduled_at::date, make_date(csr.nam_dk, csr.thang_dk, 1)) >= $${resultValues.length}::date
      `;
    }

    if (before) {
      resultValues.push(before);
      resultsOnlyQuery += `
        AND COALESCE(csd.scheduled_at::date, make_date(csr.nam_dk, csr.thang_dk, 1)) < $${resultValues.length}::date
      `;
    }

    resultsOnlyQuery += `
      ORDER BY COALESCE(csd.year, csr.nam_dk) DESC,
               COALESCE(csd.month, csr.thang_dk) DESC,
               csr.updated_at DESC
    `;

    const resultsOnlyResult = await pool.query(resultsOnlyQuery, resultValues);

    // Keep all assignment-backed rows (real chuyen_sau_phancong records), deduplicated by assignment_id.
    // Also keep result-only rows that aren't already covered by an assignment row.
    // This ensures newly registered exams (no result yet) are always visible.
    const seenAssignmentIds = new Set<number>();
    const assignmentRows = assignmentResult.rows.filter((row) => {
      const id = Number(row.assignment_id || 0);
      if (id <= 0) return false;
      if (seenAssignmentIds.has(id)) return false;
      seenAssignmentIds.add(id);
      return true;
    });
    const coveredResultIds = new Set(
      assignmentRows.map((r) => Number(r.result_id || 0)).filter((id) => id > 0)
    );
    const additionalResultRows = resultsOnlyResult.rows.filter((row) => {
      const resultId = Number(row.result_id || 0);
      return resultId > 0 && !coveredResultIds.has(resultId);
    });
    const mergedRows = [...assignmentRows, ...additionalResultRows];

    const now = new Date();
    const mapped = mergedRows.map((row) => {
      const openAt = new Date(row.open_at);
      const closeAt = new Date(row.close_at);
      const isOpen = now >= openAt && now <= closeAt;
      const validFrom = row.set_valid_from ? new Date(row.set_valid_from) : null;
      const validTo = row.set_valid_to ? new Date(row.set_valid_to) : null;

      const isWithinSetWindow =
        (!validFrom || now >= validFrom) &&
        (!validTo || now <= validTo);

      const isSetActiveNow = row.set_status === 'active' && isWithinSetWindow;
      const assignmentId = Number(row.assignment_id || row.id || 0);
      const resultId = Number(row.result_id || 0);
      // Some rows can come from chuyen_sau_results without a materialized assignment row yet.
      // In that case, use result_id as fallback so downstream APIs can resolve to real assignment.
      const runtimeId = assignmentId > 0 ? assignmentId : resultId;
      const hasRuntimeId = Number.isFinite(runtimeId) && runtimeId > 0;
      const hasSet = Number.isFinite(Number(row.selected_set_id)) && Number(row.selected_set_id) > 0;
      const rawStatus = String(row.assignment_status || '').toLowerCase();
      const handlingNote = String(row.score_handling_note || '').toLowerCase();
      const isDefaultZeroNeedExplanation = handlingNote.includes('mac dinh 0') || handlingNote.includes('mặc định 0');
      const isSubmittedOrGraded = rawStatus === 'submitted' || rawStatus === 'graded';
      const isExpiredByTime = now > closeAt;

      let effectiveAssignmentStatus = rawStatus || 'assigned';
      let effectiveExplanationStatus = row.explanation_status || null;

      // Business rule:
      // - While still in exam window and not submitted: keep default-zero marker only (not pending explanation yet).
      // - After deadline and still not submitted: switch to explanation pending.
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
        isSetActiveNow &&
        row.has_questions === true &&
        isAllowedStatus &&
        effectiveExplanationStatus !== 'accepted';

      const effectiveScore = effectiveExplanationStatus === 'accepted' ? null : row.score;
      const effectiveScoreStatus = effectiveExplanationStatus === 'accepted' ? 'null' : row.score_status;
      const explanationId = Number(row.explanation_id || 0);

      return {
        ...row,
        score: effectiveScore,
        score_status: effectiveScoreStatus,
        assignment_status: effectiveAssignmentStatus,
        explanation_status: effectiveExplanationStatus,
        explanation_id: Number.isFinite(explanationId) && explanationId > 0 ? explanationId : null,
        id: runtimeId,
        is_open: isOpen,
        is_set_active_now: isSetActiveNow,
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
