import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        const client = await pool.connect();
        try {
            const result = await client.query('SELECT * FROM communications WHERE id = $1', [id]);
            if (result.rows.length === 0) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }

            const post = result.rows[0];
            let isLiked = false;

            if (userId) {
                const likeCheck = await client.query(
                    'SELECT 1 FROM communication_likes WHERE post_id = $1 AND user_id = $2',
                    [id, userId]
                );
                isLiked = likeCheck.rows.length > 0;
            }

            // Fetch related posts (same type, published, exclude current)
            const relatedResult = await client.query(
                `SELECT * FROM communications 
                 WHERE post_type = $1 AND status = 'published' AND id != $2 
                 ORDER BY created_at DESC LIMIT 3`,
                [post.post_type, id]
            );
            const relatedPosts = relatedResult.rows;

            return NextResponse.json({ ...post, isLiked, relatedPosts });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching post:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
            const result = await client.query(
                `UPDATE communications SET 
          title = $1, description = $2, content = $3, 
          featured_image = $4, banner_image = $5, post_type = $6, 
          audience = $7, status = $8, published_at = $9, updated_at = NOW()
        WHERE id = $10 RETURNING *`,
                [
                    title, description, content, featured_image, banner_image,
                    post_type, audience, status, published_at, id
                ]
            );

            if (result.rows.length === 0) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }

            return NextResponse.json(result.rows[0]);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating post:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const client = await pool.connect();
        try {
            const result = await client.query('DELETE FROM communications WHERE id = $1 RETURNING *', [id]);
            if (result.rows.length === 0) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }
            return NextResponse.json({ message: 'Post deleted successfully' });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
