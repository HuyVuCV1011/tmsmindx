import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const EVENT_TYPES = [
  'dang_ky',
  'thi',
  'registration',
  'exam',
  'workshop_teaching',
  'meeting',
  'advanced_training_release',
  'holiday',
] as const;

type EventType = (typeof EVENT_TYPES)[number];

const VN_TZ = 'Asia/Ho_Chi_Minh';

function isValidEventType(value: string): value is EventType {
  return EVENT_TYPES.includes(value as EventType);
}

// Convert any datetime string to VN wall-clock string (YYYY-MM-DD HH:MM:SS).
function parseDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  return fmt.format(parsed);
}

// Read TIMESTAMP WITHOUT TIME ZONE from pg and return VN wall-clock string.
function toTimestampString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  return fmt.format(date);
}

// Serialize row — map DB column names to API response fields (both VN and EN aliases)
function serializeEventScheduleRow(row: Record<string, any>) {
  return {
    id: row.id,
    // Vietnamese column names (primary)
    ten: row.ten,
    chuyen_nganh: row.chuyen_nganh,
    loai_su_kien: row.loai_su_kien,
    mau_dang_ky: row.mau_dang_ky,
    ghi_chu: row.ghi_chu,
    bat_dau_luc: toTimestampString(row.bat_dau_luc),
    ket_thuc_luc: toTimestampString(row.ket_thuc_luc),
    tao_luc: toTimestampString(row.tao_luc),
    // English aliases for backward-compatibility with frontend
    title: row.ten,
    specialty: row.chuyen_nganh,
    event_type: row.loai_su_kien,
    registration_template: row.mau_dang_ky,
    note: row.ghi_chu,
    start_at: toTimestampString(row.bat_dau_luc),
    end_at: toTimestampString(row.ket_thuc_luc),
    created_at: toTimestampString(row.tao_luc),
  };
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const eventType = searchParams.get('event_type') || searchParams.get('loai_su_kien');

    let query = `
      SELECT
        id,
        ten,
        chuyen_nganh,
        loai_su_kien,
        mau_dang_ky,
        bat_dau_luc,
        ket_thuc_luc,
        ghi_chu,
        tao_luc
      FROM event_schedules
      WHERE TRUE
    `;

    const values: any[] = [];

    if (month) {
      values.push(month);
      query += ` AND TO_CHAR(bat_dau_luc, 'YYYY-MM') = $${values.length}`;
    }

    if (year) {
      values.push(year);
      query += ` AND TO_CHAR(bat_dau_luc, 'YYYY') = $${values.length}`;
    }

    if (eventType) {
      values.push(eventType);
      query += ` AND loai_su_kien = $${values.length}`;
    }

    query += ' ORDER BY bat_dau_luc ASC, tao_luc DESC';

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows.map(serializeEventScheduleRow),
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching event schedules:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch event schedules' },
      { status: 500 }
    );
  }
});

export const POST = withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // Accept both Vietnamese and English field names
    const id = body.id;
    const ten = body.ten || body.title;
    const chuyen_nganh = body.chuyen_nganh || body.specialty;
    const loai_su_kien = body.loai_su_kien || body.event_type;
    const mau_dang_ky = body.mau_dang_ky || body.registration_template;
    const bat_dau_luc = body.bat_dau_luc || body.start_at;
    const ket_thuc_luc = body.ket_thuc_luc || body.end_at;
    const ghi_chu = body.ghi_chu || body.note;

    if (!id || !ten || !loai_su_kien || !bat_dau_luc || !ket_thuc_luc) {
      return NextResponse.json(
        { success: false, error: 'Thiếu trường bắt buộc: id, ten, loai_su_kien, bat_dau_luc, ket_thuc_luc' },
        { status: 400 }
      );
    }

    const startAt = parseDateValue(bat_dau_luc);
    const endAt = parseDateValue(ket_thuc_luc);
    if (!startAt || !endAt) {
      return NextResponse.json(
        { success: false, error: 'bat_dau_luc hoặc ket_thuc_luc không hợp lệ' },
        { status: 400 }
      );
    }
    if (new Date(endAt) <= new Date(startAt)) {
      return NextResponse.json(
        { success: false, error: 'ket_thuc_luc phải sau bat_dau_luc' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO event_schedules (
        id,
        ten,
        chuyen_nganh,
        loai_su_kien,
        mau_dang_ky,
        bat_dau_luc,
        ket_thuc_luc,
        ghi_chu
      )
      VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7::timestamp, $8)
      RETURNING *
    `;

    const values = [
      String(id),
      String(ten),
      chuyen_nganh ? String(chuyen_nganh) : null,
      String(loai_su_kien),
      mau_dang_ky ? String(mau_dang_ky) : null,
      startAt,
      endAt,
      ghi_chu ? String(ghi_chu) : null,
    ];

    const result = await pool.query(query, values);

    return NextResponse.json(
      {
        success: true,
        data: serializeEventScheduleRow(result.rows[0]),
        message: 'Tạo sự kiện thành công',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating event schedule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create event' },
      { status: 500 }
    );
  }
});

export const PUT = withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id sự kiện là bắt buộc' },
        { status: 400 }
      );
    }

    const fields: string[] = [];
    const values: any[] = [String(id)];

    const pushField = (sql: string, value: any) => {
      values.push(value);
      fields.push(`${sql} = $${values.length}`);
    };

    // Accept both VN and EN field names
    const ten = body.ten ?? body.title;
    const chuyen_nganh = body.chuyen_nganh ?? body.specialty;
    const loai_su_kien = body.loai_su_kien ?? body.event_type;
    const mau_dang_ky = body.mau_dang_ky ?? body.registration_template;
    const bat_dau_luc = body.bat_dau_luc ?? body.start_at;
    const ket_thuc_luc = body.ket_thuc_luc ?? body.end_at;
    const ghi_chu = body.ghi_chu ?? body.note;

    if (ten !== undefined) pushField('ten', ten ? String(ten) : null);
    if (chuyen_nganh !== undefined) pushField('chuyen_nganh', chuyen_nganh ? String(chuyen_nganh) : null);
    if (loai_su_kien !== undefined) pushField('loai_su_kien', String(loai_su_kien));
    if (mau_dang_ky !== undefined) pushField('mau_dang_ky', mau_dang_ky ? String(mau_dang_ky) : null);

    if (bat_dau_luc !== undefined) {
      const parsed = parseDateValue(bat_dau_luc);
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'bat_dau_luc không hợp lệ' },
          { status: 400 }
        );
      }
      values.push(parsed);
      fields.push(`bat_dau_luc = $${values.length}::timestamp`);
    }

    if (ket_thuc_luc !== undefined) {
      const parsed = parseDateValue(ket_thuc_luc);
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'ket_thuc_luc không hợp lệ' },
          { status: 400 }
        );
      }
      values.push(parsed);
      fields.push(`ket_thuc_luc = $${values.length}::timestamp`);
    }

    if (ghi_chu !== undefined) pushField('ghi_chu', ghi_chu ? String(ghi_chu) : null);

    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không có trường nào để cập nhật' },
        { status: 400 }
      );
    }

    const query = `
      UPDATE event_schedules
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING
        id,
        ten AS title,
        chuyen_nganh AS specialty,
        loai_su_kien AS event_type,
        mau_dang_ky AS registration_template,
        bat_dau_luc AS start_at,
        ket_thuc_luc AS end_at,
        ghi_chu AS note,
        tao_luc AS created_at
    `;

    const result = await pool.query(query, values);

    if (!result.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sự kiện' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeEventScheduleRow(result.rows[0]),
      message: 'Cập nhật sự kiện thành công',
    });
  } catch (error: any) {
    console.error('Error updating event schedule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update event' },
      { status: 500 }
    );
  }
});

export const DELETE = withApiProtection(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id sự kiện là bắt buộc' },
        { status: 400 }
      );
    }

    // Dọn dữ liệu liên quan trước khi xóa sự kiện: kết quả, giải trình, bài nộp.
    try {
      const resultIds = await pool.query(
        `SELECT id FROM chuyen_sau_results WHERE id_su_kien = $1::uuid`,
        [String(id)]
      );
      if (resultIds.rows.length > 0) {
        const rIds = resultIds.rows.map((r: { id: number }) => r.id);

        // Xóa bainop_traloi trước (FK CASCADE từ bainop)
        const bainopIds = await pool.query(
          `SELECT id FROM chuyen_sau_bainop WHERE id_ket_qua = ANY($1::bigint[])`,
          [rIds]
        );
        if (bainopIds.rows.length > 0) {
          const bIds = bainopIds.rows.map((r: { id: number }) => r.id);
          await pool.query(
            `DELETE FROM chuyen_sau_bainop_traloi WHERE id_bai_nop = ANY($1::bigint[])`,
            [bIds]
          );
          await pool.query(
            `DELETE FROM chuyen_sau_bainop WHERE id = ANY($1::bigint[])`,
            [bIds]
          );
        }

        // Xóa giải trình liên quan (qua id_ket_qua)
        await pool.query(
          `DELETE FROM chuyen_sau_giaitrinh WHERE id_ket_qua = ANY($1::bigint[])`,
          [rIds]
        );

        await pool.query(
          `DELETE FROM chuyen_sau_results WHERE id_su_kien = $1::uuid`,
          [String(id)]
        );
      }
    } catch {
      // Graceful: table/column may not exist in all environments
    }

    const result = await pool.query(
      `DELETE FROM event_schedules WHERE id = $1
       RETURNING id, ten AS title, loai_su_kien AS event_type`,
      [String(id)]
    );

    if (!result.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sự kiện' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeEventScheduleRow(result.rows[0]),
      message: 'Xoá sự kiện thành công',
    });
  } catch (error: any) {
    console.error('Error deleting event schedule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete event' },
      { status: 500 }
    );
  }
});
