import { withApiProtection } from "@/lib/api-protection";
import { checkTeacherExistsByEmail } from "@/lib/db-helpers";
import pool from "@/lib/db";
import { loadTeacherProfileBundle } from "@/lib/teacher-profile-bundle";
import { NextRequest, NextResponse } from "next/server";

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = String(searchParams.get("email") || "")
      .trim()
      .toLowerCase();
    const code = String(searchParams.get("code") || "").trim();
    const brief = searchParams.get("brief") === "1";

    if (brief) {
      if (!email) {
        return NextResponse.json(
          { success: false, error: "email là bắt buộc khi brief=1" },
          { status: 400 }
        );
      }
      const exists = await checkTeacherExistsByEmail(email);
      return NextResponse.json({ success: true, exists });
    }

    if (!email && !code) {
      return NextResponse.json(
        { success: false, error: "Cần email hoặc code" },
        { status: 400 }
      );
    }

    const bundle = await loadTeacherProfileBundle(pool, email ? { email } : { code });

    return NextResponse.json({
      success: true,
      exists: bundle.exists,
      teacher: bundle.teacher,
      expertise: bundle.expertise,
      experience: bundle.experience,
      certificates: bundle.certificates,
      training: bundle.training,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không thể tải dữ liệu";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
