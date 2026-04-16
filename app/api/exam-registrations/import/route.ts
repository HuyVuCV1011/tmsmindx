import { insertExamRegistration } from "@/lib/exam-registration-insert";
import {
  normalizeImportRow,
  rowToRegistrationPayload,
} from "@/lib/csv-registration-import";
import pool from "@/lib/db";
import { NextResponse } from "next/server";

type RowResult =
  | { line: number; ok: true; id: unknown }
  | { line: number; ok: false; error: string; result_id?: number };

/**
 * POST JSON: { rows: Record<string, string>[] } — mỗi row giống body POST /api/exam-registrations (sau khi map header CSV).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawRows = body?.rows;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Cần mảng rows (ít nhất 1 dòng)." },
        { status: 400 }
      );
    }

    const results: RowResult[] = [];
    let imported = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const line = i + 2;
      const row = rawRows[i];
      if (!row || typeof row !== "object") {
        results.push({ line, ok: false, error: "Dòng không hợp lệ" });
        continue;
      }
      const normalized = normalizeImportRow(row as Record<string, string>);
      const payload = rowToRegistrationPayload(normalized);
      if (!payload.ma_giao_vien && !payload.teacher_code) {
        results.push({ line, ok: false, error: "Thiếu Mã GV (ma_giao_vien)" });
        continue;
      }

      const res = await insertExamRegistration(pool, payload);
      if (res.ok) {
        imported++;
        results.push({ line, ok: true, id: res.data.id });
      } else {
        results.push({
          line,
          ok: false,
          error: res.error,
          ...(res.result_id != null ? { result_id: res.result_id } : {}),
        });
      }
    }

    const failed = results.filter((r) => !r.ok);
    return NextResponse.json({
      success: true,
      imported,
      total: rawRows.length,
      failedCount: failed.length,
      results,
    });
  } catch (e) {
    console.error("exam-registrations/import:", e);
    return NextResponse.json({ success: false, error: "Không xử lý được yêu cầu import" }, { status: 400 });
  }
}
