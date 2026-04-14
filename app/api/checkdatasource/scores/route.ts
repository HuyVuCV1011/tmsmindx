import { withApiProtection } from "@/lib/api-protection";
import pool from "@/lib/db";
import { loadTeacherScoresOnly } from "@/lib/teacher-profile-bundle";
import { NextRequest, NextResponse } from "next/server";

/** Chỉ tải chuyên sâu + trải nghiệm (tách khỏi bundle profile nhanh). */
export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const code = String(request.nextUrl.searchParams.get("code") || "").trim();
    if (!code) {
      return NextResponse.json(
        { success: false, error: "Thiếu mã giáo viên (code)" },
        { status: 400 }
      );
    }
    const { expertise, experience } = await loadTeacherScoresOnly(pool, code);
    return NextResponse.json({ success: true, expertise, experience });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không thể tải điểm";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
