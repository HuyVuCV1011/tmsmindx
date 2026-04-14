import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateSlug } from '@/lib/utils';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper to extract Cloudinary public ID from secure URL
const extractCloudinaryPublicId = (url: string | null) => {
    if (!url || !url.includes('cloudinary.com')) return null;
    const parts = url.split('/upload/');
    if (parts.length !== 2) return null;
    let path = parts[1];
    path = path.replace(/^v\d+\//, '');
    const lastDot = path.lastIndexOf('.');
    return lastDot !== -1 ? path.substring(0, lastDot) : path;
};

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
            let reaction: string | null = null;

            if (userId) {
                const likeCheck = await client.query(
                    'SELECT reaction FROM communication_likes WHERE post_id = $1 AND user_id = $2',
                    [post.id, userId]
                );
                isLiked = likeCheck.rows.length > 0;
                reaction = likeCheck.rows[0]?.reaction || null;
            }

            // Fetch related posts (same type, published, exclude current)
            const relatedResult = await client.query(
                `SELECT * FROM communications 
                 WHERE post_type = $1 AND status = 'published' AND id != $2 
                 ORDER BY created_at DESC LIMIT 3`,
                [post.post_type, post.id]
            );
            const relatedPosts = relatedResult.rows;

            return NextResponse.json({ ...post, isLiked, reaction, relatedPosts });
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
            published_at,
            thumbnail_position,
        } = body;

        let processedContent = content;
        try {
             processedContent = await processBase64Images(content);
        } catch (err) {
             console.error("Error processing base64 images in PUT:", err);
        }

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
            
            // Check if image changed, prepare to delete old image from Cloudinary
            let oldFeaturedPublicId = null;
            if (featured_image && currentPost.featured_image && featured_image !== currentPost.featured_image) {
                oldFeaturedPublicId = extractCloudinaryPublicId(currentPost.featured_image);
            }

            let oldBannerPublicId = null;
            if (banner_image && currentPost.banner_image && banner_image !== currentPost.banner_image) {
                oldBannerPublicId = extractCloudinaryPublicId(currentPost.banner_image);
            }
            
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
          audience = $8, status = $9, published_at = $10,
          thumbnail_position = $11, updated_at = NOW()
        WHERE id = $12 RETURNING *`,
                [
                    title, newSlug, description, processedContent, featured_image, banner_image,
                    post_type, audience, status, published_at,
                    thumbnail_position || '50% 50%', currentPost.id
                ]
            );

            // Clean up old images silently if update was successful
            if (oldFeaturedPublicId) {
                cloudinary.uploader.destroy(oldFeaturedPublicId).catch(err => console.error('Failed to destroy old featured image:', err));
            }
            if (oldBannerPublicId && oldBannerPublicId !== oldFeaturedPublicId) {
                cloudinary.uploader.destroy(oldBannerPublicId).catch(err => console.error('Failed to destroy old banner image:', err));
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
            // Try to delete by slug first, fallback to id
            let result = await client.query('DELETE FROM communications WHERE slug = $1 RETURNING *', [id]);
            if (result.rows.length === 0) {
                result = await client.query('DELETE FROM communications WHERE id = $1 RETURNING *', [id]);
            }
            if (result.rows.length === 0) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }

            const deletedPost = result.rows[0];

            // Clean up Cloudinary images associated with this post
            const featuredPublicId = extractCloudinaryPublicId(deletedPost.featured_image);
            if (featuredPublicId) {
                cloudinary.uploader.destroy(featuredPublicId).catch(err => console.error('Failed to destroy featured image upon post deletion:', err));
            }

            const bannerPublicId = extractCloudinaryPublicId(deletedPost.banner_image);
            if (bannerPublicId && bannerPublicId !== featuredPublicId) {
                cloudinary.uploader.destroy(bannerPublicId).catch(err => console.error('Failed to destroy banner image upon post deletion:', err));
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
