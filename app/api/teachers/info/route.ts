import { withApiProtection } from "@/lib/api-protection";
import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy quoted columns duplicate snake_case fields from the same row (confirm route writes both).
 * Spreading onboarding_snapshot also duplicates sheet keys ("Full Name", …) vs DB columns — drop both.
 */
const LEGACY_QUOTED_KEYS_SUPERSEDED_BY_SNAKE_CASE = new Set([
  "Full name",
  "User name",
  "Work email",
  "Main centre",
  "Status",
  "Course Line",
]);

function mergeTeacherRow(row: Record<string, unknown>): Record<string, unknown> {
  const { onboarding_snapshot: _removed, ...rest } = row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (LEGACY_QUOTED_KEYS_SUPERSEDED_BY_SNAKE_CASE.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const code = String(request.nextUrl.searchParams.get("code") || "").trim();
    const email = String(request.nextUrl.searchParams.get("email") || "").trim().toLowerCase();

    if (!code && !email) {
      return NextResponse.json(
        { success: false, error: "Vui lòng truyền code hoặc email" },
        { status: 400 }
      );
    }

    const conditions: string[] = [];
    const params: string[] = [];

    if (code) {
      params.push(code);
      conditions.push(`LOWER(TRIM(code)) = LOWER(TRIM($${params.length}))`);
    }

    if (email) {
      params.push(email);
      conditions.push(`
        LOWER(TRIM(work_email)) = LOWER(TRIM($${params.length}))
        OR LOWER(TRIM("Work email")) = LOWER(TRIM($${params.length}))
      `);
    }

    const result = await pool.query(
      `
        SELECT *
        FROM teachers
        WHERE ${conditions.join(" OR ")}
        LIMIT 1
      `,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy giáo viên trong bảng teachers" },
        { status: 404 }
      );
    }

    const teacher = mergeTeacherRow(result.rows[0] as Record<string, unknown>);

    return NextResponse.json({ success: true, teacher });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không thể lấy thông tin giáo viên";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
