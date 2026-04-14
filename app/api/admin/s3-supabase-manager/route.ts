import pool from '@/lib/db';
import { createSupabaseS3Client, getSignedObjectUrl, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ROLES = new Set(['super_admin', 'admin']);

async function ensureAdmin(requestEmail?: string | null) {
  if (!requestEmail) return false;
  const result = await pool.query(
    'SELECT role FROM app_users WHERE email = $1 AND is_active = true LIMIT 1',
    [requestEmail.toLowerCase()]
  );
  if (result.rows.length === 0) return false;
  return ALLOWED_ROLES.has(result.rows[0].role);
}

function classifyObject(name: string, mimeType?: string): 'image' | 'video' | 'file' {
  const lower = name.toLowerCase();
  const imageExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.avif'];
  const videoExt = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('video/')) return 'video';
  if (imageExt.some((ext) => lower.endsWith(ext))) return 'image';
  if (videoExt.some((ext) => lower.endsWith(ext))) return 'video';
  return 'file';
}

function mapS3ContentTypeToKind(contentType?: string, key?: string) {
  return classifyObject(key || '', contentType);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestEmail = searchParams.get('requestEmail');
    const kind = (searchParams.get('kind') || 'all').toLowerCase();
    const selectedBucket = (searchParams.get('bucket') || '').trim();
    const prefix = (searchParams.get('prefix') || '').trim();

    const isAllowed = await ensureAdmin(requestEmail);
    if (!isAllowed) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
    }

    if (!isSupabaseS3Configured()) {
      return NextResponse.json({
        success: true,
        configured: false,
        message: 'Chưa cấu hình SUPABASE_S3_ENDPOINT hoặc S3 access key',
        buckets: [],
        items: [],
      });
    }

    const client = createSupabaseS3Client();
    const bucketRes = await client.send(new ListBucketsCommand({}));
    const buckets = bucketRes.Buckets || [];
    const bucketNames = selectedBucket ? [selectedBucket] : buckets.map((b) => b.Name || '').filter(Boolean);

    const allItems: Array<{
      id: string;
      name: string;
      bucket: string;
      kind: 'image' | 'video' | 'file';
      size: number;
      updatedAt: string | null;
      createdAt: string | null;
      previewUrl: string | null;
    }> = [];

    await Promise.all(
      bucketNames.map(async (bucketName) => {
        const listRes = await client.send(
          new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix || undefined,
            MaxKeys: 200,
          })
        );

        const objects = listRes.Contents || [];
        for (const obj of objects) {
          const key = obj.Key || '';
          if (!key) continue;
          const objectKind = mapS3ContentTypeToKind(undefined, key);
          if (kind !== 'all' && kind !== objectKind) continue;
          allItems.push({
            id: `${bucketName}/${key}`,
            name: key,
            bucket: bucketName,
            kind: objectKind,
            size: Number(obj.Size || 0),
            updatedAt: obj.LastModified ? obj.LastModified.toISOString() : null,
            createdAt: null,
            previewUrl: null,
          });
        }
      })
    );

    for (const item of allItems) {
      if (item.kind === 'image' || item.kind === 'video') {
        try {
          item.previewUrl = await getSignedObjectUrl(item.bucket, item.name, 3600);
        } catch {
          item.previewUrl = null;
        }
      }
    }

    allItems.sort((a, b) => {
      const left = new Date(a.updatedAt || 0).getTime();
      const right = new Date(b.updatedAt || 0).getTime();
      return right - left;
    });

    return NextResponse.json({
      success: true,
      configured: true,
      buckets: buckets.map((b) => ({ name: b.Name || '', public: true })).filter((b) => Boolean(b.name)),
      items: allItems,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Lỗi tải dữ liệu S3 Supabase Manager' },
      { status: 500 }
    );
  }
}
