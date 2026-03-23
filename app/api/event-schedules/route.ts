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

function isValidEventType(value: string): value is EventType {
  return EVENT_TYPES.includes(value as EventType);
}

function parseDateValue(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
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
        created_at,
        updated_at
      FROM event_schedules
      WHERE TRUE
    `;

    const values: any[] = [];

    if (month) {
      values.push(month);
      query += ` AND TO_CHAR(start_at, 'YYYY-MM') = $${values.length}`;
    }

    if (year) {
      values.push(year);
      query += ` AND TO_CHAR(start_at, 'YYYY') = $${values.length}`;
    }

    if (eventType) {
      if (!isValidEventType(eventType)) {
        return NextResponse.json(
          { success: false, error: 'Invalid event_type' },
          { status: 400 }
        );
      }
      values.push(eventType);
      query += ` AND event_type = $${values.length}`;
    }

    query += ' ORDER BY start_at ASC, created_at DESC';

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: result.rows,
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

    if (registration_template && !['official', 'supplement'].includes(String(registration_template))) {
      return NextResponse.json(
        { success: false, error: 'Invalid registration_template' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO event_schedules (
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
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
      RETURNING *
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
      JSON.stringify(metadata || {}),
      created_by ? String(created_by) : null,
      updated_by ? String(updated_by) : null,
    ];

    const result = await pool.query(query, values);

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
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

    if (title !== undefined) pushField('title', title ? String(title) : null);
    if (specialty !== undefined) pushField('specialty', specialty ? String(specialty) : null);
    if (event_type !== undefined) pushField('event_type', String(event_type));
    if (registration_template !== undefined) {
      pushField('registration_template', registration_template ? String(registration_template) : null);
    }

    if (start_at !== undefined) {
      const parsed = parseDateValue(start_at);
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'Invalid start_at' },
          { status: 400 }
        );
      }
      pushField('start_at', parsed);
    }

    if (end_at !== undefined) {
      const parsed = parseDateValue(end_at);
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: 'Invalid end_at' },
          { status: 400 }
        );
      }
      pushField('end_at', parsed);
    }

    if (note !== undefined) pushField('note', note ? String(note) : null);
    if (metadata !== undefined) {
      values.push(JSON.stringify(metadata || {}));
      fields.push(`metadata = $${values.length}::jsonb`);
    }
    if (updated_by !== undefined) pushField('updated_by', updated_by ? String(updated_by) : null);

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
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (!result.rows.length) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const updated = result.rows[0];
    if (new Date(updated.end_at) <= new Date(updated.start_at)) {
      return NextResponse.json(
        { success: false, error: 'Invalid start_at/end_at after update' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
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

    const result = await pool.query(
      'DELETE FROM event_schedules WHERE id = $1 RETURNING *',
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
      data: result.rows[0],
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
