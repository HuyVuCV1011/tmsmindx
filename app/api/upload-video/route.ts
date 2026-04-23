import { requireBearerSession } from '@/lib/datasource-api-auth';
import { clientIpFromRequest, rateLimitOr429 } from '@/lib/rate-limit-memory';
import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-videos';

const ALLOWED_VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'mkv']);
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;

async function ensureBucket() {
  const client = createSupabaseS3Client();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
  }
}

function makeProxyUrl(bucket: string, key: string): string {
  return `/api/storage-image?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const auth = await requireBearerSession(req);
    if (!auth.ok) return auth.response;

    const rl = rateLimitOr429(
      `upload-video:${clientIpFromRequest(req)}`,
      20,
      60_000,
    );
    if (rl) return rl;

    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chưa cấu hình Supabase S3 Storage' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('video');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Không tìm thấy file video' }, { status: 400 });
    }

    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'mp4';
    if (!ALLOWED_VIDEO_EXT.has(ext)) {
      return NextResponse.json(
        { error: 'Định dạng video không được phép' },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: 'File vượt quá dung lượng cho phép' },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(arrayBuffer);

    await ensureBucket();
    const client = createSupabaseS3Client();

    const key = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'video/mp4',
      })
    );

    // Video dùng proxy URL để stream qua server
    const url = makeProxyUrl(BUCKET_NAME, key);

    return NextResponse.json({
      success: true,
      url,
      public_id: key,
      storagePath: `s3://${BUCKET_NAME}/${key}`,
    });
  } catch (error: any) {
    console.error('Upload video error:', error);
    return NextResponse.json({ error: 'Lỗi upload video', detail: error?.message || String(error) }, { status: 500 });
  }
}
