import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateSlug } from '@/lib/utils';

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
            // Try to find by slug first, fallback to id for backward compatibility
            let result = await client.query('SELECT * FROM communications WHERE slug = $1', [id]);
            if (result.rows.length === 0) {
                result = await client.query('SELECT * FROM communications WHERE id = $1', [id]);
            }
            
            if (result.rows.length === 0) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }

            const post = result.rows[0];
            let isLiked = false;

            if (userId) {
                const likeCheck = await client.query(
                    'SELECT 1 FROM communication_likes WHERE post_id = $1 AND user_id = $2',
                    [post.id, userId]
                );
                isLiked = likeCheck.rows.length > 0;
            }

            // Fetch related posts (same type, published, exclude current)
            const relatedResult = await client.query(
                `SELECT * FROM communications 
                 WHERE post_type = $1 AND status = 'published' AND id != $2 
                 ORDER BY created_at DESC LIMIT 3`,
                [post.post_type, post.id]
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
            // Find post by slug or id
            let postResult = await client.query('SELECT * FROM communications WHERE slug = $1', [id]);
            if (postResult.rows.length === 0) {
                postResult = await client.query('SELECT * FROM communications WHERE id = $1', [id]);
            }
            if (postResult.rows.length === 0) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }

            const currentPost = postResult.rows[0];
            
            // Generate new slug if title changed
            let newSlug = currentPost.slug;
            if (title !== currentPost.title) {
                newSlug = generateSlug(title);
                
                // Ensure new slug is unique
                let slugExists = await client.query('SELECT 1 FROM communications WHERE slug = $1 AND id != $2', [newSlug, currentPost.id]);
                let counter = 1;
                while (slugExists.rows.length > 0) {
                    newSlug = `${generateSlug(title)}-${counter}`;
                    slugExists = await client.query('SELECT 1 FROM communications WHERE slug = $1 AND id != $2', [newSlug, currentPost.id]);
                    counter++;
                }
            }

            const result = await client.query(
                `UPDATE communications SET 
          title = $1, slug = $2, description = $3, content = $4, 
          featured_image = $5, banner_image = $6, post_type = $7, 
          audience = $8, status = $9, published_at = $10, updated_at = NOW()
        WHERE id = $11 RETURNING *`,
                [
                    title, newSlug, description, content, featured_image, banner_image,
                    post_type, audience, status, published_at, currentPost.id
                ]
            );

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
            // Try to delete by slug first, fallback to id
            let result = await client.query('DELETE FROM communications WHERE slug = $1 RETURNING *', [id]);
            if (result.rows.length === 0) {
                result = await client.query('DELETE FROM communications WHERE id = $1 RETURNING *', [id]);
            }
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
