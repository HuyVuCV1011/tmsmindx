import { withApiProtection } from "@/lib/api-protection";
import { checkTeacherExistsByEmail } from "@/lib/db-helpers";
import { NextRequest, NextResponse } from "next/server";

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const email = String(request.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, error: "email là bắt buộc" }, { status: 400 });
    }

    const exists = await checkTeacherExistsByEmail(email);
    return NextResponse.json({ success: true, exists });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không thể kiểm tra teachers";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
