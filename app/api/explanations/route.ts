import pool from '@/lib/db';
import { NextResponse } from 'next/server';

type DbClient = {
  query: (text: string, values?: any[]) => Promise<any>;
};

function isSafeIdentifier(value: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

async function resolveFkSafeId(
  client: DbClient,
  constraintName: string,
  candidateId: number | null
): Promise<number | null> {
  if (!candidateId || candidateId <= 0) return null;

  const fkTargetRes = await client.query(
    `SELECT
       n.nspname AS schema_name,
       c.relname AS table_name
     FROM pg_constraint pc
     JOIN pg_class c ON c.oid = pc.confrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE pc.conname = $1
     LIMIT 1`,
    [constraintName]
  );

  // No FK configured => keep compatibility with current behavior.
  if (!fkTargetRes.rows.length) {
    return candidateId;
  }

  const schemaName = String(fkTargetRes.rows[0]?.schema_name || 'public');
  const tableName = String(fkTargetRes.rows[0]?.table_name || '');

  if (!isSafeIdentifier(schemaName) || !isSafeIdentifier(tableName)) {
    return null;
  }

  const existsRes = await client.query(
    `SELECT 1
     FROM "${schemaName}"."${tableName}"
     WHERE id = $1
     LIMIT 1`,
    [candidateId]
  );

  if (existsRes.rows.length > 0) {
    return candidateId;
  }

  // Compatibility path:
  // Some environments still keep explanations.assignment_id FK -> teacher_exam_assignments.
  // If candidateId is from chuyen_sau_phancong, map by registration_id to a legacy assignment id.
  if (constraintName === 'fk_explanations_assignment' && tableName === 'teacher_exam_assignments') {
    const mappedLegacyAssignment = await client.query(
      `SELECT tea.id
       FROM chuyen_sau_phancong csp
       JOIN teacher_exam_assignments tea ON tea.registration_id = csp.registration_id
       WHERE csp.id = $1
       ORDER BY tea.updated_at DESC, tea.created_at DESC, tea.id DESC
       LIMIT 1`,
      [candidateId]
    );

    const mappedId = Number(mappedLegacyAssignment.rows[0]?.id || 0) || null;
    if (mappedId) {
      return mappedId;
    }
  }

  return null;
}

async function ensureExplanationBridgeSchema(client: DbClient): Promise<boolean> {
  await client.query(`
    ALTER TABLE explanations
      ADD COLUMN IF NOT EXISTS registration_id BIGINT,
      ADD COLUMN IF NOT EXISTS assignment_id BIGINT;
  `);

  await client.query(`
    ALTER TABLE chuyen_sau_results
      ADD COLUMN IF NOT EXISTS explanation_id BIGINT;
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_chuyen_sau_results_explanation_id'
      ) THEN
        ALTER TABLE chuyen_sau_results
          ADD CONSTRAINT fk_chuyen_sau_results_explanation_id
          FOREIGN KEY (explanation_id) REFERENCES explanations(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_chuyen_sau_results_explanation_id
    ON chuyen_sau_results(explanation_id)
    WHERE explanation_id IS NOT NULL;
  `);

  const tableCheck = await client.query(
    `SELECT to_regclass('public.chuyen_sau_giaitrinh') IS NOT NULL AS exists`
  );
  const hasChuyenSauExplanationTable = Boolean(tableCheck.rows[0]?.exists);

  if (!hasChuyenSauExplanationTable) {
    return false;
  }

  await client.query(`
    ALTER TABLE chuyen_sau_giaitrinh
      ADD COLUMN IF NOT EXISTS explanation_id BIGINT,
      ADD COLUMN IF NOT EXISTS registration_id BIGINT;
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_chuyen_sau_giaitrinh_explanation_id'
      ) THEN
        ALTER TABLE chuyen_sau_giaitrinh
          ADD CONSTRAINT fk_chuyen_sau_giaitrinh_explanation_id
          FOREIGN KEY (explanation_id) REFERENCES explanations(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_giaitrinh_explanation_id
    ON chuyen_sau_giaitrinh(explanation_id)
    WHERE explanation_id IS NOT NULL;
  `);

  return true;
}

// GET: Lay danh sach giai trinh
// Query params: email, status
export async function GET(request: Request) {
  let client;

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status');

    client = await pool.connect();
    const hasChuyenSauExplanationTable = await ensureExplanationBridgeSchema(client);

    let result;

    if (hasChuyenSauExplanationTable) {
      const values: any[] = [];
      const conditions: string[] = [];

      if (email) {
        values.push(email);
        conditions.push(`LOWER(TRIM(COALESCE(ex.email, csg.email, ''))) = LOWER(TRIM($${values.length}))`);
      }

      if (status) {
        values.push(status);
        conditions.push(`
          CASE
            WHEN LOWER(COALESCE(csg.status, ex.status, 'pending')) IN ('approved', 'accepted') THEN 'accepted'
            WHEN LOWER(COALESCE(csg.status, ex.status, 'pending')) = 'rejected' THEN 'rejected'
            ELSE 'pending'
          END = $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      result = await client.query(
        `SELECT
           COALESCE(ex.id::bigint, csg.id) AS id,
           csg.assignment_id,
           COALESCE(ex.teacher_name, reg.teacher_name, '') AS teacher_name,
           COALESCE(ex.lms_code, csg.teacher_code, reg.teacher_code, '') AS lms_code,
           COALESCE(ex.email, csg.email, '') AS email,
           COALESCE(ex.campus, reg.campus, csr.co_so, '') AS campus,
           COALESCE(ex.subject, reg.subject_code, csr.bo_mon, '') AS subject,
           COALESCE(
             ex.test_date::date,
             CASE
               WHEN reg.scheduled_at IS NOT NULL THEN reg.scheduled_at::date
               WHEN csr.nam_dk IS NOT NULL AND csr.thang_dk IS NOT NULL THEN make_date(csr.nam_dk, csr.thang_dk, 1)
               ELSE NULL
             END
           ) AS test_date,
           COALESCE(ex.reason, csg.reason, '') AS reason,
           CASE
             WHEN LOWER(COALESCE(csg.status, ex.status, 'pending')) IN ('approved', 'accepted') THEN 'accepted'
             WHEN LOWER(COALESCE(csg.status, ex.status, 'pending')) = 'rejected' THEN 'rejected'
             ELSE 'pending'
           END AS status,
           COALESCE(ex.admin_note, csg.reviewer_note) AS admin_note,
           COALESCE(ex.created_at, csg.created_at) AS created_at,
           GREATEST(COALESCE(ex.updated_at, csg.updated_at), csg.updated_at) AS updated_at
         FROM chuyen_sau_giaitrinh csg
         LEFT JOIN explanations ex ON ex.id = csg.explanation_id
         LEFT JOIN chuyen_sau_phancong csp ON csp.id = csg.assignment_id
         LEFT JOIN chuyen_sau_dangky reg
           ON reg.id = COALESCE(csg.registration_id, csp.registration_id, ex.registration_id)
         LEFT JOIN LATERAL (
           SELECT r.bo_mon, r.co_so, r.thang_dk, r.nam_dk
           FROM chuyen_sau_results r
           WHERE (csg.assignment_id IS NOT NULL AND r.assignment_id = csg.assignment_id)
              OR (reg.id IS NOT NULL AND r.registration_id = reg.id)
           ORDER BY
             CASE WHEN csg.assignment_id IS NOT NULL AND r.assignment_id = csg.assignment_id THEN 0 ELSE 1 END,
             r.updated_at DESC,
             r.created_at DESC
           LIMIT 1
         ) csr ON true
         ${whereClause}
         ORDER BY COALESCE(ex.created_at, csg.created_at) DESC`,
        values
      );
    } else {
      let query = 'SELECT * FROM explanations';
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (email) {
        conditions.push(`email = $${paramCount}`);
        values.push(email);
        paramCount++;
      }

      if (status) {
        conditions.push(`status = $${paramCount}`);
        values.push(status);
        paramCount++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC';
      result = await client.query(query, values);
    }

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

// POST: Tao giai trinh moi
export async function POST(request: Request) {
  let client;

  try {
    const body = await request.json();
    const {
      assignment_id,
      teacher_name,
      lms_code,
      email,
      campus,
      subject,
      test_date,
      reason,
    } = body;

    if (!teacher_name || !lms_code || !email || !campus || !subject || !test_date || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vui lòng điền đầy đủ thông tin',
        },
        { status: 400 }
      );
    }

    client = await pool.connect();
    const hasChuyenSauExplanationTable = await ensureExplanationBridgeSchema(client);

    const testDate = new Date(test_date);
    const month = Number.isNaN(testDate.getTime()) ? null : testDate.getMonth() + 1;
    const year = Number.isNaN(testDate.getTime()) ? null : testDate.getFullYear();
    let linkedAssignmentId: number | null = Number(assignment_id || 0) || null;
    let linkedRegistrationId: number | null = null;

    if (linkedAssignmentId) {
      const assignmentRes = await client.query(
        `SELECT registration_id
         FROM chuyen_sau_phancong
         WHERE id = $1
         LIMIT 1`,
        [linkedAssignmentId]
      );
      linkedRegistrationId = Number(assignmentRes.rows[0]?.registration_id || 0) || linkedRegistrationId;
    }

    let linkedResultId: number | null = null;

    if (month && year) {
      const scoreCheck = await client.query(
        `SELECT id, diem, assignment_id, registration_id
         FROM chuyen_sau_results
         WHERE LOWER(TRIM(ma_lms)) = LOWER(TRIM($1))
           AND LOWER(TRIM(bo_mon)) = LOWER(TRIM($2))
           AND thang_dk = $3
           AND nam_dk = $4
         ORDER BY
           CASE WHEN assignment_id IS NOT NULL THEN 0 ELSE 1 END,
           updated_at DESC,
           created_at DESC
         LIMIT 1`,
        [lms_code, subject, month, year]
      );

      if (!linkedAssignmentId) {
        linkedAssignmentId = Number(scoreCheck.rows[0]?.assignment_id || 0) || null;
      }
      linkedRegistrationId = Number(scoreCheck.rows[0]?.registration_id || 0) || linkedRegistrationId;
      linkedResultId = Number(scoreCheck.rows[0]?.id || 0) || null;
      const latestScore = Number(scoreCheck.rows[0]?.diem ?? NaN);

      if (!scoreCheck.rows.length || !Number.isFinite(latestScore) || latestScore > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Chỉ được gửi giải trình khi điểm hiện tại bằng 0',
          },
          { status: 400 }
        );
      }

      await client.query(
        `UPDATE chuyen_sau_results
         SET email_giai_trinh = $2,
             xu_ly_diem = 'Cho duyet giai trinh',
             updated_at = NOW()
         WHERE id = $1`,
        [scoreCheck.rows[0].id, email]
      );
    }

    if (hasChuyenSauExplanationTable && !linkedAssignmentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Không xác định được assignment để ghi nhận giải trình',
        },
        { status: 400 }
      );
    }

    const fkSafeRegistrationId = await resolveFkSafeId(
      client,
      'fk_explanations_registration',
      linkedRegistrationId
    );
    const fkSafeAssignmentId = await resolveFkSafeId(
      client,
      'fk_explanations_assignment',
      linkedAssignmentId
    );

    const insertExplanationQuery = `
      INSERT INTO explanations (
        teacher_name, lms_code, email, campus, subject, test_date, reason, status, registration_id, assignment_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
      RETURNING *
    `;

    const explanationValues = [
      teacher_name,
      lms_code,
      email,
      campus,
      subject,
      test_date,
      reason,
      fkSafeRegistrationId,
      fkSafeAssignmentId,
    ];
    let explanationResult;
    try {
      explanationResult = await client.query(insertExplanationQuery, explanationValues);
    } catch (insertError: any) {
      const isAssignmentFkError =
        insertError?.code === '23503' && insertError?.constraint === 'fk_explanations_assignment';
      const isRegistrationFkError =
        insertError?.code === '23503' && insertError?.constraint === 'fk_explanations_registration';

      if (!isAssignmentFkError && !isRegistrationFkError) {
        throw insertError;
      }

      // Final guard in mixed-schema environments: retry without foreign keys.
      const retryValues = [...explanationValues];
      if (isRegistrationFkError) {
        retryValues[7] = null;
      }
      if (isAssignmentFkError) {
        retryValues[8] = null;
      }
      explanationResult = await client.query(insertExplanationQuery, retryValues);
    }
    const createdExplanation = explanationResult.rows[0];

    if (linkedResultId) {
      await client.query(
        `UPDATE chuyen_sau_results
         SET explanation_id = $2,
             email_giai_trinh = COALESCE($3, email_giai_trinh),
             xu_ly_diem = 'Cho duyet giai trinh',
             updated_at = NOW()
         WHERE id = $1`,
        [linkedResultId, createdExplanation.id, email]
      );
    }

    if (hasChuyenSauExplanationTable) {
      await client.query(
        `INSERT INTO chuyen_sau_giaitrinh (
           assignment_id,
           teacher_code,
           email,
           reason,
           status,
           explanation_id,
           registration_id,
           updated_at
         )
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW())
         ON CONFLICT (assignment_id)
         DO UPDATE SET
           teacher_code = EXCLUDED.teacher_code,
           email = EXCLUDED.email,
           reason = EXCLUDED.reason,
           status = EXCLUDED.status,
           explanation_id = EXCLUDED.explanation_id,
           registration_id = COALESCE(EXCLUDED.registration_id, chuyen_sau_giaitrinh.registration_id),
           reviewer_email = NULL,
           reviewer_note = NULL,
           reviewed_at = NULL,
           updated_at = NOW()`,
        [
          linkedAssignmentId,
          lms_code,
          email,
          reason,
          createdExplanation.id,
          linkedRegistrationId,
        ]
      );
    }

    let emailNotSent = false;
    try {
      const emailResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/send-explanation-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new',
            explanation: createdExplanation,
          }),
        }
      );

      const emailData = await emailResponse.json();
      if (emailData.emailNotSent) {
        emailNotSent = true;
        console.warn('Email not sent for new explanation:', createdExplanation.id);
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      emailNotSent = true;
    }

    return NextResponse.json({
      success: true,
      message: 'Tạo giải thích thành công',
      data: createdExplanation,
      emailNotSent,
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

// PATCH: Cap nhat trang thai giai trinh (admin)
export async function PATCH(request: Request) {
  let client;

  try {
    const body = await request.json();
    const { id, status, admin_note, admin_email, admin_name } = body;

    if (!id || !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Thiếu thông tin bắt buộc',
        },
        { status: 400 }
      );
    }

    if (!['accepted', 'rejected'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Trạng thái không hợp lệ',
        },
        { status: 400 }
      );
    }

    client = await pool.connect();
    const hasChuyenSauExplanationTable = await ensureExplanationBridgeSchema(client);

    const updateExplanationQuery = `
      UPDATE explanations
      SET status = $1, admin_note = $2, admin_email = $3, admin_name = $4
      WHERE id = $5
      RETURNING *
    `;

    const updateValues = [status, admin_note, admin_email, admin_name, id];
    const updateResult = await client.query(updateExplanationQuery, updateValues);

    if (updateResult.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Không tìm thấy giải thích',
        },
        { status: 404 }
      );
    }

    const explanation = updateResult.rows[0];
    const explanationAssignmentId = Number(explanation.assignment_id || 0) || null;
    const explanationRegistrationId = Number(explanation.registration_id || 0) || null;

    const testDate = new Date(explanation.test_date);
    const month = Number.isNaN(testDate.getTime()) ? null : testDate.getMonth() + 1;
    const year = Number.isNaN(testDate.getTime()) ? null : testDate.getFullYear();

    if (month && year) {
      const scoreHandling =
        status === 'accepted'
          ? 'Khong tinh diem (da giai trinh)'
          : 'Giu diem 0 (tu choi giai trinh)';

      let scoreUpdated = false;

      if (explanationAssignmentId) {
        const directByAssignment = await client.query(
          `UPDATE chuyen_sau_results
           SET email_giai_trinh = COALESCE($2, email_giai_trinh),
               explanation_id = $4,
               xu_ly_diem = $3,
               diem = CASE WHEN $5 = 'accepted' THEN NULL ELSE COALESCE(diem, 0) END,
               updated_at = NOW()
           WHERE assignment_id = $1`,
          [explanationAssignmentId, explanation.email, scoreHandling, explanation.id, status]
        );
        scoreUpdated = (directByAssignment.rowCount ?? 0) > 0;
      }

      if (!scoreUpdated && explanationRegistrationId) {
        const directByRegistration = await client.query(
          `UPDATE chuyen_sau_results
           SET email_giai_trinh = COALESCE($2, email_giai_trinh),
               explanation_id = $4,
               xu_ly_diem = $3,
               diem = CASE WHEN $5 = 'accepted' THEN NULL ELSE COALESCE(diem, 0) END,
               updated_at = NOW()
           WHERE registration_id = $1`,
          [explanationRegistrationId, explanation.email, scoreHandling, explanation.id, status]
        );
        scoreUpdated = (directByRegistration.rowCount ?? 0) > 0;
      }

      if (!scoreUpdated) {
        await client.query(
          `WITH target AS (
             SELECT id
             FROM chuyen_sau_results
             WHERE LOWER(TRIM(ma_lms)) = LOWER(TRIM($1))
               AND LOWER(TRIM(bo_mon)) = LOWER(TRIM($2))
               AND thang_dk = $3
               AND nam_dk = $4
             ORDER BY created_at DESC
             LIMIT 1
           )
           UPDATE chuyen_sau_results
           SET email_giai_trinh = COALESCE($5, email_giai_trinh),
               explanation_id = $7,
               xu_ly_diem = $6,
               diem = CASE WHEN $8 = 'accepted' THEN NULL ELSE COALESCE(diem, 0) END,
               updated_at = NOW()
           WHERE id IN (SELECT id FROM target)`,
          [
            explanation.lms_code,
            explanation.subject,
            month,
            year,
            explanation.email,
            scoreHandling,
            explanation.id,
            status,
          ]
        );
      }
    }

    if (hasChuyenSauExplanationTable) {
      const mappedStatus = status === 'accepted' ? 'accepted' : 'rejected';

      if (explanationAssignmentId) {
        await client.query(
          `INSERT INTO chuyen_sau_giaitrinh (
             assignment_id,
             teacher_code,
             email,
             reason,
             status,
             reviewer_email,
             reviewer_note,
             reviewed_at,
             explanation_id,
             registration_id,
             updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, NOW())
           ON CONFLICT (assignment_id)
           DO UPDATE SET
             teacher_code = EXCLUDED.teacher_code,
             email = EXCLUDED.email,
             reason = EXCLUDED.reason,
             status = EXCLUDED.status,
             reviewer_email = EXCLUDED.reviewer_email,
             reviewer_note = EXCLUDED.reviewer_note,
             reviewed_at = EXCLUDED.reviewed_at,
             explanation_id = EXCLUDED.explanation_id,
             registration_id = COALESCE(EXCLUDED.registration_id, chuyen_sau_giaitrinh.registration_id),
             updated_at = NOW()`,
          [
            explanationAssignmentId,
            explanation.lms_code,
            explanation.email,
            explanation.reason,
            mappedStatus,
            admin_email,
            admin_note,
            explanation.id,
            explanationRegistrationId,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO chuyen_sau_giaitrinh (
             assignment_id,
             teacher_code,
             email,
             reason,
             status,
             reviewer_email,
             reviewer_note,
             reviewed_at,
             explanation_id,
             registration_id,
             updated_at
           )
           VALUES (NULL, $1, $2, $3, $4, $5, $6, NOW(), $7, $8, NOW())
           ON CONFLICT (explanation_id)
           DO UPDATE SET
             teacher_code = EXCLUDED.teacher_code,
             email = EXCLUDED.email,
             reason = EXCLUDED.reason,
             status = EXCLUDED.status,
             reviewer_email = EXCLUDED.reviewer_email,
             reviewer_note = EXCLUDED.reviewer_note,
             reviewed_at = EXCLUDED.reviewed_at,
             registration_id = COALESCE(EXCLUDED.registration_id, chuyen_sau_giaitrinh.registration_id),
             updated_at = NOW()`,
          [
            explanation.lms_code,
            explanation.email,
            explanation.reason,
            mappedStatus,
            admin_email,
            admin_note,
            explanation.id,
            explanationRegistrationId,
          ]
        );
      }
    }

    let emailNotSent = false;
    try {
      const emailResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/send-explanation-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: status === 'accepted' ? 'accepted' : 'rejected',
            explanation: updateResult.rows[0],
          }),
        }
      );

      const emailData = await emailResponse.json();
      if (emailData.emailNotSent) {
        emailNotSent = true;
        console.warn('Email not sent for explanation status update:', updateResult.rows[0].id);
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      emailNotSent = true;
    }

    return NextResponse.json({
      success: true,
      message: `Đã ${status === 'accepted' ? 'chấp nhận' : 'từ chối'} giải thích`,
      data: updateResult.rows[0],
      emailNotSent,
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
