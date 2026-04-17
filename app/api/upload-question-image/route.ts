import { createSupabaseS3Client, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET_NAME = 'mindx-question-images';

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
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File phải là hình ảnh' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Kích thước file không được vượt quá 5MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await ensureBucket();
    const client = createSupabaseS3Client();

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
    const key = `question-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'image/png',
      })
    );

    const url = makeProxyUrl(BUCKET_NAME, key);

    return NextResponse.json({
      success: true,
      url,
      public_id: key,
      storagePath: `s3://${BUCKET_NAME}/${key}`,
    });
  } catch (error: any) {
    console.error('Upload question image error:', error);
    return NextResponse.json({ error: 'Lỗi server khi upload ảnh' }, { status: 500 });
  }
}
