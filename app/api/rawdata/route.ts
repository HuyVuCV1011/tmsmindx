import {
  rejectIfDatasourceLookupForbidden,
  requireBearerSession,
} from "@/lib/datasource-api-auth";
import { NextRequest, NextResponse } from "next/server";
import { withApiProtection } from "@/lib/api-protection";
import pool from "@/lib/db";

interface TestRecord {
  area: string;
  name: string;
  email: string;
  subject: string;
  branch: string;
  code: string;
  type: string;
  month: string;
  year: string;
  batch: string;
  time: string;
  exam: string;
  correct: string;
  score: string;
  emailExplanation: string;
  processing: string;
  date: string;
  isCountedInAverage: boolean;
}

interface MonthlyAverage {
  month: string;
  average: number;
  count: number;
  records: TestRecord[];
}

export const GET = withApiProtection(async (request: NextRequest) => {
  const auth = await requireBearerSession(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Mã giáo viên là bắt buộc" }, { status: 400 });
  }

  const denied = await rejectIfDatasourceLookupForbidden(
    auth.sessionEmail,
    auth.privileged,
    "",
    code,
  );
  if (denied) return denied;

  const client = await pool.connect();
  try {
    // Lấy kết quả thi từ DB, kèm thông tin môn học và trạng thái giải trình
    const result = await client.query(
      `SELECT
         r.khu_vuc            AS area,
         r.ho_ten             AS name,
         r.dia_chi_email      AS email,
         COALESCE(mh.ten_mon, mh.ma_mon, r.id_mon::text, '') AS subject,
         r.co_so_lam_viec     AS branch,
         r.ma_giao_vien       AS code,
         r.hinh_thuc          AS type,
         r.thang_dk           AS month,
         r.nam_dk             AS year,
         r.dot                AS batch,
         r.thoi_gian_kiem_tra AS time,
         r.cau_dung           AS correct,
         r.diem               AS score,
         r.email_giai_trinh   AS email_explanation,
         r.xu_ly_diem         AS processing,
         EXISTS (
           SELECT 1 FROM chuyen_sau_giaitrinh g
           WHERE g.id_ket_qua = r.id
             AND g.xu_ly_giai_trinh = 'đã duyệt'
           LIMIT 1
         ) AS has_accepted_explanation
       FROM chuyen_sau_results r
       LEFT JOIN chuyen_sau_monhoc mh ON mh.id = r.id_mon
       WHERE LOWER(TRIM(COALESCE(r.ma_giao_vien, ''))) = LOWER(TRIM($1))
         AND r.thang_dk IS NOT NULL
         AND r.nam_dk   IS NOT NULL
       ORDER BY r.nam_dk DESC, r.thang_dk DESC`,
      [code]
    );

    const records: TestRecord[] = result.rows.map((row) => {
      const score = parseFloat(String(row.score ?? "0")) || 0;
      const didNotSubmit = row.processing !== "đã hoàn thành";
      // Loại trừ khỏi trung bình: user không nộp bài VÀ có giải trình được duyệt
      const isCountedInAverage = !(didNotSubmit && row.has_accepted_explanation);
      const dateStr = `${row.month}/${row.year}`;

      return {
        area:             row.area || "",
        name:             row.name || "",
        email:            row.email || "",
        subject:          row.subject || "",
        branch:           row.branch || "",
        code:             row.code || "",
        type:             row.type || "",
        month:            String(row.month || ""),
        year:             String(row.year || ""),
        batch:            row.batch || "",
        time:             row.time || "",
        exam:             "",
        correct:          String(row.correct ?? "0"),
        score:            String(score),
        emailExplanation: row.email_explanation || "",
        processing:       row.processing || "",
        date:             dateStr,
        isCountedInAverage,
      };
    });

    // Nhóm theo tháng/năm và tính trung bình
    const monthlyMap = new Map<string, TestRecord[]>();
    records.forEach((record) => {
      if (!monthlyMap.has(record.date)) {
        monthlyMap.set(record.date, []);
      }
      monthlyMap.get(record.date)!.push(record);
    });

    const monthlyData: MonthlyAverage[] = [];
    monthlyMap.forEach((monthRecords, month) => {
      const countedRecords = monthRecords.filter((r) => r.isCountedInAverage);
      if (countedRecords.length > 0) {
        const sum = countedRecords.reduce((acc, r) => acc + parseFloat(r.score), 0);
        const average = sum / countedRecords.length;
        monthlyData.push({ month, average, count: countedRecords.length, records: monthRecords });
      } else {
        monthlyData.push({ month, average: 0, count: 0, records: monthRecords });
      }
    });

    monthlyData.sort((a, b) => {
      const [monthA, yearA] = a.month.split("/").map(Number);
      const [monthB, yearB] = b.month.split("/").map(Number);
      if (yearA !== yearB) return yearB - yearA;
      return monthB - monthA;
    });

    return NextResponse.json({
      records,
      monthlyData,
      totalRecords: records.length,
      teacherCode: code,
    });
  } catch (error) {
    console.error("Error fetching rawdata from DB:", error);
    return NextResponse.json(
      { error: "Lỗi khi lấy dữ liệu" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
});
