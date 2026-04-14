/**
 * Bật chế độ bảo trì toàn hệ thống — mọi route (kể cả /login) redirect về /bao-tri;
 * API (trừ /api/health) trả 503.
 *
 * Mặc định: BẬT (chỉ hiện /bao-tri, không đăng nhập). Để mở lại site: đặt
 * MAINTENANCE_MODE=false trong .env / Vercel.
 */
export function isMaintenanceModeEnabled(): boolean {
  const raw = process.env.MAINTENANCE_MODE;
  if (raw === undefined || String(raw).trim() === '') {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') {
    return false;
  }
  return v === 'true' || v === '1' || v === 'yes';
}
