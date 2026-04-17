/**
 * API này trước đây tạo Cloudinary signature.
 * Nay chuyển sang tạo presigned PUT URL cho Supabase S3.
 * Client (UploadVideoContext) gọi API này để lấy URL upload trực tiếp lên S3.
 */
import { createSupabaseS3Client, getPublicObjectUrl, isSupabaseS3Configured } from '@/lib/supabase-s3';
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseS3Configured()) {
      return NextResponse.json({ error: 'Chưa cấu hình Supabase S3 Storage' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const folder = body.folder || 'mindx_videos';
    const filename = body.filename || `video-${Date.now()}.mp4`;
    const contentType = body.contentType || 'video/mp4';

    await ensureBucket();
    const client = createSupabaseS3Client();

    const ext = filename.includes('.') ? filename.split('.').pop() : 'mp4';
    const key = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Tạo presigned PUT URL — hết hạn sau 2 giờ (đủ cho video lớn)
    const presignedUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 7200 }
    );

    const publicUrl = getPublicObjectUrl(BUCKET_NAME, key);

    return NextResponse.json({
      // Các field mới cho S3
      presignedUrl,
      publicUrl,
      key,
      bucket: BUCKET_NAME,
      // Giữ lại các field cũ để UploadVideoContext không bị lỗi ngay
      // (sẽ được thay thế hoàn toàn bởi UploadVideoContext mới)
      folder,
      uploadType: 's3',
    });
  } catch (error: any) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json({ error: 'Không thể tạo upload URL' }, { status: 500 });
  }
}
