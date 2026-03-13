import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET: list with filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const table = searchParams.get('table') || 'teaching_leaders';
        const status = searchParams.get('status'); // Active, Deactive
        const search = searchParams.get('search');
        const area = searchParams.get('area');
        const roleCode = searchParams.get('roleCode');

        let query = ''; let params: any[] = []; let idx = 1;

        if (table === 'teaching_leaders') {
            query = 'SELECT * FROM teaching_leaders WHERE 1=1';
            if (status) { query += ` AND status = $${idx++}`; params.push(status); }
            if (area) { query += ` AND area = $${idx++}`; params.push(area); }
            if (roleCode) { query += ` AND role_code = $${idx++}`; params.push(roleCode); }
            if (search) { query += ` AND (full_name ILIKE $${idx} OR code ILIKE $${idx} OR center ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
            query += ' ORDER BY status ASC, full_name ASC';
        } else if (table === 'centers') {
            query = 'SELECT * FROM centers WHERE 1=1';
            if (status) { query += ` AND status = $${idx++}`; params.push(status); }
            if (search) { query += ` AND (full_name ILIKE $${idx} OR display_name ILIKE $${idx} OR region ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
            query += ' ORDER BY region, full_name';
        } else if (table === 'roles') {
            query = 'SELECT r.*, COUNT(tl.code)::int as leader_count FROM roles r LEFT JOIN teaching_leaders tl ON tl.role_code = r.role_code GROUP BY r.role_code ORDER BY r.department, r.role_name';
        }

        const result = await pool.query(query, params);

        // For teaching_leaders, also get aggregated areas per leader (some leaders manage multiple centers)
        let leaderAreas: Record<string, string[]> = {};
        if (table === 'teaching_leaders') {
            const areasResult = await pool.query(
                `SELECT code, array_agg(DISTINCT area) as areas, array_agg(DISTINCT center) as centers
         FROM teaching_leaders GROUP BY code HAVING COUNT(*) >= 1`
            );
            areasResult.rows.forEach((r: any) => { leaderAreas[r.code] = r.areas; });
        }

        // Get unique areas and role_codes for filters
        let filters: any = {};
        if (table === 'teaching_leaders') {
            const areasF = await pool.query('SELECT DISTINCT area FROM teaching_leaders WHERE area IS NOT NULL ORDER BY area');
            const rolesF = await pool.query('SELECT DISTINCT role_code, role_name FROM teaching_leaders ORDER BY role_code');
            const statusF = await pool.query('SELECT DISTINCT status FROM teaching_leaders ORDER BY status');
            const coursesF = await pool.query('SELECT DISTINCT courses FROM teaching_leaders WHERE courses IS NOT NULL ORDER BY courses');
            filters = {
                areas: areasF.rows.map((r: any) => r.area),
                roleCodes: rolesF.rows,
                statuses: statusF.rows.map((r: any) => r.status),
                courses: coursesF.rows.map((r: any) => r.courses),
            };
        }

        return NextResponse.json({ rows: result.rows, total: result.rowCount, leaderAreas, filters });
    } catch (error: any) {
        console.error('Data API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Create
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { table, ...data } = body;

        if (table === 'teaching_leaders') {
            const { code, full_name, role_code, role_name, center, courses, area, status } = data;
            await pool.query(
                `INSERT INTO teaching_leaders (code, full_name, role_code, role_name, center, courses, area, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (code) DO UPDATE SET
         full_name=$2, role_code=$3, role_name=$4, center=$5, courses=$6, area=$7, status=$8`,
                [code, full_name, role_code, role_name, center, courses || null, area || null, status || 'Active']
            );
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'Table not supported' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Update
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { table, ...data } = body;

        if (table === 'teaching_leaders') {
            const { code, full_name, role_code, role_name, center, courses, area, status } = data;
            await pool.query(
                `UPDATE teaching_leaders SET full_name=$2, role_code=$3, role_name=$4, center=$5, courses=$6, area=$7, status=$8 WHERE code=$1`,
                [code, full_name, role_code, role_name, center, courses, area, status]
            );
            return NextResponse.json({ success: true });
        }

        if (table === 'teaching_leaders_status') {
            const { code, status } = data;
            await pool.query('UPDATE teaching_leaders SET status=$2 WHERE code=$1', [code, status]);
            return NextResponse.json({ success: true });
        }

        if (table === 'centers_status') {
            const { id, status } = data;
            await pool.query('UPDATE centers SET status=$2 WHERE id=$1', [id, status]);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Table not supported' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const table = searchParams.get('table');
        const code = searchParams.get('code');

        if (table === 'teaching_leaders' && code) {
            await pool.query('DELETE FROM teaching_leaders WHERE code=$1', [code]);
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
