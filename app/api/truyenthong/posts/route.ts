import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        let queryText = 'SELECT * FROM communications WHERE 1=1';
        const queryParams: any[] = [];
        let paramIndex = 1;

        if (type && type !== 'all') {
            queryText += ` AND post_type = $${paramIndex}`;
            queryParams.push(type);
            paramIndex++;
        }

        if (status && status !== 'all') {
            queryText += ` AND status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }

        if (search) {
            queryText += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        queryText += ' ORDER BY created_at DESC';

        const client = await pool.connect();
        try {
            const result = await client.query(queryText, queryParams);
            return NextResponse.json(result.rows);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching posts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            title,
            description,
            content,
            featured_image,
            banner_image,
            post_type,
            audience,
            status,
            published_at
        } = body;

        const client = await pool.connect();
        try {
            // Check for duplicate title
            const duplicateCheck = await client.query(
                'SELECT 1 FROM communications WHERE title = $1',
                [title]
            );

            if (duplicateCheck.rows.length > 0) {
                return NextResponse.json(
                    { error: 'Tiêu đề bài viết đã tồn tại' },
                    { status: 409 }
                );
            }

            const result = await client.query(
                `INSERT INTO communications (
          title, description, content, featured_image, banner_image, 
          post_type, audience, status, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [
                    title, description, content, featured_image, banner_image,
                    post_type, audience, status, published_at || new Date()
                ]
            );
            return NextResponse.json(result.rows[0], { status: 201 });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating post:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
