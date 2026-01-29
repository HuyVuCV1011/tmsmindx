import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

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

            await client.query('BEGIN');

            // Check if user already liked the post
            const checkLike = await client.query(
                'SELECT id FROM communication_likes WHERE post_id = $1 AND user_id = $2',
                [postId, userId]
            );

            let isLiked = false;
            let action = '';

            if (checkLike.rows.length > 0) {
                // Unlike: Remove from communication_likes and decrement like_count
                await client.query(
                    'DELETE FROM communication_likes WHERE post_id = $1 AND user_id = $2',
                    [postId, userId]
                );
                await client.query(
                    'UPDATE communications SET like_count = like_count - 1 WHERE id = $1',
                    [postId]
                );
                isLiked = false;
                action = 'unliked';
            } else {
                // Like: Add to communication_likes and increment like_count
                await client.query(
                    'INSERT INTO communication_likes (post_id, user_id) VALUES ($1, $2)',
                    [postId, userId]
                );
                await client.query(
                    'UPDATE communications SET like_count = like_count + 1 WHERE id = $1',
                    [postId]
                );
                isLiked = true;
                action = 'liked';
            }

            await client.query('COMMIT');

            // Get updated like count
            const result = await client.query(
                'SELECT like_count FROM communications WHERE id = $1',
                [postId]
            );

            return NextResponse.json({
                like_count: result.rows[0].like_count,
                isLiked,
                action
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error toggling like:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error processing like request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
