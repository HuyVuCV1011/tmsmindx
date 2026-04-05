import { ensureChuyenSauExamTables } from '@/lib/chuyen-sau-exam-schema';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

async function resolveAssignmentId(inputAssignmentId: number): Promise<number> {
  if (!Number.isFinite(inputAssignmentId) || inputAssignmentId <= 0) {
    return 0;
  }

  const directRes = await pool.query(
    `SELECT id
     FROM chuyen_sau_phancong
     WHERE id = $1
     LIMIT 1`,
    [inputAssignmentId]
  );

  if (directRes.rowCount) {
    return inputAssignmentId;
  }

  const byRegistrationDirectRes = await pool.query(
    `SELECT cp.id
     FROM chuyen_sau_phancong cp
     WHERE cp.registration_id = $1
     ORDER BY cp.updated_at DESC, cp.created_at DESC
     LIMIT 1`,
    [inputAssignmentId]
  );

  if (byRegistrationDirectRes.rowCount) {
    return Number(byRegistrationDirectRes.rows[0]?.id || 0);
  }

  const legacyRes = await pool.query(
    `SELECT assignment_id, registration_id
     FROM chuyen_sau_results
     WHERE id = $1
     LIMIT 1`,
    [inputAssignmentId]
  );

  const mappedAssignmentId = Number(legacyRes.rows[0]?.assignment_id || 0);
  if (mappedAssignmentId > 0) {
    return mappedAssignmentId;
  }

  const mappedByRegistrationRes = await pool.query(
    `SELECT cp.id
     FROM chuyen_sau_phancong cp
     WHERE cp.registration_id = $1
     ORDER BY cp.updated_at DESC, cp.created_at DESC
     LIMIT 1`,
    [legacyRes.rows[0]?.registration_id || null]
  );

  return Number(mappedByRegistrationRes.rows[0]?.id || 0);
}

export async function POST(request: NextRequest) {
  try {
    await ensureChuyenSauExamTables();

    const body = await request.json();
    const { assignment_id, teacher_code } = body;
    const resolvedAssignmentId = await resolveAssignmentId(Number(assignment_id));

    if (!resolvedAssignmentId || !teacher_code) {
      return NextResponse.json(
        { success: false, error: 'assignment_id and teacher_code are required' },
        { status: 400 }
      );
    }

    const assignmentQuery = `
      SELECT tea.id, tea.teacher_code, tea.registration_id, tea.open_at, tea.close_at, tea.assignment_status,
             es.status AS set_status, es.valid_from, es.valid_to
      FROM chuyen_sau_phancong tea
      JOIN chuyen_sau_bode es ON es.id = tea.selected_set_id
      WHERE tea.id = $1
      LIMIT 1
    `;
    const assignmentResult = await pool.query(assignmentQuery, [resolvedAssignmentId]);

    if (!assignmentResult.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const assignment = assignmentResult.rows[0];
    if (String(assignment.teacher_code).toLowerCase() !== String(teacher_code).toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized assignment access' },
        { status: 403 }
      );
    }

    const now = new Date();
    if (now < new Date(assignment.open_at)) {
      return NextResponse.json(
        { success: false, error: 'Exam is not open yet' },
        { status: 400 }
      );
    }

    if (now > new Date(assignment.close_at) || assignment.assignment_status === 'expired') {
      return NextResponse.json(
        { success: false, error: 'Exam time is over' },
        { status: 400 }
      );
    }

    const validFrom = assignment.valid_from ? new Date(assignment.valid_from) : null;
    const validTo = assignment.valid_to ? new Date(assignment.valid_to) : null;
    const isWithinSetWindow = (!validFrom || now >= validFrom) && (!validTo || now <= validTo);
    const isSetActiveNow = assignment.set_status === 'active' && isWithinSetWindow;

    if (!isSetActiveNow) {
      return NextResponse.json(
        { success: false, error: 'Bộ đề hiện không active trong thời gian lịch cho phép' },
        { status: 403 }
      );
    }

    const daThiResult = await pool.query(
      `SELECT id
       FROM chuyen_sau_results
       WHERE assignment_id = $1
         AND LOWER(TRIM(COALESCE(xu_ly_diem, ''))) = 'da thi'
       LIMIT 1`,
      [resolvedAssignmentId]
    );

    if (daThiResult.rowCount) {
      return NextResponse.json(
        { success: false, error: 'Bài thi này đã ở trạng thái Da thi, không thể làm lại.' },
        { status: 409 }
      );
    }

    const existingSubmissionResult = await pool.query(
      `SELECT id, status, submitted_at
       FROM chuyen_sau_bainop
       WHERE assignment_id = $1
       LIMIT 1`,
      [resolvedAssignmentId]
    );

    const existingSubmission = existingSubmissionResult.rows[0];
    const existingStatus = String(existingSubmission?.status || '').toLowerCase();
    const alreadyFinalized =
      Boolean(existingSubmission?.submitted_at) ||
      existingStatus === 'submitted' ||
      existingStatus === 'graded' ||
      String(assignment.assignment_status || '').toLowerCase() === 'submitted' ||
      String(assignment.assignment_status || '').toLowerCase() === 'graded';

    if (alreadyFinalized) {
      return NextResponse.json(
        { success: false, error: 'Bài thi này đã nộp. Mỗi khung đăng ký chỉ được làm 1 lần.' },
        { status: 409 }
      );
    }

    const upsertSubmissionQuery = `
      INSERT INTO chuyen_sau_bainop (
        assignment_id,
        teacher_code,
        started_at,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, NOW(), 'in_progress', NOW(), NOW())
      ON CONFLICT (assignment_id)
      DO UPDATE SET
        teacher_code = COALESCE(chuyen_sau_bainop.teacher_code, EXCLUDED.teacher_code),
        started_at = COALESCE(chuyen_sau_bainop.started_at, EXCLUDED.started_at),
        status = CASE
          WHEN chuyen_sau_bainop.status = 'graded' THEN chuyen_sau_bainop.status
          ELSE 'in_progress'
        END,
        updated_at = NOW()
      RETURNING *
    `;

    const insertResult = await pool.query(upsertSubmissionQuery, [resolvedAssignmentId, teacher_code]);

    await pool.query(
      `UPDATE chuyen_sau_phancong
       SET assignment_status = CASE
         WHEN assignment_status = 'assigned' THEN 'in_progress'
         ELSE assignment_status
       END,
       updated_at = NOW()
       WHERE id = $1`,
      [resolvedAssignmentId]
    );

    return NextResponse.json({
      success: true,
      data: insertResult.rows[0],
    });
  } catch (error: any) {
    console.error('Error creating exam submission:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create exam submission' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  let client: any = null;
  try {
    client = await pool.connect();
    await ensureChuyenSauExamTables(client);

    const body = await request.json();
    const {
      assignment_id,
      teacher_code,
      answers, // array of { question_id, answer_text }
    } = body;
    const resolvedAssignmentId = await resolveAssignmentId(Number(assignment_id));
    if (!Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, error: 'answers phải là mảng hợp lệ' },
        { status: 400 }
      );
    }


    if (!resolvedAssignmentId || !teacher_code) {
      return NextResponse.json(
        { success: false, error: 'assignment_id and teacher_code are required' },
        { status: 400 }
      );
    }

    // Verify the assignment belongs to this teacher and is still valid
    const assignmentResult = await client.query(
      `SELECT tea.id, tea.selected_set_id, tea.subject_code, tea.open_at, tea.close_at, tea.assignment_status,
              es.total_points, es.passing_score
      FROM chuyen_sau_phancong tea
       JOIN chuyen_sau_bode es ON es.id = tea.selected_set_id
       WHERE tea.id = $1 AND LOWER(TRIM(tea.teacher_code)) = LOWER(TRIM($2))
       LIMIT 1`,
      [resolvedAssignmentId, teacher_code]
    );

    if (!assignmentResult.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found or unauthorized' },
        { status: 404 }
      );
    }

    const assignment = assignmentResult.rows[0];

    const normalizedAssignmentStatus = String(assignment.assignment_status || '').toLowerCase();
    if (normalizedAssignmentStatus === 'submitted' || normalizedAssignmentStatus === 'graded') {
      return NextResponse.json(
        { success: false, error: 'Bài thi này đã nộp. Mỗi khung đăng ký chỉ được làm 1 lần.' },
        { status: 409 }
      );
    }

    const daThiResult = await client.query(
      `SELECT id
       FROM chuyen_sau_results
       WHERE assignment_id = $1
         AND LOWER(TRIM(COALESCE(xu_ly_diem, ''))) = 'da thi'
       LIMIT 1`,
      [resolvedAssignmentId]
    );

    if (daThiResult.rowCount) {
      return NextResponse.json(
        { success: false, error: 'Bài thi này đã ở trạng thái Da thi, không thể nộp lại.' },
        { status: 409 }
      );
    }

    let submissionResult = await client.query(
      `SELECT id, started_at, status, submitted_at FROM chuyen_sau_bainop
       WHERE assignment_id = $1 LIMIT 1`,
      [resolvedAssignmentId]
    );

    const existingSubmission = submissionResult.rows[0];
    const existingStatus = String(existingSubmission?.status || '').toLowerCase();
    const alreadyFinalized =
      Boolean(existingSubmission?.submitted_at) ||
      existingStatus === 'submitted' ||
      existingStatus === 'graded';

    if (alreadyFinalized) {
      return NextResponse.json(
        { success: false, error: 'Bài thi này đã nộp. Mỗi khung đăng ký chỉ được làm 1 lần.' },
        { status: 409 }
      );
    }

    // Recover gracefully when start API was skipped/failed and user submits directly.
    if (!submissionResult.rows.length) {
      const createdSubmission = await client.query(
        `INSERT INTO chuyen_sau_bainop (
           assignment_id,
           teacher_code,
           started_at,
           status,
           created_at,
           updated_at
         )
         VALUES ($1, $2, NOW(), 'in_progress', NOW(), NOW())
         ON CONFLICT (assignment_id)
         DO UPDATE SET
           teacher_code = COALESCE(chuyen_sau_bainop.teacher_code, EXCLUDED.teacher_code),
           updated_at = NOW()
         RETURNING id, started_at, status, submitted_at`,
        [resolvedAssignmentId, teacher_code]
      );

      submissionResult = createdSubmission;

      await client.query(
        `UPDATE chuyen_sau_phancong
         SET assignment_status = CASE
           WHEN assignment_status = 'assigned' THEN 'in_progress'
           ELSE assignment_status
         END,
         updated_at = NOW()
         WHERE id = $1`,
        [resolvedAssignmentId]
      );
    }

    const submission = submissionResult.rows[0];
    const now = new Date();
    const startedAt = submission.started_at ? new Date(submission.started_at) : now;
    const timeSpentSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));

    // Fetch all questions for the set to grade server-side
    const questionsResult = await client.query(
      `SELECT
         q.id,
         q.question_type,
         q.correct_answer,
         q.option_a,
         q.option_b,
         q.option_c,
         q.option_d,
         COALESCE(map.points_override, q.points) AS points
       FROM chuyen_sau_bode_cauhoi map
       JOIN chuyen_sau_cauhoi q ON q.id = map.question_id
       WHERE map.set_id = $1`,
      [assignment.selected_set_id]
    );
    const questionMap = new Map<number, any>();
    for (const q of questionsResult.rows as any[]) {
      const questionId = Number(q.id);
      if (!Number.isFinite(questionId)) continue;
      questionMap.set(questionId, q);
    }

    let totalRawScore = 0;
    let maxRawScore = 0;
    const answersToInsert: Array<{ question_id: number; answer_text: string; is_correct: boolean; points_earned: number }> = [];

    for (const q of questionsResult.rows) {
      maxRawScore += Number(q.points || 0);
    }

    // Normalize rich text answer content (text + image src) for stable server-side grading.
    const normalizeForGrading = (value: string): string => {
      if (!value) return '';
      let text = String(value);
      // Decode HTML entities (handles &lt; &gt; &amp; &quot; &nbsp; etc.)
      text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

      // Keep image identity for image-only options.
      const imageTokens = Array.from(text.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi))
        .map((match) => String(match[1] || '').trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join('|');

      // Strip any remaining HTML tags
      text = text.replace(/<[^>]*>/g, ' ');
      // Collapse whitespace
      text = text.replace(/\s+/g, ' ').trim().toLowerCase();

      return [text, imageTokens].filter(Boolean).join('||');
    };

    const normalizeChoiceKey = (value: string): string => {
      const normalized = normalizeForGrading(value)
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return normalized;
    };

    const resolveChoiceAnswer = (rawAnswer: string, question: any): string => {
      const normalized = normalizeChoiceKey(rawAnswer);
      const firstToken = normalized.split(' ')[0];

      const optionMap: Record<string, string> = {
        a: String(question.option_a || ''),
        b: String(question.option_b || ''),
        c: String(question.option_c || ''),
        d: String(question.option_d || ''),
      };

      if (Object.prototype.hasOwnProperty.call(optionMap, firstToken)) {
        return normalizeForGrading(optionMap[firstToken]);
      }

      return normalizeForGrading(rawAnswer);
    };

    for (const ans of answers) {
      const answerQuestionId = Number(ans.question_id);
      if (!Number.isFinite(answerQuestionId)) continue;

      const q = questionMap.get(answerQuestionId);
      if (!q) continue;

      const resolvedCorrectAnswer = resolveChoiceAnswer(String(q.correct_answer || ''), q);
      const resolvedUserAnswer = resolveChoiceAnswer(String(ans.answer_text || ''), q);
      const isCorrect = resolvedCorrectAnswer !== '' && resolvedUserAnswer === resolvedCorrectAnswer;
      const pointsEarned = isCorrect ? parseFloat(q.points) : 0;

      totalRawScore += pointsEarned;
      answersToInsert.push({
        question_id: answerQuestionId,
        answer_text: ans.answer_text || '',
        is_correct: isCorrect,
        points_earned: pointsEarned,
      });
    }

    const normalizedTotalPoints = 10;
    const passingScore = Math.min(10, Math.max(0, Number(assignment.passing_score || 7)));
    const scaledScore = maxRawScore > 0
      ? Number(((totalRawScore * normalizedTotalPoints) / maxRawScore).toFixed(2))
      : 0;
    const percentage = Math.min(100, Number(((scaledScore / normalizedTotalPoints) * 100).toFixed(2)));
    const isPassed = scaledScore >= passingScore;

    await client.query('BEGIN');

    // Upsert answers
    for (const ans of answersToInsert) {
      await client.query(
        `INSERT INTO chuyen_sau_bainop_traloi (submission_id, question_id, answer_text, is_correct, points_earned)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (submission_id, question_id)
         DO UPDATE SET answer_text = EXCLUDED.answer_text, is_correct = EXCLUDED.is_correct, points_earned = EXCLUDED.points_earned`,
        [submission.id, ans.question_id, ans.answer_text, ans.is_correct, ans.points_earned]
      );
    }

    const updatedSubmission = await client.query(
        `UPDATE chuyen_sau_bainop
       SET submitted_at = NOW(), time_spent_seconds = $1, raw_score = $2,
           percentage = $3, is_passed = $4, status = 'graded', updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [timeSpentSeconds, scaledScore, percentage.toFixed(2), isPassed, submission.id]
    );

    await client.query(
      `UPDATE chuyen_sau_phancong
       SET assignment_status = 'graded', score = $1, score_status = 'graded', updated_at = NOW()
       WHERE id = $2`,
      [scaledScore, resolvedAssignmentId]
    );

    // Sync score into chuyen_sau_results (expertise scoreboard)
    const vnDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(assignment.open_at));
    const [vnYear, vnMonth] = vnDate.split('-').map(Number);
    const correctCount = answersToInsert.filter((answer) => answer.is_correct).length;

    const scoreHandling = scaledScore <= 0 ? 'Diem 0 - cho giai trinh' : 'Da thi';

    const directScoreSync = await client.query(
      `WITH target AS (
         SELECT csr.id
         FROM chuyen_sau_results csr
         WHERE csr.assignment_id = $1
            OR csr.registration_id = (
              SELECT registration_id
              FROM chuyen_sau_phancong
              WHERE id = $1
              LIMIT 1
            )
         ORDER BY
           CASE WHEN csr.assignment_id = $1 THEN 0 ELSE 1 END,
           csr.created_at DESC
         LIMIT 1
       )
       UPDATE chuyen_sau_results csr
       SET assignment_id = $1,
           registration_id = COALESCE(
             csr.registration_id,
             (SELECT registration_id FROM chuyen_sau_phancong WHERE id = $1 LIMIT 1)
           ),
           cau_dung = $2,
           diem = $3,
           xu_ly_diem = $4,
           updated_at = NOW()
       WHERE csr.id IN (SELECT id FROM target)` ,
        [resolvedAssignmentId, correctCount, scaledScore, scoreHandling]
    );

    if (!directScoreSync.rowCount) {
      const fallbackScoreSync = await client.query(
        `WITH target AS (
           SELECT csr.id
           FROM chuyen_sau_results csr
           WHERE LOWER(TRIM(csr.ma_lms)) = LOWER(TRIM($1))
             AND LOWER(TRIM(csr.bo_mon)) = LOWER(TRIM($2))
             AND csr.nam_dk = $3
             AND csr.thang_dk = $4
             AND (csr.de IS NULL OR csr.de = $5)
           ORDER BY csr.created_at DESC
           LIMIT 1
         )
         UPDATE chuyen_sau_results csr
         SET assignment_id = $6,
             registration_id = COALESCE(
               csr.registration_id,
               (SELECT registration_id FROM chuyen_sau_phancong WHERE id = $6 LIMIT 1)
             ),
             cau_dung = $7,
             diem = $8,
             xu_ly_diem = $9,
             updated_at = NOW()
         WHERE csr.id IN (SELECT id FROM target)`,
        [
          teacher_code,
          assignment.subject_code,
          vnYear,
          vnMonth,
          String(assignment.selected_set_id),
          resolvedAssignmentId,
          correctCount,
          scaledScore,
          scoreHandling,
        ]
      );

      // If no row can be matched, create one so score sync is never dropped.
      if (!fallbackScoreSync.rowCount) {
        const registrationRes = await client.query(
          `SELECT tea.registration_id, tea.open_at, tea.registration_type, tea.subject_code,
                  csd.teacher_name, csd.email, csd.campus
           FROM chuyen_sau_phancong tea
           LEFT JOIN chuyen_sau_dangky csd ON csd.id = tea.registration_id
           WHERE tea.id = $1
           LIMIT 1`,
          [resolvedAssignmentId]
        );

        const reg = registrationRes.rows[0] || {};
        const openAt = reg.open_at ? new Date(reg.open_at) : new Date();
        const vnOpenDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(openAt);
        const [openYear, openMonth] = vnOpenDate.split('-').map(Number);

        await client.query(
          `INSERT INTO chuyen_sau_results (
             registration_id,
             assignment_id,
             ho_va_ten,
             dia_chi_email,
             bo_mon,
             co_so,
             ma_lms,
             hinh_thuc,
             thang_dk,
             nam_dk,
             thoi_gian_kiem_tra,
             de,
             cau_dung,
             diem,
             xu_ly_diem,
             created_at,
             updated_at
           )
           VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8,
             $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
           )`,
          [
            reg.registration_id || null,
            resolvedAssignmentId,
            reg.teacher_name || teacher_code,
            reg.email || null,
            reg.subject_code || assignment.subject_code,
            reg.campus || null,
            teacher_code,
            reg.registration_type === 'additional' ? 'Bo sung' : 'Chinh thuc',
            Number.isFinite(openMonth) ? openMonth : vnMonth,
            Number.isFinite(openYear) ? openYear : vnYear,
            openAt,
            String(assignment.selected_set_id),
            correctCount,
            scaledScore,
            scoreHandling,
          ]
        );
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: {
        ...updatedSubmission.rows[0],
        calculated_score: scaledScore,
        raw_score: Number(totalRawScore.toFixed(2)),
        max_raw_score: Number(maxRawScore.toFixed(2)),
        total_points: normalizedTotalPoints,
        percentage: parseFloat(percentage.toFixed(2)),
        is_passed: isPassed,
      },
    });
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('Error submitting exam:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit exam' },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
