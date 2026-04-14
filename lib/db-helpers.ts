import pool from '@/lib/db';

/**
 * True when Postgres/Node indicates the database is unreachable.
 * Shared across all API routes so the check is consistent.
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const code = err?.code;
  const msg = String(err?.message || '').toLowerCase();

  if (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'ENETUNREACH' ||
    code === 'EAI_AGAIN' ||
    code === '08001' ||
    code === '08006' ||
    code === '08003' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    code === '28000'
  ) {
    return true;
  }
  return (
    msg.includes('connection terminated') ||
    msg.includes('connection closed') ||
    msg.includes('no pg_hba.conf entry') ||
    msg.includes('server closed the connection')
  );
}

/**
 * Check whether a teacher record exists in the `teachers` table by work email.
 * Returns `false` (instead of throwing) when the table doesn't exist yet or
 * the database is temporarily unreachable, so callers can degrade gracefully.
 */
export async function checkTeacherExistsByEmail(email: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM teachers
       WHERE LOWER(TRIM(work_email)) = LOWER(TRIM($1))
          OR LOWER(TRIM("Work email")) = LOWER(TRIM($1))
       LIMIT 1`,
      [email]
    );
    return result.rows.length > 0;
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === '42P01') {
      console.warn('teachers table does not exist yet');
      return false;
    }
    if (isDatabaseUnavailableError(error)) {
      console.warn('DB unavailable during teacher check');
      return false;
    }
    throw error;
  }
}
