"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stepper } from "@/components/ui/stepper";
import { ClipboardList, Search } from "lucide-react";
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
      <div className="w-[300px]">
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
                      <div>Scheduled: {new Date(row.scheduled_at).toLocaleString("vi-VN")}</div>
                      {row.open_at && <div>Mở: {new Date(row.open_at).toLocaleString("vi-VN")}</div>}
                      {row.close_at && <div>Đóng: {new Date(row.close_at).toLocaleString("vi-VN")}</div>}
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
                      {new Date(row.created_at).toLocaleString("vi-VN")}
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
