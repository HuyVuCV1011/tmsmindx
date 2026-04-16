"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { Stepper } from "@/components/ui/stepper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseCsvToRows } from "@/lib/csv-registration-import";
import { parseXlsxRegistrationSheet } from "@/lib/xlsx-registration-import";
import { format } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Download,
  FileDown,
  Info,
  Search,
  SlidersHorizontal,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import toast from "react-hot-toast";

interface RegistrationRow {
  id: number;
  teacher_code: string;
  exam_type: string;
  registration_type: "official" | "additional";
  block_code: string;
  subject_code: string;
  subject_name: string | null;
  center_code: string | null;
  scheduled_at: string;
  source_form: string;
  created_at: string;
  assignment_id: number | null;
  assignment_status: string | null;
  score: number | null;
  score_status: string | null;
  xu_ly_diem: string | null;
  tong_diem_bi_tru: number | null;
  dang_ky_luc: string | null;
  open_at: string | null;
  close_at: string | null;
  selected_set_id: number | null;
  random_assigned_at: string | null;
  set_code: string | null;
  set_name: string | null;
  total_points: number | null;
  passing_score: number | null;
  da_giai_thich: boolean | null;
}

type ImportLineResult = {
  line: number;
  ok: boolean;
  id?: unknown;
  error?: string;
  result_id?: number;
};

type ImportLogState = {
  fileName: string;
  imported: number;
  total: number;
  failedCount: number;
  results: ImportLineResult[];
  sourceRows: Record<string, string>[];
};

/** Gom lỗi từng dòng trong một lô — để log biết lỗi từ server (insertExamRegistration). */
function summarizeBatchErrors(batchResults: ImportLineResult[]): string {
  const failed = batchResults.filter((r) => !r.ok);
  if (failed.length === 0) return "";
  const byMsg = new Map<string, number>();
  for (const r of failed) {
    const m = (r.error ?? "Lỗi không rõ").trim();
    byMsg.set(m, (byMsg.get(m) ?? 0) + 1);
  }
  const parts = [...byMsg.entries()].map(([msg, n]) => (n > 1 ? `${msg} (${n}×)` : msg));
  return parts.join(" · ");
}

/** Chi tiết lỗi một dòng import + cột Mã môn / Môn từ file (khi server chưa kèm đủ). */
function formatImportFailDetail(
  res: ImportLineResult,
  lineStart: number,
  slice: Record<string, string>[]
): string {
  const idx = res.line - lineStart;
  const row = slice[idx];
  const base = `dòng ${res.line}: ${res.error ?? "?"}`;
  if (!row) return base;
  const mm = row["Mã môn"]?.trim() || row["ma_mon"]?.trim() || row["subject_code"]?.trim() || "";
  const mon = row["Môn"]?.trim() || row["ten_mon"]?.trim() || "";
  if (!mm && !mon) return base;
  const fileHint =
    mon && mon !== mm ? ` — trên file: Mã môn="${mm || "—"}" · Môn="${mon}"` : ` — trên file: Mã môn="${mm || mon}"`;
  return `${base}${fileHint}`;
}

function previewImportRow(r: Record<string, string>): string {
  const gv = r["Mã GV"]?.trim() || r["ma_giao_vien"]?.trim() || r["teacher_code"]?.trim() || "";
  const khoi = r["Khối"]?.trim() || r["khoi_giang_day"]?.trim() || r["block_code"]?.trim() || "";
  const mm = r["Mã môn"]?.trim() || r["ma_mon"]?.trim() || r["subject_code"]?.trim() || "";
  const mon = r["Môn"]?.trim() || r["ten_mon"]?.trim() || "";
  const lich = r["Lịch thi"]?.trim() || r["lich_thi"]?.trim() || "";
  const parts: string[] = [];
  if (gv) parts.push(`GV ${gv}`);
  if (khoi) parts.push(`Khối ${khoi}`);
  if (mm) parts.push(mm);
  if (mon && mon !== mm) parts.push(mon);
  if (lich) parts.push(lich);
  if (parts.length) return parts.join(" · ");
  const flat = Object.values(r)
    .map((v) => String(v).trim())
    .filter(Boolean);
  return flat.slice(0, 4).join(" · ") || "(dòng trống)";
}

const PAGE_SIZE = 50;

export default function ExamRegistrationListPage() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTeacherCode, setSearchTeacherCode] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  /** Lọc nâng cao */
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filterSubjectQ, setFilterSubjectQ] = useState("");
  const [filterBlockQ, setFilterBlockQ] = useState("");
  const [filterRegType, setFilterRegType] = useState<"all" | "official" | "additional">("all");
  const [filterXuLy, setFilterXuLy] = useState<
    "all" | "chờ giải trình" | "đã duyệt" | "từ chối" | "đã hoàn thành"
  >("all");
  const [filterHasScore, setFilterHasScore] = useState<"all" | "has" | "none">("all");
  const [removingRegistrationId, setRemovingRegistrationId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importActivityLog, setImportActivityLog] = useState<string[]>([]);
  const [importLogOpen, setImportLogOpen] = useState(false);
  const [importLog, setImportLog] = useState<ImportLogState | null>(null);
  const [confirmStopImportOpen, setConfirmStopImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importActivityLogRef = useRef<HTMLDivElement>(null);
  /** Dừng giữa các lô / hủy request đang chạy */
  const importCancelRef = useRef(false);
  const importAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!importActivityLog.length || !importActivityLogRef.current) return;
    importActivityLogRef.current.scrollTop = importActivityLogRef.current.scrollHeight;
  }, [importActivityLog]);

  /** Bộ lọc chung cho danh sách (có/không phân trang) và xuất CSV */
  const appendListFilters = (params: URLSearchParams) => {
    const gv = searchTeacherCode.trim();
    if (gv) params.set("teacher_code", gv);
    if (selectedMonth !== "all") params.set("month", selectedMonth);
    const sq = filterSubjectQ.trim();
    if (sq) params.set("subject_q", sq);
    const bq = filterBlockQ.trim();
    if (bq) params.set("block_q", bq);
    if (filterRegType !== "all") params.set("registration_type", filterRegType);
    if (filterXuLy !== "all") params.set("xu_ly_diem", filterXuLy);
    if (filterHasScore !== "all") params.set("has_score", filterHasScore === "has" ? "1" : "0");
  };

  const fetchRows = async (nextPage?: number) => {
    const targetPage = nextPage ?? page;
    try {
      setLoading(true);

      const params = new URLSearchParams();
      appendListFilters(params);
      params.set("limit", String(PAGE_SIZE));
      params.set("page", String(targetPage));

      const response = await fetch(`/api/exam-registrations?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setRows(data.data || []);
        setTotal(typeof data.total === "number" ? data.total : (data.data?.length ?? 0));
        setPage(targetPage);
      } else {
        toast.error(data.error || "Không thể tải danh sách đăng ký");
      }
    } catch (error) {
      console.error("Error fetching registrations:", error);
      toast.error("Có lỗi xảy ra khi tải danh sách đăng ký");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRows(1);
  }, []);

  const handleSetPending = async (row: RegistrationRow) => {
    if (!row.assignment_id) {
      toast.error("Đăng ký này đã ở trạng thái pending");
      return;
    }

    const confirmed = window.confirm(
      `Đưa đăng ký của GV ${row.teacher_code} (${row.subject_name || row.subject_code}) về trạng thái pending?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingRegistrationId(row.id);

      const response = await fetch('/api/exam-registrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: row.id }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể đưa về pending');
      }

      toast.success('Đã đưa đăng ký về pending');
      await fetchRows(page);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể đưa về pending');
    } finally {
      setRemovingRegistrationId(null);
    }
  };

  const exportCsv = async () => {
    const getHoStatus = (row: RegistrationRow) => {
      const xu = row.xu_ly_diem || '';
      const examGraded =
        row.assignment_status === 'graded' ||
        (row.score !== null && Number(row.score) > 0);
      if (xu === 'đã duyệt') return 'Accepted';
      if (xu === 'từ chối') return 'Rejected';
      if (examGraded || xu === 'đã hoàn thành') return 'Done';
      if (xu === 'chờ giải trình') return 'Waiting';
      if (row.score !== null) return 'Done';
      return 'Pending';
    };

    const headers = [
      'STT',
      'Mã GV',
      'Loại đăng ký',
      'Khối',
      'Mã môn',
      'Môn',
      'Lịch thi',
      'Điểm',
      'Xử lý điểm',
      'Ngày đăng ký',
      'Trạng thái HO',
    ];
    let exportRows = rows;
    try {
      const params = new URLSearchParams();
      appendListFilters(params);
      const response = await fetch(`/api/exam-registrations?${params.toString()}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        exportRows = data.data;
      } else {
        toast.error(data.error || "Không tải được dữ liệu để xuất");
        return;
      }
    } catch {
      toast.error("Không tải được dữ liệu để xuất");
      return;
    }

    const csvRows = exportRows.map((row, i) => {
      const start = row.open_at ? new Date(row.open_at) : (row.scheduled_at ? new Date(row.scheduled_at) : null);
      const lichThi = start ? format(start, 'HH:mm dd/MM/yyyy') : 'N/A';
      const ngayDk = new Date(row.dang_ky_luc || row.created_at).toLocaleDateString('vi-VN');
      return [
        i + 1,
        row.teacher_code,
        row.registration_type === 'official' ? 'Chính thức' : 'Bổ sung',
        row.block_code,
        row.subject_code,
        row.subject_name || row.subject_code,
        lichThi,
        row.score ?? '',
        row.xu_ly_diem || '',
        ngayDk,
        getHoStatus(row),
      ];
    });

    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const content = [headers, ...csvRows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `danh-sach-dang-ky-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = "/templates/mau-import-dang-ky-ky-thi.xlsx";
    a.download = "mau-import-dang-ky-ky-thi.xlsx";
    a.rel = "noopener";
    a.click();
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      toast.error("Chưa chọn file.");
      return;
    }
    if (file.size === 0) {
      toast.error("File rỗng — không có dữ liệu để import.");
      return;
    }

    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith(".xlsx");
    if (!name.endsWith(".csv") && !isXlsx) {
      toast.error(
        "Hệ thống không nhận định dạng này. Chỉ dùng file .csv hoặc .xlsx (nên tải file mẫu Excel, sheet «Đăng ký»)."
      );
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setImportActivityLog([]);
    const pushActivityLog = (msg: string) => {
      const t = new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setImportActivityLog((prev) => [...prev, `${t} · ${msg}`]);
    };

    try {
      pushActivityLog("Bắt đầu đọc và phân tích file…");
      let parsedRows: Record<string, string>[];
      try {
        if (isXlsx) {
          const ab = await file.arrayBuffer();
          if (ab.byteLength === 0) {
            toast.error("Không đọc được nội dung file Excel (file rỗng).");
            return;
          }
          ({ rows: parsedRows } = parseXlsxRegistrationSheet(ab));
        } else {
          const text = await file.text();
          if (!text.trim()) {
            toast.error("File CSV không có nội dung hoặc encoding không đọc được.");
            return;
          }
          ({ rows: parsedRows } = parseCsvToRows(text));
        }
      } catch (parseErr) {
        const detail = parseErr instanceof Error ? parseErr.message : String(parseErr);
        const hint =
          isXlsx
            ? " Kiểm tra file .xlsx không bị hỏng và có sheet «Đăng ký» với dòng tiêu đề + ít nhất một dòng dữ liệu."
            : " Kiểm tra file .csv có dòng tiêu đề và dòng dữ liệu, encoding UTF-8.";
        toast.error(`Không nhận được dữ liệu từ file: ${detail}${hint}`);
        return;
      }

      if (parsedRows.length === 0) {
        pushActivityLog("Không có dòng dữ liệu sau khi lọc.");
        toast.error(
          "Không có dòng dữ liệu để import (đã bỏ dòng # và dòng trống). Với Excel, chỉ sheet «Đăng ký» được đưa vào — không dùng sheet tham chiếu làm dữ liệu."
        );
        return;
      }

      pushActivityLog(`Đã parse: ${parsedRows.length} dòng dữ liệu (dòng 2 → ${parsedRows.length + 1} trên file).`);

      const totalRows = parsedRows.length;
      /** Lô lớn để giảm số vòng HTTP; server xử lý song song vài dòng/lô (IMPORT_ROW_CONCURRENCY). */
      const BATCH_SIZE = 120;
      const batchCount = Math.ceil(totalRows / BATCH_SIZE);
      setImportProgress(8);
      pushActivityLog(`Gửi server theo lô ${BATCH_SIZE} dòng — ${batchCount} lô.`);

      const allResults: ImportLineResult[] = [];
      let totalImported = 0;

      importCancelRef.current = false;
      importAbortRef.current = new AbortController();
      const importSignal = importAbortRef.current.signal;

      for (let start = 0; start < totalRows; start += BATCH_SIZE) {
        if (importCancelRef.current) {
          pushActivityLog("Đã dừng trước khi gửi lô tiếp theo.");
          break;
        }

        const batchIndex = Math.floor(start / BATCH_SIZE) + 1;
        const slice = parsedRows.slice(start, start + BATCH_SIZE);
        const lineStart = 2 + start;
        const lineEnd = lineStart + slice.length - 1;
        pushActivityLog(`Lô ${batchIndex}/${batchCount}: dòng file ${lineStart}–${lineEnd} → đang POST /api/import…`);

        let response: Response;
        try {
          response = await fetch("/api/exam-registrations/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: slice, lineStart }),
            signal: importSignal,
          });
        } catch (fetchErr) {
          const isAbort =
            (fetchErr instanceof DOMException && fetchErr.name === "AbortError") ||
            (fetchErr instanceof Error && fetchErr.name === "AbortError");
          if (isAbort) {
            pushActivityLog("Request bị hủy (dừng import).");
            break;
          }
          throw fetchErr;
        }

        let data: {
          success?: boolean;
          error?: string;
          imported?: number;
          total?: number;
          failedCount?: number;
          results?: ImportLineResult[];
        };
        try {
          data = await response.json();
        } catch {
          toast.error("Máy chủ trả về phản hồi không hợp lệ — thử lại hoặc kiểm tra kết nối.");
          return;
        }

        if (!response.ok || !data?.success) {
          pushActivityLog(`Lô ${batchIndex}: lỗi HTTP ${response.status} — ${data?.error ?? ""}`);
          throw new Error(data?.error || `Import thất bại (${response.status})`);
        }

        const batchResults = data.results ?? [];
        const batchFail = batchResults.filter((r) => !r.ok).length;
        allResults.push(...batchResults);
        totalImported += data.imported ?? 0;
        const errSummary = summarizeBatchErrors(batchResults);
        pushActivityLog(
          `Lô ${batchIndex}/${batchCount}: xong — ${data.imported ?? 0}/${slice.length} dòng ghi DB${batchFail ? `, ${batchFail} lỗi` : ""}.`
        );
        if (batchFail > 0 && errSummary) {
          pushActivityLog(`  → Lỗi từ server: ${errSummary}`);
        }
        if (batchFail > 0 && batchResults.length > 0) {
          const sample = batchResults
            .filter((r) => !r.ok)
            .slice(0, 5)
            .map((r) => formatImportFailDetail(r, lineStart, slice));
          if (sample.length) {
            pushActivityLog(`  → Chi tiết (tối đa 5 dòng): ${sample.join(" | ")}`);
          }
        }

        const done = Math.min(start + slice.length, totalRows);
        setImportProgress(8 + Math.round((92 * done) / totalRows));

        /** Cả lô đầu không ghi được dòng nào — thường là sai cột/định dạng chung; tránh chờ hàng nghìn lô tương tự. */
        if (
          batchIndex === 1 &&
          (data.imported ?? 0) === 0 &&
          batchFail === slice.length &&
          slice.length > 0
        ) {
          pushActivityLog(
            "Dừng import tại đây — cả lô đầu đều lỗi (cùng kiểu lỗi sẽ lặp cho cả file). Sửa file hoặc đối chiếu cột với «Xuất dữ liệu», rồi import lại."
          );
          setImportProgress(100);
          setImportLog({
            fileName: file.name,
            imported: totalImported,
            total: slice.length,
            failedCount: batchFail,
            results: allResults,
            sourceRows: slice,
          });
          setImportLogOpen(true);
          toast.error(
            `Lô đầu (${slice.length} dòng / file ${totalRows} dòng): không ghi DB. ${errSummary ? `Lỗi: ${errSummary}` : "Xem modal"} — đã dừng, không chạy thêm ${batchCount - 1} lô.`
          );
          await fetchRows(1);
          return;
        }
      }

      const stoppedByUser = importCancelRef.current || importSignal.aborted;

      if (stoppedByUser) {
        setImportProgress(100);
        pushActivityLog("Kết thúc: đã dừng theo yêu cầu — các lô chưa gửi được bỏ qua.");
        if (allResults.length > 0) {
          const failedPartial = allResults.filter((r) => !r.ok);
          setImportLog({
            fileName: file.name,
            imported: totalImported,
            total: totalRows,
            failedCount: failedPartial.length,
            results: allResults,
            sourceRows: parsedRows.slice(0, allResults.length),
          });
          setImportLogOpen(true);
        }
        toast.success("Đã dừng import. Dữ liệu đã gửi trước đó vẫn được lưu.");
        await fetchRows(1);
        return;
      }

      setImportProgress(100);
      pushActivityLog("Đã xử lý hết các lô. Chuẩn bị bảng kết quả và tải lại danh sách…");

      const failed = allResults.filter((r) => !r.ok);
      setImportLog({
        fileName: file.name,
        imported: totalImported,
        total: totalRows,
        failedCount: failed.length,
        results: allResults,
        sourceRows: parsedRows,
      });
      setImportLogOpen(true);

      if (failed.length > 0) {
        console.warn("Import — các dòng lỗi:", failed);
        toast.error(
          `Import xong: ${totalImported}/${totalRows} dòng thành công. ${failed.length} dòng lỗi — xem chi tiết trong bảng kết quả.`
        );
      } else {
        toast.success(`Đã import thành công ${totalImported} dòng. Xem chi tiết trong bảng kết quả.`);
      }
      await fetchRows(1);
    } catch (err: unknown) {
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (isAbort) {
        pushActivityLog("Import bị hủy.");
        toast.success("Đã dừng import.");
        await fetchRows(1);
        return;
      }
      const msg = err instanceof Error ? err.message : "Không thể import file";
      setImportActivityLog((prev) => [
        ...prev,
        `${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · Dừng: ${msg}`,
      ]);
      toast.error(msg);
    } finally {
      setImporting(false);
      setImportProgress(0);
      importAbortRef.current = null;
      importCancelRef.current = false;
    }
  };

  const confirmStopImport = () => {
    importCancelRef.current = true;
    importAbortRef.current?.abort();
    setConfirmStopImportOpen(false);
  };

  /** Tháng/năm đăng ký (YYYY-MM) — danh sách cố định, không phụ thuộc dữ liệu đã tải */
  const monthPickerOptions = useMemo(() => {
    const out: string[] = [];
    const y = new Date().getFullYear();
    for (let dy = -3; dy <= 2; dy++) {
      for (let m = 1; m <= 12; m++) {
        out.push(`${y + dy}-${String(m).padStart(2, "0")}`);
      }
    }
    return out.sort((a, b) => b.localeCompare(a));
  }, []);

  const activeAdvancedFilterCount = useMemo(() => {
    let n = 0;
    if (selectedMonth !== "all") n++;
    if (filterSubjectQ.trim()) n++;
    if (filterBlockQ.trim()) n++;
    if (filterRegType !== "all") n++;
    if (filterXuLy !== "all") n++;
    if (filterHasScore !== "all") n++;
    return n;
  }, [
    selectedMonth,
    filterSubjectQ,
    filterBlockQ,
    filterRegType,
    filterXuLy,
    filterHasScore,
  ]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const clearAdvancedFilters = () => {
    setSelectedMonth("all");
    setFilterSubjectQ("");
    setFilterBlockQ("");
    setFilterRegType("all");
    setFilterXuLy("all");
    setFilterHasScore("all");
  };

  const clearAllFilters = () => {
    setSearchTeacherCode("");
    clearAdvancedFilters();
  };

  const getAssignmentBadge = (row: RegistrationRow) => {
    const gtPending = row.xu_ly_diem === 'chờ giải trình';
    const gtApproved = row.xu_ly_diem === 'đã duyệt';
    const gtRejected = row.xu_ly_diem === 'từ chối';
    const hasGiaiTrinh = row.da_giai_thich || gtPending || gtApproved || gtRejected;
    /** Đã chấm bài / có điểm thi (khác với bước giải trình điểm sau chấm) */
    const examGraded =
      row.assignment_status === 'graded' ||
      (row.score !== null && Number(row.score) > 0);

    if (hasGiaiTrinh) {
      return (
        <div className="w-[300px] mx-auto">
          <Stepper
            compact
            steps={[
              {
                id: 1,
                label: 'Đăng ký',
                description: 'Đã đăng ký',
                status: 'completed'
              },
              {
                id: 2,
                label: 'Giải trình',
                description: gtPending ? 'Chờ duyệt' : 'Đã gửi',
                status: gtPending ? 'current' : 'completed'
              },
              {
                id: 3,
                label: 'Kết quả',
                description: gtApproved
                  ? 'Giải trình\n(Đã duyệt)'
                  : gtRejected
                    ? 'Giải trình\n(Từ chối)'
                    : examGraded
                      ? 'Đã chấm điểm\n(Chờ giải trình)'
                      : 'Chờ',
                status: gtApproved ? 'success' : gtRejected ? 'error' : examGraded ? 'success' : 'upcoming'
              }
            ]}
          />
        </div>
      );
    }

    const assigned = !!row.assignment_id;
    const graded = row.assignment_status === 'graded';
    const expired = row.assignment_status === 'expired';

    return (
      <div className="w-[300px] mx-auto">
        <Stepper
          compact
          steps={[
            {
              id: 1,
              label: 'Giao đề',
              description: assigned ? 'Đã giao' : 'Chưa giao',
              status: assigned ? 'completed' : 'upcoming'
            },
            {
              id: 2,
              label: 'Nộp bài',
              description: expired ? 'Quá hạn' : graded ? 'Đã nộp' : assigned ? 'Đang làm' : 'Chưa',
              status: expired ? 'error' : graded ? 'completed' : assigned ? 'current' : 'upcoming'
            },
            {
              id: 3,
              label: 'Chấm điểm',
              description: graded ? 'Hoàn thành' : 'Chưa',
              status: graded ? 'success' : 'upcoming'
            }
          ]}
        />
      </div>
    );
  };

  return (
    <>
      {importing ? (
        <div
          className="group fixed left-2 top-2 z-[9980] w-[min(calc(100vw-1rem),14rem)]"
          role="progressbar"
          aria-valuenow={importProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiến độ import — di chuột vào để xem nhật ký chi tiết"
        >
          <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="min-w-0 text-xs font-semibold text-gray-800">Đang gửi dữ liệu</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums font-bold text-[#a1001f]">{importProgress}%</span>
                <button
                  type="button"
                  onClick={() => setConfirmStopImportOpen(true)}
                  className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-red-50 hover:text-[#a1001f] hover:border-[#a1001f]"
                >
                  Dừng
                </button>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#a1001f] transition-[width] duration-300 ease-out"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-tight text-gray-500">
              Di chuột vào đây để xem log từng bước
            </p>
          </div>
          <div
            role="log"
            aria-live="polite"
            className="pointer-events-none invisible absolute left-0 top-full z-[9981] mt-0 max-h-52 w-[min(calc(100vw-1rem),22rem)] overflow-hidden rounded-lg border border-gray-200 bg-white p-2 opacity-0 shadow-xl transition-opacity duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100"
          >
            <p className="mb-1 border-b border-gray-100 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Nhật ký import
            </p>
            <div
              ref={importActivityLogRef}
              className="max-h-44 overflow-y-auto font-mono text-[10px] leading-snug text-gray-800"
            >
              {importActivityLog.length === 0 ? (
                <span className="text-gray-400">Đang khởi tạo…</span>
              ) : (
                importActivityLog.map((line, i) => (
                  <div key={i} className="border-b border-gray-50 py-0.5 last:border-0">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      <PageContainer
        title="Danh sách đăng ký đánh giá chuyên môn"
        description="Tổng hợp toàn bộ thông tin đăng ký kiểm tra chuyên môn của giáo viên"
      >
      <Card padding="lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#a1001f]" />
            <h2 className="text-base font-bold text-gray-900">Danh sách đăng ký</h2>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
              {total > 0 ? total : rows.length} bản ghi
            </span>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchTeacherCode}
                onChange={(e) => setSearchTeacherCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void fetchRows(1);
                }}
                placeholder="Mã GV (Enter để tải)"
                className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm w-full sm:w-52"
              />
            </div>

            <button
              type="button"
              onClick={() => void fetchRows(1)}
              className="px-3 py-2 rounded-lg bg-[#a1001f] text-white text-sm font-medium hover:bg-[#8a0019]"
            >
              Tải dữ liệu
            </button>
            <button
              type="button"
              onClick={() => void exportCsv()}
              disabled={rows.length === 0 && total === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              Xuất dữ liệu
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown className="h-4 w-4" />
              File mẫu
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[#a1001f] bg-red-50/50 text-sm font-medium text-[#a1001f] hover:bg-red-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Đang import…" : "Import CSV / Excel"}
            </button>

            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#a1001f]" />
              Lọc nâng cao
              {activeAdvancedFilterCount > 0 ? (
                <span className="min-w-[1.25rem] rounded-full bg-[#a1001f] px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                  {activeAdvancedFilterCount}
                </span>
              ) : null}
              {advancedOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-500" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {advancedOpen ? (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/90 p-4">
            <p className="mb-3 text-xs text-gray-600">
              Lọc theo tháng/năm đăng ký (<code className="rounded bg-white px-1">thang_dk</code> /{" "}
              <code className="rounded bg-white px-1">nam_dk</code>), khối, môn (chuỗi con trong mã hoặc tên môn), loại đăng ký, trạng thái xử lý điểm, và có ghi nhận điểm hay chưa.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                Tháng đăng ký
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm font-normal text-gray-900"
                >
                  <option value="all">Tất cả tháng</option>
                  {monthPickerOptions.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                Khối (dòng đăng ký hoặc mã khối môn)
                <input
                  value={filterBlockQ}
                  onChange={(e) => setFilterBlockQ(e.target.value)}
                  placeholder="vd. ART"
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm font-normal text-gray-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                Mã môn / tên môn (tìm gần đúng)
                <input
                  value={filterSubjectQ}
                  onChange={(e) => setFilterSubjectQ(e.target.value)}
                  placeholder="vd. ART hoặc Chuyên sâu"
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm font-normal text-gray-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                Loại đăng ký
                <select
                  value={filterRegType}
                  onChange={(e) => setFilterRegType(e.target.value as "all" | "official" | "additional")}
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm font-normal text-gray-900"
                >
                  <option value="all">Tất cả</option>
                  <option value="official">Chính thức</option>
                  <option value="additional">Bổ sung</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                Xử lý điểm
                <select
                  value={filterXuLy}
                  onChange={(e) =>
                    setFilterXuLy(
                      e.target.value as "all" | "chờ giải trình" | "đã duyệt" | "từ chối" | "đã hoàn thành",
                    )
                  }
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm font-normal text-gray-900"
                >
                  <option value="all">Tất cả</option>
                  <option value="chờ giải trình">chờ giải trình</option>
                  <option value="đã duyệt">đã duyệt</option>
                  <option value="từ chối">từ chối</option>
                  <option value="đã hoàn thành">đã hoàn thành</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
                Cột điểm trong DB
                <select
                  value={filterHasScore}
                  onChange={(e) => setFilterHasScore(e.target.value as "all" | "has" | "none")}
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm font-normal text-gray-900"
                >
                  <option value="all">Không lọc</option>
                  <option value="has">Đã có điểm (NOT NULL)</option>
                  <option value="none">Chưa có điểm (NULL)</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void fetchRows(1)}
                className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a0019]"
              >
                Áp dụng bộ lọc
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllFilters();
                  void fetchRows(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Xóa lọc &amp; tải lại
              </button>
            </div>
          </div>
        ) : null}

        <div className="group relative mb-4 inline-flex">
          <span
            className="inline-flex cursor-help items-center gap-1 rounded-md border border-gray-200 bg-gray-50/80 px-2 py-1 text-xs text-gray-600"
            title="Di chuột để xem hướng dẫn import"
          >
            <Info className="h-3.5 w-3.5 shrink-0 text-[#a1001f]" aria-hidden />
            <span className="font-medium">Hướng dẫn import</span>
          </span>
          <div
            role="tooltip"
            className="pointer-events-none invisible absolute left-0 top-full z-50 mt-0 w-[min(100vw-2rem,28rem)] rounded-lg border border-gray-200 bg-white p-3 text-left text-xs leading-relaxed text-gray-700 shadow-lg opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100"
          >
            <p className="m-0">
              <strong>Import CSV hoặc Excel (.xlsx):</strong> cột giống <strong>Xuất dữ liệu</strong> (Mã GV, Loại đăng ký, Khối, Mã môn, Môn, <strong>Lịch thi</strong>:{" "}
              <code className="bg-gray-100 px-1 rounded">HH:mm dd/MM/yyyy</code> hoặc chỉ ngày{" "}
              <code className="bg-gray-100 px-1 rounded">d/M/yyyy</code> — nếu không có giờ thì hệ thống dùng mặc định 19:00 theo ngày trong ô). Tải{" "}
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-[#a1001f] font-semibold underline underline-offset-2"
              >
                file mẫu Excel
              </button>{" "}
              (3 sheet: <strong>Đăng ký</strong> — dữ liệu import; <strong>Tham chiếu môn</strong>; <strong>Khối &amp; môn</strong> — Khối / Mã môn / Môn để đối chiếu; chỉ sheet Đăng ký được đưa vào hệ thống) hoặc xuất danh sách rồi sửa. Với CSV, dòng bắt đầu bằng{" "}
              <code className="bg-gray-100 px-1">#</code> bị bỏ qua.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Đang tải dữ liệu đăng ký...</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm">Chưa có dữ liệu đăng ký.</div>
        ) : (
          <>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center w-10">#</TableHead>
                  <TableHead className="text-center">Mã GV</TableHead>
                  <TableHead className="text-center">Loại đăng ký</TableHead>
                  <TableHead className="text-center">Khối / Môn</TableHead>
                  <TableHead className="text-center">Lịch thi</TableHead>
                  <TableHead className="text-center">Trạng thái assignment</TableHead>
                  <TableHead className="text-center">Điểm</TableHead>
                  <TableHead className="text-center">Ngày đăng ký</TableHead>
                  <TableHead className="text-center">Thao tác HO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-center text-gray-600">
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-gray-900">{row.teacher_code}</TableCell>
                    <TableCell className="text-center">
                      <div className="text-gray-900 font-medium">{row.registration_type === "official" ? "Chính thức" : "Bổ sung"}</div>
                      <div className="text-xs text-gray-500">{row.exam_type}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="font-medium text-gray-900">{row.block_code}</div>
                      <div className="text-xs text-gray-600">{row.subject_name || row.subject_code}</div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-gray-700">
                      {(() => {
                        const start = row.open_at ? new Date(row.open_at) : (row.scheduled_at ? new Date(row.scheduled_at) : null);
                        const end = row.close_at ? new Date(row.close_at) : null;
                        
                        if (!start) return <span className="text-gray-400">N/A</span>;
                        
                        const startTime = format(start, "HH:mm");
                        const endTime = end ? format(end, "HH:mm") : null;
                        const dateStr = format(start, "dd/MM/yyyy");
                        
                        return (
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-gray-900">
                              {startTime}{endTime ? ` - ${endTime}` : ""}
                            </span>
                            <span className="text-gray-500">{dateStr}</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center">{getAssignmentBadge(row)}</TableCell>
                    <TableCell className="text-center text-xs text-gray-700">
                      {row.xu_ly_diem === 'đã duyệt' ? (
                        <div className="text-purple-700 font-semibold">Miễn (giải trình)</div>
                      ) : row.xu_ly_diem === 'từ chối' ? (
                        <>
                          <div className="text-red-700 font-semibold">Từ chối GT</div>
                          {row.tong_diem_bi_tru != null && (
                            <div className="text-gray-500">Trừ: {row.tong_diem_bi_tru}</div>
                          )}
                        </>
                      ) : row.score === null ? (
                        <div className="text-gray-400">Chưa có</div>
                      ) : (
                        <div className="font-semibold text-gray-900">{row.score}</div>
                      )}
                      <div className="text-gray-400 text-[11px]">{row.xu_ly_diem || '-'}</div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-gray-600">
                      {new Date(row.dang_ky_luc || row.created_at).toLocaleDateString("vi-VN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const xu = row.xu_ly_diem || '';
                        const examGraded =
                          row.assignment_status === 'graded' ||
                          (row.score !== null && Number(row.score) > 0);
                        if (xu === 'đã duyệt') {
                          return <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">Accepted</span>;
                        }
                        if (xu === 'từ chối') {
                          return <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">Rejected</span>;
                        }
                        /* Đã chấm điểm / xong bài — hiển thị Done trước, không bị «chờ giải trình» che (GT là bước sau khi đã có điểm) */
                        if (examGraded || xu === 'đã hoàn thành') {
                          return <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">Done</span>;
                        }
                        if (xu === 'chờ giải trình') {
                          return <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">Waiting</span>;
                        }
                        if (row.score !== null) {
                          return <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">Done</span>;
                        }
                        return <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">Pending</span>;
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {total > 0 ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-xs text-gray-600 sm:text-left">
                Hiển thị{" "}
                <span className="font-semibold text-gray-800">
                  {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length}
                </span>{" "}
                trong{" "}
                <span className="font-semibold text-gray-800">{total}</span> bản ghi
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchRows(1)}
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Đầu
                </button>
                <button
                  type="button"
                  onClick={() => void fetchRows(page - 1)}
                  disabled={page <= 1 || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Trước
                </button>
                <span className="min-w-[8rem] text-center text-xs font-medium text-gray-700 tabular-nums">
                  Trang {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => void fetchRows(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void fetchRows(totalPages)}
                  disabled={page >= totalPages || loading}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cuối
                </button>
              </div>
            </div>
          ) : null}
          </>
        )}
      </Card>

      <Dialog open={importLogOpen} onOpenChange={setImportLogOpen}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Kết quả import từng dòng</DialogTitle>
            <p className="text-left text-sm text-gray-600">
              {importLog ? (
                <>
                  File: <span className="font-medium text-gray-900">{importLog.fileName}</span> — Thành công{" "}
                  <span className="font-semibold text-green-700">{importLog.imported}</span> / {importLog.total} dòng
                  {importLog.failedCount > 0 ? (
                    <>
                      , <span className="font-semibold text-red-700">{importLog.failedCount}</span> dòng không ghi được DB
                    </>
                  ) : null}
                  . Số dòng file = dòng tiêu đề (1) + dữ liệu; cột «Dòng» là số dòng trên file Excel/CSV.
                </>
              ) : null}
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-14 text-center">Dòng</TableHead>
                  <TableHead className="min-w-[180px]">Dữ liệu (tóm tắt)</TableHead>
                  <TableHead className="w-28 text-center">Trạng thái</TableHead>
                  <TableHead className="min-w-[220px]">Ghi chú / Lỗi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importLog?.results.map((res, idx) => {
                  const src = importLog.sourceRows[idx] ?? {};
                  const detailOk =
                    res.ok && res.id != null ? `Đã ghi DB — id đăng ký: ${String(res.id)}` : res.ok ? "Đã ghi DB" : "";
                  const detailErr = !res.ok
                    ? [
                        res.error ?? "Lỗi không xác định",
                        res.result_id != null ? `(id bản ghi liên quan: ${res.result_id})` : "",
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : "";
                  return (
                    <TableRow key={`${res.line}-${idx}`}>
                      <TableCell className="text-center font-mono text-sm text-gray-700">{res.line}</TableCell>
                      <TableCell className="max-w-[280px] text-xs text-gray-800 sm:max-w-md">
                        <span className="line-clamp-3 break-words" title={previewImportRow(src)}>
                          {previewImportRow(src)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {res.ok ? (
                          <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-green-700">
                            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-red-700">
                            <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                            Lỗi
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-800">
                        {res.ok ? (
                          <span className="text-green-800">{detailOk}</span>
                        ) : (
                          <span className="text-red-800">{detailErr}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <p className="mr-auto text-left text-xs text-gray-500">
              Nếu lỗi «Không tìm thấy môn học» hoặc «Thiếu Mã GV», kiểm tra đúng mã trong hệ thống và file mẫu.
            </p>
            <button
              type="button"
              onClick={() => setImportLogOpen(false)}
              className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a0019]"
            >
              Đóng
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmStopImportOpen} onOpenChange={setConfirmStopImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dừng import?</DialogTitle>
            <DialogDescription className="text-left text-sm text-gray-600">
              Bạn có chắc muốn dừng? Các dòng đã gửi và ghi thành công vẫn được lưu. Các lô chưa gửi sẽ không được nhập.
              Request đang chạy (nếu có) sẽ bị hủy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmStopImportOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Tiếp tục import
            </button>
            <button
              type="button"
              onClick={confirmStopImport}
              className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a0019]"
            >
              Dừng import
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
    </>
  );
}
