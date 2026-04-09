"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { Stepper } from "@/components/ui/stepper";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ClipboardList, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface RegistrationRow {
  id: number;
  teacher_code: string;
  exam_type: "expertise" | "experience";
  registration_type: "official" | "additional";
  block_code: string;
  subject_code: string;
  subject_name: string | null;
  center_code: string | null;
  scheduled_at: string;
  source_form: "main_form" | "additional_form" | "system";
  created_at: string;
  assignment_id: number | null;
  assignment_status: string | null;
  score: number | null;
  score_status: string | null;
  open_at: string | null;
  close_at: string | null;
  selected_set_id: number | null;
  random_assigned_at: string | null;
  set_code: string | null;
  set_name: string | null;
  total_points: number | null;
  passing_score: number | null;
}

export default function ExamRegistrationListPage() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTeacherCode, setSearchTeacherCode] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [removingRegistrationId, setRemovingRegistrationId] = useState<number | null>(null);

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
    const assigned = !!row.assignment_id;
    const submitted = row.assignment_status === "submitted" || row.assignment_status === "graded";
    const graded = row.assignment_status === "graded";
    const expired = row.assignment_status === "expired";

    return (
      <div className="w-full sm:w-75">
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
              description: expired ? 'Quá hạn' : submitted ? 'Đã nộp' : assigned ? 'Đang làm' : 'Chưa',
              status: expired ? 'error' : submitted ? 'completed' : assigned ? 'current' : 'upcoming'
            },
            {
              id: 3,
              label: 'Chấm điểm',
              description: graded ? 'Hoàn tất' : submitted ? 'Chờ chấm' : 'Chưa',
              status: graded ? 'success' : submitted ? 'current' : 'upcoming'
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
                  <TableHead>#</TableHead>
                  <TableHead>Mã GV</TableHead>
                  <TableHead>Loại đăng ký</TableHead>
                  <TableHead>Khối / Môn</TableHead>
                  <TableHead>Lịch thi</TableHead>
                  <TableHead>Bộ đề random</TableHead>
                  <TableHead>Trạng thái assignment</TableHead>
                  <TableHead>Điểm</TableHead>
                  <TableHead>Nguồn form</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Thao tác HO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-gray-600">{index + 1}</TableCell>
                    <TableCell className="font-semibold text-gray-900">{row.teacher_code}</TableCell>
                    <TableCell>
                      <div className="text-gray-900 font-medium">{row.registration_type === "official" ? "Chính thức" : "Bổ sung"}</div>
                      <div className="text-xs text-gray-500">{row.exam_type}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{row.block_code}</div>
                      <div className="text-xs text-gray-600">{row.subject_name || row.subject_code}</div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-700">
                      {(() => {
                        const start = row.open_at ? new Date(row.open_at) : (row.scheduled_at ? new Date(row.scheduled_at) : null);
                        const end = row.close_at ? new Date(row.close_at) : null;
                        
                        if (!start) return <span className="text-gray-400">N/A</span>;
                        
                        const startTime = format(start, "HH:mm");
                        const endTime = end ? format(end, "HH:mm") : null;
                        const dateStr = format(start, "dd/MM/yyyy");
                        
                        return (
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">
                              {startTime}{endTime ? ` - ${endTime}` : ""}
                            </span>
                            <span className="text-gray-500">{dateStr}</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {row.set_code ? (
                        <>
                          <div className="text-gray-900 font-medium">{row.set_code}</div>
                          <div className="text-xs text-gray-600">{row.set_name}</div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">Chưa có</span>
                      )}
                    </TableCell>
                    <TableCell>{getAssignmentBadge(row)}</TableCell>
                    <TableCell className="text-xs text-gray-700">
                      <div>{row.score === null ? "Chưa có" : row.score}</div>
                      <div className="text-gray-500">{row.score_status || "-"}</div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-700 capitalize">{row.source_form.replace("_", " ")}</TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {new Date(row.created_at).toLocaleString("vi-VN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                    </TableCell>
                    <TableCell>
                      {row.assignment_id ? (
                        <button
                          onClick={() => handleSetPending(row)}
                          disabled={removingRegistrationId === row.id}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {removingRegistrationId === row.id ? "Đang xử lý..." : "Đưa về pending"}
                        </button>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Pending
                        </span>
                      )}
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
