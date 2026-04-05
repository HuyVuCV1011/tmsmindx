import pool from '@/lib/db';

type DbLike = {
  query: (text: string, params?: any[]) => Promise<any>;
};

let ensuredInProcess = false;
let ensurePromise: Promise<void> | null = null;

export async function ensureChuyenSauExamTables(client?: DbLike) {
  if (ensuredInProcess) return;
  if (ensurePromise) {
    await ensurePromise;
    return;
  }

  ensurePromise = (async () => {
  const db = client ?? pool;

  await db.query(`
    CREATE TABLE IF NOT EXISTS chuyen_sau_phancong (
      id BIGSERIAL PRIMARY KEY,
      registration_id BIGINT NOT NULL,
      teacher_code VARCHAR(100) NOT NULL,
      exam_type VARCHAR(30) NOT NULL,
      registration_type VARCHAR(30) NOT NULL,
      block_code VARCHAR(50) NOT NULL,
      subject_code VARCHAR(100) NOT NULL,
      selected_set_id BIGINT NOT NULL,
      random_seed VARCHAR(120),
      random_assigned_at TIMESTAMP,
      open_at TIMESTAMP NOT NULL,
      close_at TIMESTAMP NOT NULL,
      assignment_status VARCHAR(30) NOT NULL DEFAULT 'assigned',
      score NUMERIC(5,2),
      score_status VARCHAR(30) NOT NULL DEFAULT 'null',
      expired_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER TABLE chuyen_sau_bainop
      ADD COLUMN IF NOT EXISTS assignment_id BIGINT,
      ADD COLUMN IF NOT EXISTS teacher_code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS time_spent_seconds INT,
      ADD COLUMN IF NOT EXISTS raw_score NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS is_passed BOOLEAN,
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'in_progress',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);

  await db.query(`
    ALTER TABLE chuyen_sau_bainop_traloi
      ADD COLUMN IF NOT EXISTS submission_id BIGINT,
      ADD COLUMN IF NOT EXISTS question_id BIGINT,
      ADD COLUMN IF NOT EXISTS answer_text TEXT,
      ADD COLUMN IF NOT EXISTS is_correct BOOLEAN,
      ADD COLUMN IF NOT EXISTS points_earned NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_chuyen_sau_phancong_registration_id
      ON chuyen_sau_phancong(registration_id);

    CREATE INDEX IF NOT EXISTS idx_chuyen_sau_phancong_teacher_code
      ON chuyen_sau_phancong(teacher_code);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_chuyen_sau_bainop_assignment_id
      ON chuyen_sau_bainop(assignment_id)
      WHERE assignment_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_chuyen_sau_bainop_teacher_code
      ON chuyen_sau_bainop(teacher_code);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_chuyen_sau_bainop_traloi_submission_question
      ON chuyen_sau_bainop_traloi(submission_id, question_id)
      WHERE submission_id IS NOT NULL AND question_id IS NOT NULL;
  `);

  await db.query(`
    INSERT INTO chuyen_sau_phancong (
      registration_id, teacher_code, exam_type, registration_type,
      block_code, subject_code, selected_set_id, random_seed, random_assigned_at,
      open_at, close_at, assignment_status, score, score_status,
      expired_at, created_at, updated_at
    )
    SELECT
      dedup.registration_id,
      dedup.teacher_code,
      dedup.exam_type::text,
      dedup.registration_type::text,
      dedup.block_code,
      dedup.subject_code,
      dedup.selected_set_id,
      dedup.random_seed,
      dedup.random_assigned_at,
      dedup.open_at,
      dedup.close_at,
      dedup.assignment_status::text,
      dedup.score,
      dedup.score_status,
      dedup.expired_at,
      dedup.created_at,
      dedup.updated_at
    FROM (
      SELECT DISTINCT ON (t.registration_id)
        t.registration_id,
        t.teacher_code,
        t.exam_type,
        t.registration_type,
        t.block_code,
        t.subject_code,
        t.selected_set_id,
        t.random_seed,
        t.random_assigned_at,
        t.open_at,
        t.close_at,
        t.assignment_status,
        t.score,
        t.score_status,
        t.expired_at,
        t.created_at,
        t.updated_at,
        t.id
      FROM teacher_exam_assignments t
      WHERE t.registration_id IS NOT NULL
      ORDER BY t.registration_id, COALESCE(t.updated_at, t.created_at, NOW()) DESC, t.id DESC
    ) AS dedup
    ON CONFLICT (registration_id)
    DO UPDATE SET
      teacher_code = EXCLUDED.teacher_code,
      exam_type = EXCLUDED.exam_type,
      registration_type = EXCLUDED.registration_type,
      block_code = EXCLUDED.block_code,
      subject_code = EXCLUDED.subject_code,
      selected_set_id = EXCLUDED.selected_set_id,
      random_seed = EXCLUDED.random_seed,
      random_assigned_at = EXCLUDED.random_assigned_at,
      open_at = EXCLUDED.open_at,
      close_at = EXCLUDED.close_at,
      assignment_status = EXCLUDED.assignment_status,
      score = EXCLUDED.score,
      score_status = EXCLUDED.score_status,
      expired_at = EXCLUDED.expired_at,
      updated_at = NOW();
  `);

  await db.query(`
    INSERT INTO chuyen_sau_bainop (
      assignment_id, teacher_code, started_at, submitted_at,
      time_spent_seconds, raw_score, percentage, is_passed,
      status, created_at, updated_at
    )
    SELECT
      dedup.assignment_id,
      dedup.teacher_code,
      dedup.started_at,
      dedup.submitted_at,
      dedup.time_spent_seconds,
      dedup.raw_score,
      dedup.percentage,
      dedup.is_passed,
      dedup.status,
      dedup.created_at,
      dedup.updated_at
    FROM (
      SELECT DISTINCT ON (t.assignment_id)
        t.assignment_id,
        t.teacher_code,
        t.started_at,
        t.submitted_at,
        t.time_spent_seconds,
        t.raw_score,
        t.percentage,
        t.is_passed,
        t.status,
        t.created_at,
        t.updated_at
      FROM teacher_exam_submissions t
      WHERE t.assignment_id IS NOT NULL
      ORDER BY t.assignment_id, COALESCE(t.updated_at, t.created_at, NOW()) DESC, t.id DESC
    ) AS dedup
    ON CONFLICT (assignment_id)
    DO UPDATE SET
      teacher_code = EXCLUDED.teacher_code,
      started_at = COALESCE(chuyen_sau_bainop.started_at, EXCLUDED.started_at),
      submitted_at = COALESCE(EXCLUDED.submitted_at, chuyen_sau_bainop.submitted_at),
      time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, chuyen_sau_bainop.time_spent_seconds),
      raw_score = COALESCE(EXCLUDED.raw_score, chuyen_sau_bainop.raw_score),
      percentage = COALESCE(EXCLUDED.percentage, chuyen_sau_bainop.percentage),
      is_passed = COALESCE(EXCLUDED.is_passed, chuyen_sau_bainop.is_passed),
      status = COALESCE(EXCLUDED.status, chuyen_sau_bainop.status),
      updated_at = NOW();
  `);

  await db.query(`
    INSERT INTO chuyen_sau_bainop_traloi (
      id, submission_id, question_id, answer_text,
      is_correct, points_earned, answered_at
    )
    SELECT
      t.id,
      t.submission_id,
      t.question_id,
      t.answer_text,
      t.is_correct,
      t.points_earned,
      t.answered_at
    FROM teacher_exam_answers t
    ON CONFLICT (id) DO NOTHING;
  `);

  await db.query(`
    SELECT setval(
      pg_get_serial_sequence('chuyen_sau_phancong', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 0) FROM chuyen_sau_phancong), 1),
      true
    )
    WHERE pg_get_serial_sequence('chuyen_sau_phancong', 'id') IS NOT NULL;

    SELECT setval(
      pg_get_serial_sequence('chuyen_sau_bainop', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 0) FROM chuyen_sau_bainop), 1),
      true
    )
    WHERE pg_get_serial_sequence('chuyen_sau_bainop', 'id') IS NOT NULL;

    SELECT setval(
      pg_get_serial_sequence('chuyen_sau_bainop_traloi', 'id'),
      GREATEST((SELECT COALESCE(MAX(id), 0) FROM chuyen_sau_bainop_traloi), 1),
      true
    )
    WHERE pg_get_serial_sequence('chuyen_sau_bainop_traloi', 'id') IS NOT NULL;
  `);
  })();

  try {
    await ensurePromise;
    ensuredInProcess = true;
  } finally {
    ensurePromise = null;
  }
}
