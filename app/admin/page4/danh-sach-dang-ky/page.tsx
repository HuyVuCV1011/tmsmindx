"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { Stepper } from "@/components/ui/stepper";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseCsvToRows } from "@/lib/csv-registration-import";
import { parseXlsxRegistrationSheet } from "@/lib/xlsx-registration-import";
import { format } from "date-fns";
import { ClipboardList, Download, FileDown, Info, Search, Upload } from "lucide-react";
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

export default function ExamRegistrationListPage() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTeacherCode, setSearchTeacherCode] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [removingRegistrationId, setRemovingRegistrationId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRows = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (searchTeacherCode.trim()) {
        params.set("teacher_code", searchTeacherCode.trim());
      }
      if (selectedMonth !== "all") {
        params.set("month", selectedMonth);
      }

      const response = await fetch(`/api/exam-registrations?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setRows(data.data || []);
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
    fetchRows();
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
      await fetchRows();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể đưa về pending');
    } finally {
      setRemovingRegistrationId(null);
    }
  };

  const exportCsv = () => {
    const getHoStatus = (row: RegistrationRow) => {
      const xu = row.xu_ly_diem || '';
      if (xu === 'đã duyệt') return 'Accepted';
      if (xu === 'từ chối') return 'Rejected';
      if (xu === 'chờ giải trình') return 'Waiting';
      if (row.score !== null || xu === 'đã hoàn thành') return 'Done';
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
    const csvRows = rows.map((row, i) => {
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
    if (!file) return;
    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith(".xlsx");
    if (!name.endsWith(".csv") && !isXlsx) {
      toast.error("Chỉ chấp nhận file .csv hoặc .xlsx");
      return;
    }

    setImporting(true);
    try {
      let rows: Record<string, string>[];
      if (isXlsx) {
        const ab = await file.arrayBuffer();
        ({ rows } = parseXlsxRegistrationSheet(ab));
      } else {
        const text = await file.text();
        ({ rows } = parseCsvToRows(text));
      }
      if (rows.length === 0) {
        toast.error("Không có dòng dữ liệu (sau khi bỏ dòng # và dòng trống).");
        return;
      }

      const response = await fetch("/api/exam-registrations/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Import thất bại");
      }

      const failed = (data.results as { ok: boolean; line: number; error?: string }[]).filter((r) => !r.ok);
      if (failed.length > 0) {
        console.warn("Import — các dòng lỗi:", failed);
        toast.error(
          `Đã import ${data.imported}/${data.total} dòng. ${failed.length} dòng lỗi — mở Console (F12) để xem chi tiết.`
        );
      } else {
        toast.success(`Đã import thành công ${data.imported} dòng.`);
      }
      await fetchRows();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể import file";
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const monthOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach((row) => {
      if (!row.scheduled_at) return;
      const date = new Date(row.scheduled_at);
      const month = `${date.getMonth() + 1}`.padStart(2, "0");
      options.add(`${date.getFullYear()}-${month}`);
    });
    return Array.from(options).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const getAssignmentBadge = (row: RegistrationRow) => {
    const gtPending = row.xu_ly_diem === 'chờ giải trình';
    const gtApproved = row.xu_ly_diem === 'đã duyệt';
    const gtRejected = row.xu_ly_diem === 'từ chối';
    const hasGiaiTrinh = row.da_giai_thich || gtPending || gtApproved || gtRejected;

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
                description: gtApproved ? 'Giải trình\n(Đã duyệt)' : gtRejected ? 'Giải trình\n(Từ chối)' : 'Chờ',
                status: gtApproved ? 'success' : gtRejected ? 'error' : 'upcoming'
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
    <PageContainer
      title="Danh sách đăng ký đánh giá chuyên môn"
      description="Tổng hợp toàn bộ thông tin đăng ký kiểm tra chuyên môn của giáo viên"
    >
      <Card padding="lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#a1001f]" />
            <h2 className="text-base font-bold text-gray-900">Danh sách đăng ký</h2>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
              {rows.length} bản ghi
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchTeacherCode}
                onChange={(e) => setSearchTeacherCode(e.target.value)}
                placeholder="Lọc theo mã GV"
                className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm w-full sm:w-48"
              />
            </div>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
            >
              <option value="all">Tất cả tháng</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>

            <button
              onClick={fetchRows}
              className="px-3 py-2 rounded-lg bg-[#a1001f] text-white text-sm font-medium hover:bg-[#8a0019]"
            >
              Tải dữ liệu
            </button>
            <button
              onClick={exportCsv}
              disabled={rows.length === 0}
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
          </div>
        </div>

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
              <strong>Import CSV hoặc Excel (.xlsx):</strong> cột giống <strong>Xuất dữ liệu</strong> (Mã GV, Loại đăng ký, Khối, Mã môn, Môn, Lịch thi dạng{" "}
              <code className="bg-gray-100 px-1 rounded">HH:mm dd/MM/yyyy</code>
              , …). Tải{" "}
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
                    <TableCell className="text-center text-gray-600">{index + 1}</TableCell>
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
                        if (xu === 'đã duyệt') {
                          return <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">Accepted</span>;
                        }
                        if (xu === 'từ chối') {
                          return <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">Rejected</span>;
                        }
                        if (xu === 'chờ giải trình') {
                          return <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">Waiting</span>;
                        }
                        if (row.score !== null || xu === 'đã hoàn thành') {
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
        )}
      </Card>
    </PageContainer>
  );
}
