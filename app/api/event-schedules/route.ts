import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const EVENT_TYPES = [
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
// Returns a string (not Date) so pg driver skips prepareDate, avoiding server-TZ-dependent shifts.
function parseDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  return fmt.format(parsed); // "YYYY-MM-DD HH:MM:SS" VN wall-clock
}

// Read TIMESTAMP WITHOUT TIME ZONE from pg and return VN wall-clock string.
// Uses Intl so result is correct on any server timezone (Vercel UTC or local VN).
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

function serializeEventScheduleRow(row: Record<string, any>) {
  return {
    ...row,
    start_at: toTimestampString(row.start_at),
    end_at: toTimestampString(row.end_at),
    created_at: toTimestampString(row.created_at),
  };
}

export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const eventType = searchParams.get('event_type');

    let query = `
      SELECT
        id,
        ten AS title,
        chuyen_nganh AS specialty,
        loai_su_kien AS event_type,
        mau_dang_ky AS registration_template,
        bat_dau_luc AS start_at,
        ket_thuc_luc AS end_at,
        ghi_chu AS note,
        tao_luc AS created_at
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
      if (!isValidEventType(eventType)) {
        return NextResponse.json(
          { success: false, error: 'Invalid event_type' },
          { status: 400 }
        );
      }
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
    const {
      id,
      title,
      specialty,
      event_type,
      registration_template,
      start_at,
      end_at,
      note,
      metadata,
      created_by,
      updated_by,
    } = body;

    if (!id || !title || !event_type || !start_at || !end_at) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, title, event_type, start_at, end_at' },
        { status: 400 }
      );
    }

    if (!isValidEventType(String(event_type))) {
      return NextResponse.json(
        { success: false, error: 'Invalid event_type' },
        { status: 400 }
      );
    }

    const startAt = parseDateValue(start_at);
    const endAt = parseDateValue(end_at);
    if (!startAt || !endAt || endAt <= startAt) {
      return NextResponse.json(
        { success: false, error: 'Invalid start_at/end_at' },
        { status: 400 }
      );
    }
    // Validate chronological order using Date objects
    if (new Date(endAt) <= new Date(startAt)) {
      return NextResponse.json(
        { success: false, error: 'end_at must be after start_at' },
        { status: 400 }
      );
    }

    if (registration_template && !['official', 'supplement'].includes(String(registration_template))) {
      return NextResponse.json(
        { success: false, error: 'Invalid registration_template' },
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

    const values = [
      String(id),
      String(title),
      specialty ? String(specialty) : null,
      String(event_type),
      registration_template ? String(registration_template) : null,
      startAt,
      endAt,
      note ? String(note) : null,
    ];

    const result = await pool.query(query, values);

    return NextResponse.json(
      {
        success: true,
        data: serializeEventScheduleRow(result.rows[0]),
        message: 'Event created successfully',
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
    const {
      id,
      title,
      specialty,
      event_type,
      registration_template,
      start_at,
      end_at,
      note,
      metadata,
      updated_by,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Event id is required' },
        { status: 400 }
      );
    }

    if (event_type && !isValidEventType(String(event_type))) {
      return NextResponse.json(
        { success: false, error: 'Invalid event_type' },
        { status: 400 }
      );
    }

    if (registration_template && !['official', 'supplement'].includes(String(registration_template))) {
      return NextResponse.json(
        { success: false, error: 'Invalid registration_template' },
        { status: 400 }
      );
    }

    const fields: string[] = [];
    const values: any[] = [String(id)];

    const pushField = (sql: string, value: any) => {
      values.push(value);
      fields.push(`${sql} = $${values.length}`);
    };

    if (title !== undefined) pushField('ten', title ? String(title) : null);
    if (specialty !== undefined) pushField('chuyen_nganh', specialty ? String(specialty) : null);
    if (event_type !== undefined) pushField('loai_su_kien', String(event_type));
    if (registration_template !== undefined) {
      pushField('mau_dang_ky', registration_template ? String(registration_template) : null);
    }

    if (start_at !== undefined) {
      const parsed = parseDateValue(start_at);
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'Invalid start_at' },
          { status: 400 }
        );
      }
      values.push(parsed);
      fields.push(`bat_dau_luc = $${values.length}::timestamp`);
    }

    if (end_at !== undefined) {
      const parsed = parseDateValue(end_at);
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'Invalid end_at' },
          { status: 400 }
        );
      }
      values.push(parsed);
      fields.push(`ket_thuc_luc = $${values.length}::timestamp`);
    }

    if (note !== undefined) pushField('ghi_chu', note ? String(note) : null);

    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
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
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const updated = result.rows[0];

    return NextResponse.json({
      success: true,
      data: serializeEventScheduleRow(updated),
      message: 'Event updated successfully',
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
        { success: false, error: 'Event id is required' },
        { status: 400 }
      );
    }

    // Don du lieu lien quan truoc khi xoa su kien: ket qua, phan cong, bai nop.
    try {
      const resultIds = await pool.query(
        `SELECT id FROM chuyen_sau_results WHERE id_su_kien = $1::uuid`,
        [String(id)]
      );
      if (resultIds.rows.length > 0) {
        const rIds = resultIds.rows.map((r: { id: number }) => r.id);
        const phancongIds = await pool.query(
          `SELECT id FROM chuyen_sau_phancong WHERE registration_id = ANY($1::bigint[])`,
          [rIds]
        );
        if (phancongIds.rows.length > 0) {
          const pIds = phancongIds.rows.map((r: { id: number }) => r.id);
          await pool.query(
            `DELETE FROM chuyen_sau_bainop WHERE assignment_id = ANY($1::bigint[])`,
            [pIds]
          );
          await pool.query(
            `DELETE FROM chuyen_sau_phancong WHERE id = ANY($1::bigint[])`,
            [pIds]
          );
        }
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
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeEventScheduleRow(result.rows[0]),
      message: 'Event deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting event schedule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete event' },
      { status: 500 }
    );
  }
});
