import pool from '@/lib/db';
import { isDatabaseUnavailableError, isDegradedDatabaseQueryError } from '@/lib/db-unavailable';

export { isDatabaseUnavailableError, isDegradedDatabaseQueryError };

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
