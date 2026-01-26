import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const client = await pool.connect();
        try {
            // Get total posts
            const totalPostsResult = await client.query('SELECT COUNT(*) FROM communications');
            const totalPosts = parseInt(totalPostsResult.rows[0].count);

            // Get total views
            const totalViewsResult = await client.query('SELECT SUM(view_count) FROM communications');
            const totalViews = parseInt(totalViewsResult.rows[0].sum || '0');

            // Get total likes
            const totalLikesResult = await client.query('SELECT SUM(like_count) FROM communications');
            const totalLikes = parseInt(totalLikesResult.rows[0].sum || '0');

            // Get recent 5 posts
            const recentPostsResult = await client.query(`
        SELECT id, title, published_at, view_count, status 
        FROM communications 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
            const recentPosts = recentPostsResult.rows;

            return NextResponse.json({
                totalPosts,
                totalViews,
                totalLikes,
                recentPosts
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
