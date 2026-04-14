import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isDatabaseUnavailableError } from '@/lib/db-unavailable';
import { generateSlug } from '@/lib/utils';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function processBase64Images(htmlContent: string): Promise<string> {
    if (!htmlContent) return htmlContent;
    
    const regex = /src=["'](data:image\/[^;]+;base64,[^"']+)["']/g;
    let newContent = htmlContent;
    
    const matches = Array.from(htmlContent.matchAll(regex));
    if (!matches || matches.length === 0) return htmlContent;

    const uploadPromises = matches.map(async (match) => {
        const fullMatch = match[0];
        const base64Data = match[1];
        
        try {
            const uploadRes = await cloudinary.uploader.upload(base64Data, {
                folder: 'mindx_posts_content',
                resource_type: 'image'
            });
            return { originalStr: fullMatch, newStr: `src="${uploadRes.secure_url}"` };
        } catch (error) {
            console.error('Failed to upload base64 image to cloudinary:', error);
            return { originalStr: fullMatch, newStr: fullMatch };
        }
    });

    const replacements = await Promise.all(uploadPromises);
    
    for (const { originalStr, newStr } of replacements) {
        newContent = newContent.replace(originalStr, newStr);
    }
    
    return newContent;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        let queryText = `
SELECT c.*,
  COALESCE(tt.comment_count, 0)::int AS comment_count,
  COALESCE(tt.hidden_comment_count, 0)::int AS hidden_comment_count
FROM communications c
LEFT JOIN (
  SELECT post_slug,
    COUNT(*) FILTER (WHERE hidden IS NOT TRUE)::int AS comment_count,
    COUNT(*) FILTER (WHERE hidden IS TRUE)::int AS hidden_comment_count
  FROM truyenthong_comments
  GROUP BY post_slug
) tt ON tt.post_slug = c.slug
WHERE 1=1`;
        const queryParams: any[] = [];
        let paramIndex = 1;

        if (type && type !== 'all') {
            queryText += ` AND c.post_type = $${paramIndex}`;
            queryParams.push(type);
            paramIndex++;
        }

        if (status && status !== 'all') {
            queryText += ` AND c.status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }

        if (search) {
            queryText += ` AND (c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        queryText += ' ORDER BY c.created_at DESC';

        const client = await pool.connect();
        try {
            const result = await client.query(queryText, queryParams);
            return NextResponse.json(result.rows, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59' } });
        } finally {
            client.release();
        }
    } catch (error) {
        if (isDatabaseUnavailableError(error)) {
            return NextResponse.json([], {
                headers: {
                    'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59',
                    'X-DB-Unavailable': '1',
                },
            });
        }
        console.error('Error fetching posts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59' } });
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
            published_at,
            thumbnail_position,
        } = body;

        let processedContent = content;
        try {
             processedContent = await processBase64Images(content);
        } catch (err) {
             console.error("Error processing base64 images in POST:", err);
             // fallback to original if parsing fails catastrophically
        }

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

            // Generate slug from title
            let slug = generateSlug(title);
            
            // Ensure slug is unique by appending number if needed
            let slugExists = await client.query('SELECT 1 FROM communications WHERE slug = $1', [slug]);
            let counter = 1;
            while (slugExists.rows.length > 0) {
                slug = `${generateSlug(title)}-${counter}`;
                slugExists = await client.query('SELECT 1 FROM communications WHERE slug = $1', [slug]);
                counter++;
            }

            const result = await client.query(
                `INSERT INTO communications (
          title, slug, description, content, featured_image, banner_image, 
          post_type, audience, status, published_at, thumbnail_position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                [
                    title, slug, description, processedContent, featured_image, banner_image,
                    post_type, audience, status, published_at || new Date(),
                    thumbnail_position || '50% 50%'
                ]
            );
            return NextResponse.json(result.rows[0], { status: 201, headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59' } });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating post:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=59' } });
    }
}
