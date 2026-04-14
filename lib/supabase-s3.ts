import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = process.env.SUPABASE_S3_REGION || 'ap-south-1';
const ENDPOINT = process.env.SUPABASE_S3_ENDPOINT || '';
const ACCESS_KEY_ID = process.env.SUPABASE_S3_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.SUPABASE_S3_SECRET_ACCESS_KEY || '';

export function isSupabaseS3Configured() {
  return Boolean(ENDPOINT && ACCESS_KEY_ID && SECRET_ACCESS_KEY);
}

export function createSupabaseS3Client() {
  if (!isSupabaseS3Configured()) {
    throw new Error('Chưa cấu hình Supabase S3 endpoint/access key/secret key');
  }

  return new S3Client({
    forcePathStyle: true,
    region: REGION,
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });
}

export function getSupabasePublicBaseUrl() {
  const direct = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (direct) return direct.replace(/\/$/, '');

  if (!ENDPOINT) return '';
  // Convert: https://<ref>.storage.supabase.co/storage/v1/s3 -> https://<ref>.supabase.co
  return ENDPOINT.replace(/\/storage\/v1\/s3\/?$/, '').replace('.storage.supabase.co', '.supabase.co');
}

export async function getSignedObjectUrl(bucket: string, key: string, expiresInSeconds = 3600) {
  const client = createSupabaseS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );
}

export function parseStoragePath(value: string): { bucket: string; key: string } | null {
  if (!value.startsWith('s3://')) return null;
  const raw = value.replace('s3://', '');
  const splitIndex = raw.indexOf('/');
  if (splitIndex <= 0) return null;
  return {
    bucket: raw.slice(0, splitIndex),
    key: raw.slice(splitIndex + 1),
  };
}
