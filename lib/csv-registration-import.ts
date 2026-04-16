/** Parse CSV đơn giản (hỗ trợ dấu ngoặc kép). */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result.map((s) => s.trim());
}

export function parseCsvToRows(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("File cần có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.");
  }
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, "").trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = cells[j] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Alias header CSV → tên nội bộ.
 * Gồm tên cột giống file «Xuất dữ liệu» trên /admin/page4/danh-sach-dang-ky và tên kỹ thuật cũ.
 */
const HEADER_ALIASES: Record<string, string> = {
  // —— Giống cột xuất Excel (tiếng Việt) ——
  STT: "_stt",
  stt: "_stt",
  "Mã GV": "ma_giao_vien",
  "mã gv": "ma_giao_vien",
  "Loại đăng ký": "loai_dang_ky",
  "loại đăng ký": "loai_dang_ky",
  Khối: "khoi_giang_day",
  khối: "khoi_giang_day",
  "Mã môn": "ma_mon",
  "mã môn": "ma_mon",
  Môn: "ten_mon",
  môn: "ten_mon",
  "Lịch thi": "lich_thi",
  "lịch thi": "lich_thi",
  Điểm: "diem",
  điểm: "diem",
  "Xử lý điểm": "xu_ly_diem",
  "xử lý điểm": "xu_ly_diem",
  "Ngày đăng ký": "ngay_dang_ky",
  "ngày đăng ký": "ngay_dang_ky",
  "Trạng thái HO": "trang_thai_ho",
  "trạng thái ho": "trang_thai_ho",
  // —— Tên kỹ thuật / tiếng Anh ——
  ma_giao_vien: "ma_giao_vien",
  teacher_code: "ma_giao_vien",
  "ma gv": "ma_giao_vien",
  ma_mon: "ma_mon",
  "ma mon": "ma_mon",
  subject_code: "ma_mon",
  hinh_thuc: "hinh_thuc",
  "hình thức": "hinh_thuc",
  registration_type: "hinh_thuc",
  khoi_giang_day: "khoi_giang_day",
  khoi: "khoi_giang_day",
  block_code: "khoi_giang_day",
  thang_dk: "thang_dk",
  tháng: "thang_dk",
  thang: "thang_dk",
  month: "thang_dk",
  nam_dk: "nam_dk",
  năm: "nam_dk",
  nam: "nam_dk",
  year: "nam_dk",
  dia_chi_email: "dia_chi_email",
  email: "dia_chi_email",
  ho_ten: "ho_ten",
  "họ tên": "ho_ten",
  full_name: "ho_ten",
  id_su_kien: "id_su_kien",
  schedule_id: "id_su_kien",
  dot: "dot",
  đợt: "dot",
  co_so_lam_viec: "co_so_lam_viec",
  campus: "co_so_lam_viec",
  khu_vuc: "khu_vuc",
  region: "khu_vuc",
  id_de_thi: "id_de_thi",
  id_mon: "id_mon",
  subject_id: "id_mon",
  open_at: "open_at",
  scheduled_at: "scheduled_at",
};

export function normalizeHeaderKey(header: string): string {
  const raw = header.replace(/^\uFEFF/, "").trim();
  if (HEADER_ALIASES[raw] !== undefined) return HEADER_ALIASES[raw];
  const lower = raw.toLowerCase();
  if (HEADER_ALIASES[lower] !== undefined) return HEADER_ALIASES[lower];
  return raw;
}

/** Gộp các cột về tên chuẩn nội bộ (sau parse CSV). */
export function normalizeImportRow(row: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    const canon = normalizeHeaderKey(key);
    const trimmed = String(val ?? "").trim();
    if (trimmed === "") continue;
    if (out[canon] !== undefined && String(out[canon]).trim() !== "") continue;
    out[canon] = trimmed;
  }
  return out;
}

/** Format xuất: `HH:mm dd/MM/yyyy` (vd: 14:37 16/04/2026) */
export function parseLichThiExportFormat(lich: string): {
  thang_dk: number;
  nam_dk: number;
  open_at: string;
  scheduled_at: string;
} | null {
  const t = lich.trim();
  if (!t || t === "N/A") return null;
  const re = /(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const m = t.match(re);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const mo = parseInt(m[4], 10);
  const y = parseInt(m[5], 10);
  const dt = new Date(y, mo - 1, d, hh, min, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  const iso = dt.toISOString();
  return {
    thang_dk: mo,
    nam_dk: y,
    open_at: iso,
    scheduled_at: iso,
  };
}

/**
 * Chuyển một dòng import (đã normalize) → payload cho insertExamRegistration.
 * Hỗ trợ đúng cấu trúc cột như file xuất + file mẫu; bỏ cột chỉ để đọc (STT, Điểm, …).
 */
export function rowToRegistrationPayload(normalized: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = { ...normalized };

  delete o._stt;
  delete o.stt;

  if (!o.ma_giao_vien && o.teacher_code) o.ma_giao_vien = o.teacher_code;

  const loai = String(o.loai_dang_ky ?? "").trim();
  if (loai && !o.hinh_thuc) {
    if (/bổ\s*sung|additional/i.test(loai)) o.hinh_thuc = "Bổ sung";
    else o.hinh_thuc = "Chính thức";
  }
  delete o.loai_dang_ky;

  delete o.ten_mon;
  delete o.diem;
  delete o.xu_ly_diem;
  delete o.ngay_dang_ky;
  delete o.trang_thai_ho;

  const lich = String(o.lich_thi ?? "").trim();
  if (lich && lich !== "N/A") {
    const p = parseLichThiExportFormat(lich);
    if (p) {
      if (o.thang_dk == null || o.thang_dk === "") o.thang_dk = p.thang_dk;
      if (o.nam_dk == null || o.nam_dk === "") o.nam_dk = p.nam_dk;
      o.open_at = p.open_at;
      o.scheduled_at = p.scheduled_at;
    }
  }
  delete o.lich_thi;

  return o;
}
