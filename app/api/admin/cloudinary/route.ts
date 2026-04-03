import { v2 as cloudinary } from 'cloudinary';
import { NextRequest, NextResponse } from 'next/server';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type AllowedResourceType = 'image' | 'video' | 'raw' | 'all';

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 100);
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceType = (searchParams.get('resource_type') || 'all') as AllowedResourceType;
    const maxResults = parsePositiveInt(searchParams.get('max_results'), 30);
    const nextCursor = searchParams.get('next_cursor') || undefined;
    const prefix = (searchParams.get('prefix') || '').trim();

    if (!['image', 'video', 'raw', 'all'].includes(resourceType)) {
      return NextResponse.json({ success: false, error: 'Invalid resource_type' }, { status: 400 });
    }

    const baseOptions: Record<string, any> = {
      type: 'upload',
      max_results: maxResults,
      next_cursor: nextCursor,
      prefix: prefix || undefined,
      direction: 'desc',
    };

    if (resourceType === 'all') {
      const [images, videos] = await Promise.all([
        cloudinary.api.resources({ ...baseOptions, resource_type: 'image' }),
        cloudinary.api.resources({ ...baseOptions, resource_type: 'video' }),
      ]);

      const resources = [...(images.resources || []), ...(videos.resources || [])].sort((a: any, b: any) => {
        const left = new Date(a.created_at || 0).getTime();
        const right = new Date(b.created_at || 0).getTime();
        return right - left;
      });

      return NextResponse.json({
        success: true,
        data: resources,
        next_cursor: images.next_cursor || videos.next_cursor || null,
        total_count: resources.length,
      });
    }

    const result = await cloudinary.api.resources({
      ...baseOptions,
      resource_type: resourceType,
    });

    return NextResponse.json({
      success: true,
      data: result.resources || [],
      next_cursor: result.next_cursor || null,
      total_count: (result.resources || []).length,
    });
  } catch (error: any) {
    console.error('Cloudinary list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch Cloudinary resources',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const publicId = String(body?.public_id || '').trim();
    const resourceType = String(body?.resource_type || 'image').trim();

    if (!publicId) {
      return NextResponse.json({ success: false, error: 'public_id is required' }, { status: 400 });
    }

    if (!['image', 'video', 'raw'].includes(resourceType)) {
      return NextResponse.json({ success: false, error: 'Invalid resource_type' }, { status: 400 });
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType as 'image' | 'video' | 'raw',
      invalidate: true,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Cloudinary delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to delete Cloudinary resource',
      },
      { status: 500 }
    );
  }
}
