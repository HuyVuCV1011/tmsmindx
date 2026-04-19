/**
 * Chuỗi bí mật ký JWT. Production bắt buộc có JWT_SECRET trong env — không dùng default yếu.
 */
export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (s && s.length >= 16) return s;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET must be set to a strong value (16+ chars) in production',
    );
  }
  return 'dev-only-jwt-secret-not-for-production';
}
