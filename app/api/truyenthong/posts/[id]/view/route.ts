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
            // Find post by slug or id
            let postResult = await client.query('SELECT id FROM communications WHERE slug = $1', [id]);
            if (postResult.rows.length === 0) {
                postResult = await client.query('SELECT id FROM communications WHERE id = $1', [id]);
            }
            if (postResult.rows.length === 0) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }
            
            const postId = postResult.rows[0].id;
            
            const result = await client.query(
                'UPDATE communications SET view_count = view_count + 1 WHERE id = $1 RETURNING view_count',
                [postId]
            );

            return NextResponse.json({ view_count: result.rows[0].view_count });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error incrementing view count:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
