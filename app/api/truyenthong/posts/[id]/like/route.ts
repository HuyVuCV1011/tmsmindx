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
            await client.query('BEGIN');

            // Check if user already liked the post
            const checkLike = await client.query(
                'SELECT id FROM communication_likes WHERE post_id = $1 AND user_id = $2',
                [id, userId]
            );

            let isLiked = false;
            let action = '';

            if (checkLike.rows.length > 0) {
                // Unlike: Remove from communication_likes and decrement like_count
                await client.query(
                    'DELETE FROM communication_likes WHERE post_id = $1 AND user_id = $2',
                    [id, userId]
                );
                await client.query(
                    'UPDATE communications SET like_count = like_count - 1 WHERE id = $1',
                    [id]
                );
                isLiked = false;
                action = 'unliked';
            } else {
                // Like: Add to communication_likes and increment like_count
                await client.query(
                    'INSERT INTO communication_likes (post_id, user_id) VALUES ($1, $2)',
                    [id, userId]
                );
                await client.query(
                    'UPDATE communications SET like_count = like_count + 1 WHERE id = $1',
                    [id]
                );
                isLiked = true;
                action = 'liked';
            }

            await client.query('COMMIT');

            // Get updated like count
            const result = await client.query(
                'SELECT like_count FROM communications WHERE id = $1',
                [id]
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
