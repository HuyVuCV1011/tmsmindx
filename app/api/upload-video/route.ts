import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-videos';

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
    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chưa cấu hình Supabase S3 Storage' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('video');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Không tìm thấy file video' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await ensureBucket();
    const client = createSupabaseS3Client();

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'mp4';
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
    return NextResponse.json({ error: 'Lỗi upload video' }, { status: 500 });
  }
}
