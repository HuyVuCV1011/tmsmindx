import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const client = await pool.connect();
        try {
            const result = await client.query(
                'UPDATE communications SET view_count = view_count + 1 WHERE id = $1 RETURNING view_count',
                [id]
            );

            if (result.rows.length === 0) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }

            return NextResponse.json({ view_count: result.rows[0].view_count });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error incrementing view count:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
