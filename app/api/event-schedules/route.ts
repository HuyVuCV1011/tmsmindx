import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import pool from '@/lib/db';

async function isMissingReviewerMeetingTable(error: any): Promise<boolean> {
  return error.code === '42P01';
}

async function getReviewerMeetings(reviewerNames: string[]): Promise<Map<string, string>> {
  if (reviewerNames.length === 0) {
    return new Map<string, string>();
  }

  const normalizedNames = reviewerNames.map((n) => n.trim().toLowerCase());

  try {
    const result = await pool.query(
      'SELECT reviewer_name, meeting_url FROM lecture_reviewer_meetings WHERE LOWER(TRIM(reviewer_name)) = ANY(::text[])',
      [normalizedNames],
    );

    const rows = (result.rows || []) as { reviewer_name: string; meeting_url: string }[];
    const entries = rows
      .map((row) => [String(row.reviewer_name || '').trim().toLowerCase(), String(row.meeting_url || '').trim()] as [string, string])
      .filter((entry) => Boolean(entry[0]) && Boolean(entry[1]));

    return new Map<string, string>(entries);
  } catch (error: any) {
    if (await isMissingReviewerMeetingTable(error)) {
      return new Map<string, string>();
    }
    throw error;
  }
}

// Read TIMESTAMP WITHOUT TIME ZONE from pg and return ISO 8601 string with +07:00 offset.
// Trả về offset cố định +07:00 vì DB lưu VN wall-clock time (TIMESTAMP WITHOUT TZ).
// Điều này đảm bảo new Date(start_at) parse đúng bất kể browser/server timezone.
function toTimestampString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  // Format sang VN wall-clock string trước
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const vnWallClock = fmt.format(date); // "2026-05-14 21:00:00"
  // Trả về ISO 8601 với offset +07:00 cố định
  return vnWallClock.replace(' ', 'T') + '+07:00'; // "2026-05-14T21:00:00+07:00"
}

function requiresAutoTeamsMeeting(eventType: string | null | undefined): boolean {
  if (!eventType) return false;
  const normalized = String(eventType).toLowerCase();
  return (
    normalized === 'workshop' ||
    normalized === 'meeting' ||
    normalized === 'interview'
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    const query = `
      SELECT
        es.id,
        es.ten AS title,
        es.chuyen_nganh AS specialty,
        es.loai_su_kien AS event_type,
        es.bat_dau_luc AS start_at,
        es.ket_thuc_luc AS end_at,
        es.ghi_chu AS note,
        es.mode,
        es.center_id,
        c.display_name AS center_name,
        c.address AS center_address,
        c.full_address AS center_full_address,
        c.map_url AS center_map_url,
        es.room,
        es.lecture_reviewer,
        es.allow_registration,
        es.slot_limit,
        es.mau_dang_ky AS registration_template,
        es.meeting_url,
        es.meeting_id,
        es.trang_thai AS status
      FROM event_schedules es
      LEFT JOIN centers c ON es.center_id = c.id
      WHERE es.bat_dau_luc >= $1 AND es.bat_dau_luc <= $2
      ORDER BY es.bat_dau_luc ASC
    `;

    const result = await pool.query(query, [startDate, endDate]);
    const rows = result.rows || [];

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error fetching event schedules:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'Events must be an array' }, { status: 400 });
    }

    const reviewerNames = Array.from(
      new Set(
        events
          .filter((e: any) => requiresAutoTeamsMeeting(e.event_type))
          .map((e: any) => e.reviewer_name)
          .filter(Boolean),
      ),
    ) as string[];

    const meetingMap = await getReviewerMeetings(reviewerNames);

    const updatedEvents = events.map((event: any) => {
      if (!requiresAutoTeamsMeeting(event.event_type)) {
        return event;
      }

      const normalizedReviewer = String(event.reviewer_name || '').trim().toLowerCase();
      const meetingUrl = meetingMap.get(normalizedReviewer);

      if (meetingUrl) {
        return {
          ...event,
          meeting_url: meetingUrl,
        };
      }

      return event;
    });

    return NextResponse.json({ events: updatedEvents });
  } catch (error: any) {
    console.error('Error in event-schedules API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

