import type { Pool } from "pg";

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export type InsertRegistrationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; httpStatus: number; result_id?: number };

/**
 * Tạo một bản ghi đăng ký kiểm tra (INSERT chuyen_sau_results) — dùng chung cho POST /api/exam-registrations và import CSV.
 */
export async function insertExamRegistration(
  pool: Pool,
  body: Record<string, unknown>
): Promise<InsertRegistrationResult> {
  const teacherInfo = (body.teacher_info as Record<string, unknown>) || {};
  const ma_giao_vien = body.ma_giao_vien || body.teacher_code;
  const ho_ten = body.ho_ten || body.full_name || teacherInfo.teacher_name || teacherInfo.full_name;
  const dia_chi_email = body.dia_chi_email || body.email || teacherInfo.email;
  const co_so_lam_viec = body.co_so_lam_viec || body.campus || teacherInfo.campus;
  const khu_vuc = body.khu_vuc || body.region || teacherInfo.region;
  const hinh_thuc = body.hinh_thuc || body.registration_type;
  const khoi_giang_day = body.khoi_giang_day || body.block_code;
  const dotResolved = num(body.dot);
  const id_mon = body.id_mon || body.subject_id;
  const ma_mon = body.ma_mon || body.subject_code;
  const id_su_kien = body.id_su_kien || body.schedule_id || body.scheduled_event_id || null;
  const id_de_thi = body.id_de_thi;

  let thang_dk = num(body.thang_dk ?? body.month);
  let nam_dk = num(body.nam_dk ?? body.year);
  if ((!thang_dk || !nam_dk) && (body.open_at || body.scheduled_at)) {
    const refDate = new Date(String(body.open_at || body.scheduled_at));
    if (!Number.isNaN(refDate.getTime())) {
      thang_dk = thang_dk || refDate.getMonth() + 1;
      nam_dk = nam_dk || refDate.getFullYear();
    }
  }

  if (!ma_giao_vien || String(ma_giao_vien).trim() === "") {
    return { ok: false, error: "ma_giao_vien là bắt buộc", httpStatus: 400 };
  }
  if (!id_mon && !ma_mon) {
    return { ok: false, error: "Cần cung cấp id_mon hoặc ma_mon", httpStatus: 400 };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let resolvedHoTen = ho_ten;
    if (!resolvedHoTen) {
      const teacherRow = await client.query(
        `SELECT full_name FROM teachers WHERE LOWER(TRIM(code)) = LOWER(TRIM($1)) LIMIT 1`,
        [ma_giao_vien]
      );
      resolvedHoTen = teacherRow.rows[0]?.full_name || ma_giao_vien;
    }

    let resolvedSubjectId = id_mon;
    if (!resolvedSubjectId && ma_mon) {
      const subj = await client.query(
        `SELECT id FROM chuyen_sau_monhoc
         WHERE ma_mon = $1
            OR $1 LIKE (ma_mon || '%')
            OR ma_mon LIKE ($1 || '%')
         ORDER BY
           CASE WHEN ma_mon = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [ma_mon]
      );
      if (subj.rows.length === 0) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Không tìm thấy môn học tương ứng", httpStatus: 404 };
      }
      resolvedSubjectId = subj.rows[0].id;
    }

    let resolvedSetId = id_de_thi;
    if (!resolvedSetId && resolvedSubjectId && thang_dk && nam_dk) {
      const activeMonthlySet = await client.query(
        `SELECT id_de FROM chuyen_sau_chonde_thang WHERE id_mon = $1 AND nam = $2 AND thang = $3 LIMIT 1`,
        [resolvedSubjectId, nam_dk, thang_dk]
      );
      if (activeMonthlySet.rows.length > 0) {
        resolvedSetId = activeMonthlySet.rows[0].id_de;
      }
    }

    if (id_su_kien) {
      const dupEvent = await client.query(
        `SELECT id FROM chuyen_sau_results
         WHERE id_su_kien = $1::uuid
           AND LOWER(TRIM(ma_giao_vien)) = LOWER(TRIM($2))
         LIMIT 1`,
        [id_su_kien, ma_giao_vien]
      );
      if (dupEvent.rows.length > 0) {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: "Bạn đã đăng ký lịch thi này rồi.",
          httpStatus: 409,
          result_id: dupEvent.rows[0].id,
        };
      }
    }

    const dupCond: string[] = [
      "id_mon = $1",
      `LOWER(TRIM(ma_giao_vien)) = LOWER(TRIM($2))`,
      `xu_ly_diem = 'chờ giải trình'`,
    ];
    const dupVals: unknown[] = [resolvedSubjectId, ma_giao_vien];

    if (id_su_kien) {
      dupCond.push(`id_su_kien = $${dupVals.length + 1}::uuid`);
      dupVals.push(id_su_kien);
    } else if (thang_dk && nam_dk) {
      dupCond.push(`thang_dk = $${dupVals.length + 1}`);
      dupVals.push(thang_dk);
      dupCond.push(`nam_dk = $${dupVals.length + 1}`);
      dupVals.push(nam_dk);
    }

    const dup = await client.query(
      `SELECT id FROM chuyen_sau_results WHERE ${dupCond.join(" AND ")} LIMIT 1`,
      dupVals
    );
    if (dup.rows.length > 0) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: "Giáo viên đã đăng ký môn học này rồi.",
        httpStatus: 409,
        result_id: dup.rows[0].id,
      };
    }

    const insertResult = await client.query(
      `INSERT INTO chuyen_sau_results (
         ma_giao_vien, ho_ten, dia_chi_email, co_so_lam_viec,
         khu_vuc, hinh_thuc, khoi_giang_day,
         thang_dk, nam_dk, dot,
         id_mon, id_su_kien, id_de_thi,
         diem, xu_ly_diem, dang_ky_luc
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 'chờ giải trình', NOW())
       RETURNING *`,
      [
        ma_giao_vien,
        resolvedHoTen,
        dia_chi_email || null,
        co_so_lam_viec || null,
        khu_vuc || null,
        hinh_thuc || null,
        khoi_giang_day || null,
        thang_dk || null,
        nam_dk || null,
        dotResolved ?? null,
        resolvedSubjectId,
        id_su_kien || null,
        resolvedSetId || null,
      ]
    );

    await client.query("COMMIT");
    return { ok: true, data: insertResult.rows[0] as Record<string, unknown> };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("insertExamRegistration:", error);
    return { ok: false, error: "Failed to create registration", httpStatus: 500 };
  } finally {
    client.release();
  }
}
