"use client";

import { Card } from "@/components/Card";
import Modal from "@/components/Modal";
import { PageContainer } from "@/components/PageContainer";
import { cn } from "@/lib/utils";
import { ArrowLeft, ListChecks, PlusCircle, Shuffle, Star, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ExamSetRecord, getSetsBySubject, getSubjectById, inferLevel } from "../../subject-mapping";

export default function SubjectDetailPage() {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params?.subjectId;
  const [sets, setSets] = useState<ExamSetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingSetId, setDeletingSetId] = useState<number | null>(null);
  const [updatingStatusSetId, setUpdatingStatusSetId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [setName, setSetName] = useState("");
  const [totalPoints, setTotalPoints] = useState(10);
  const [passingScore, setPassingScore] = useState(7);
  const [status, setStatus] = useState<"active" | "inactive">("active");

  // ─── Monthly selection state ───────────────────────────────────────
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  interface MonthlySelection {
    set_id: number | null;
    set_code: string | null;
    set_name: string | null;
    selection_mode: "manual" | "random";
  }
  const [monthlySelection, setMonthlySelection] = useState<MonthlySelection | null>(null);
  const [isDefaultModalOpen, setIsDefaultModalOpen] = useState(false);
  const [defaultSelectedSetId, setDefaultSelectedSetId] = useState<number | "">("");
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [isRemovingSelection, setIsRemovingSelection] = useState(false);
  const [subjectDbId, setSubjectDbId] = useState<number | null>(null);

  const subject = useMemo(() => {
    if (!subjectId) return undefined;
    return getSubjectById(subjectId);
  }, [subjectId]);

  const subjectSets = useMemo(() => {
    if (!subject) return [];
    return getSetsBySubject(sets, subject);
  }, [sets, subject]);

  const fetchSets = async () => {
    if (!subject) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/exam-sets?subject_code=${encodeURIComponent(subject.label)}`);
      const data = await response.json();

      if (data.success) {
        const rows = (data.data || []) as Array<ExamSetRecord & { subject_id?: number }>;
        setSets(rows);
        setSubjectDbId(rows[0]?.subject_id ?? null);
      } else {
        toast.error(data.error || "Không thể tải danh sách bộ đề");
      }
    } catch (error) {
      console.error("Error fetching exam sets:", error);
      toast.error("Có lỗi xảy ra khi tải danh sách bộ đề");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, [subject?.label]);

  // Fetch monthly selection cho tháng hiện tại
  const fetchMonthlySelection = async (dbId: number) => {
    try {
      const res = await fetch(
        `/api/monthly-exam-selections?subject_id=${dbId}&year=${currentYear}&month=${currentMonth}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        setMonthlySelection({
          set_id: data.data.set_id ?? null,
          set_code: data.data.set_code ?? null,
          set_name: data.data.set_name ?? null,
          selection_mode: data.data.selection_mode,
        });
      } else {
        setMonthlySelection(null);
      }
    } catch {
      setMonthlySelection(null);
    }
  };

  useEffect(() => {
    if (subjectDbId) {
      fetchMonthlySelection(subjectDbId);
    }
  }, [subjectDbId]);

  const resetCreateForm = () => {
    setSetName("");
    setTotalPoints(10);
    setPassingScore(7);
    setStatus("active");
  };

  const handleOpenCreateModal = () => {
    resetCreateForm();
    setIsCreateModalOpen(true);
  };

  const handleCreateSet = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!subject) {
      toast.error("Không tìm thấy môn để tạo bộ đề");
      return;
    }

    if (!setName.trim()) {
      toast.error("Vui lòng nhập tên đề");
      return;
    }

    if (passingScore > totalPoints) {
      toast.error("Điểm đạt không được lớn hơn tổng điểm");
      return;
    }

    try {
      setIsCreating(true);
      const response = await fetch("/api/exam-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_type: subject.examType,
          block_code: subject.blockCode,
          subject_code: subject.label,
          subject_name: subject.label,
          set_name: setName.trim(),
          total_points: totalPoints,
          passing_score: passingScore,
          status,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error(data.error || "Không thể tạo bộ đề");
        return;
      }

      toast.success("Tạo bộ đề thành công");
      setIsCreateModalOpen(false);
      await fetchSets();
    } catch (error) {
      console.error("Error creating exam set:", error);
      toast.error("Có lỗi xảy ra khi tạo bộ đề");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSet = async (set: ExamSetRecord) => {
    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa bộ đề ${set.set_code} - ${set.set_name}?`);
    if (!confirmed) return;

    try {
      setDeletingSetId(set.id);
      const response = await fetch(`/api/exam-sets?id=${set.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || "Không thể xóa bộ đề");
        return;
      }

      setSets((prev) => prev.filter((item) => item.id !== set.id));
      toast.success("Đã xóa bộ đề thành công");
    } catch (error) {
      console.error("Error deleting exam set:", error);
      toast.error("Có lỗi xảy ra khi xóa bộ đề");
    } finally {
      setDeletingSetId(null);
    }
  };

  const handleToggleSetStatus = async (set: ExamSetRecord) => {
    const nextStatus = set.status === "active" ? "inactive" : "active";

    try {
      setUpdatingStatusSetId(set.id);
      const response = await fetch("/api/exam-sets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: set.id,
          status: nextStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error(data.error || "Không thể cập nhật trạng thái bộ đề");
        return;
      }

      setSets((previous) =>
        previous.map((item) =>
          item.id === set.id
            ? { ...item, status: nextStatus }
            : item
        )
      );

      toast.success(nextStatus === "active" ? "Đã active bộ đề" : "Đã tắt active bộ đề");
    } catch (error) {
      console.error("Error toggling exam set status:", error);
      toast.error("Có lỗi xảy ra khi cập nhật trạng thái");
    } finally {
      setUpdatingStatusSetId(null);
    }
  };

  const handleSaveDefault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectDbId || !defaultSelectedSetId) return;

    try {
      setIsSavingDefault(true);
      const res = await fetch("/api/monthly-exam-selections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: subjectDbId,
          year: currentYear,
          month: currentMonth,
          selected_set_id: defaultSelectedSetId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Không thể lưu lựa chọn");
        return;
      }
      await fetchMonthlySelection(subjectDbId);
      toast.success("Đã lưu bộ đề mặc định cho tháng này");
      setIsDefaultModalOpen(false);
    } catch {
      toast.error("Có lỗi xảy ra khi lưu lựa chọn");
    } finally {
      setIsSavingDefault(false);
    }
  };

  const handleRandomize = async () => {
    if (!subjectDbId) {
      toast.error("Chưa xác định được môn học trong hệ thống");
      return;
    }
    try {
      setIsRandomizing(true);
      const res = await fetch("/api/monthly-exam-selections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_id: subjectDbId, year: currentYear, month: currentMonth }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Không thể chọn ngẫu nhiên");
        return;
      }
      await fetchMonthlySelection(subjectDbId);
      toast.success(`Đã chọn ngẫu nhiên: ${data.picked?.set_code} – ${data.picked?.set_name}`);
    } catch {
      toast.error("Có lỗi xảy ra khi chọn ngẫu nhiên");
    } finally {
      setIsRandomizing(false);
    }
  };

  const handleRemoveSelection = async () => {
    if (!subjectDbId) {
      toast.error("Chưa xác định được môn học trong hệ thống");
      return;
    }

    try {
      setIsRemovingSelection(true);
      const response = await fetch(
        `/api/monthly-exam-selections?subject_id=${subjectDbId}&year=${currentYear}&month=${currentMonth}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error(data.error || "Không thể xóa lựa chọn tháng");
        return;
      }

      setMonthlySelection(null);
      toast.success("Đã xóa lựa chọn bộ đề của tháng này");
    } catch {
      toast.error("Có lỗi xảy ra khi xóa lựa chọn tháng");
    } finally {
      setIsRemovingSelection(false);
    }
  };

  if (!subject) {
    return (
      <PageContainer title="Chi tiết bộ đề theo môn" description="Không tìm thấy môn học.">
        <Link
          href="/admin/page4/thu-vien-de"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Library
        </Link>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Chi tiết bộ đề theo môn"
      description={`${subject.label} • Tổng ${subjectSets.length} bộ đề`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/admin/page4/thu-vien-de"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Library
        </Link>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          <span className="inline-flex items-center gap-1.5">
            <PlusCircle className="h-4 w-4" />
            Tạo bộ đề mới
          </span>
        </button>
      </div>

      {/* Banner bộ đề được chọn cho tháng */}
      {monthlySelection?.set_code && (
        <div className={cn(
          "mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3",
          monthlySelection.selection_mode === "random"
            ? "border-blue-200 bg-blue-50"
            : "border-amber-200 bg-amber-50"
        )}>
          <div className="flex min-w-0 items-center gap-3">
            {monthlySelection.selection_mode === "random"
              ? <Shuffle className="h-4 w-4 shrink-0 text-blue-600" />
              : <Star className="h-4 w-4 shrink-0 text-amber-600" />
            }
            <div className="min-w-0">
              <p className={cn("text-xs font-semibold uppercase tracking-wider",
                monthlySelection.selection_mode === "random" ? "text-blue-600" : "text-amber-600"
              )}>
                Bộ đề tháng {currentMonth}/{currentYear}
                {monthlySelection.selection_mode === "random" ? " (Ngẫu nhiên)" : " (Mặc định)"}
              </p>
              <p className="truncate text-sm font-semibold text-gray-900">
                {monthlySelection.set_code} — {monthlySelection.set_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveSelection}
            disabled={isRemovingSelection}
            className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isRemovingSelection ? "Đang xóa..." : "Remove"}
          </button>
        </div>
      )}

      <Card className="rounded-xl" padding="md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gray-100 p-2">
              <ListChecks className="h-5 w-5 text-gray-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{subject.label}</h2>
              <p className="text-sm text-gray-500">Danh sách đầy đủ bộ đề của môn</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!subjectDbId || subjectSets.length === 0}
              onClick={() => {
                setDefaultSelectedSetId(monthlySelection?.set_id ?? "");
                setIsDefaultModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Star className="h-3.5 w-3.5" />
              Mặc định
            </button>
            <button
              type="button"
              disabled={isRandomizing || !subjectDbId || subjectSets.length === 0}
              onClick={handleRandomize}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-400 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Shuffle className="h-3.5 w-3.5" />
              {isRandomizing ? "Đang chọn..." : "Ngẫu nhiên"}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Đang tải danh sách bộ đề...</p>
        ) : subjectSets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">Môn này chưa có bộ đề.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {subjectSets.map((set) => {
              const level = inferLevel(set);

              return (
                <div
                  key={set.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", level.className)}>
                        {level.label}
                      </span>
                      <span className="truncate text-sm font-semibold text-gray-900">{set.set_code}</span>
                    </div>
                    <p className="truncate text-sm text-gray-600">{set.set_name}</p>
                    <p className="text-xs text-gray-500">{set.total_points} điểm • Đạt {set.passing_score}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-2 py-1 text-[11px] font-semibold",
                        set.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {set.status}
                    </span>
                    <Link
                      href={`/admin/page4/thu-vien-de/questions?set_id=${set.id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <SquarePen className="h-3.5 w-3.5" />
                      Quản lý câu hỏi
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleToggleSetStatus(set)}
                      disabled={updatingStatusSetId === set.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                        set.status === "active"
                          ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                          : "border-green-300 text-green-700 hover:bg-green-50"
                      )}
                    >
                      {updatingStatusSetId === set.id
                        ? "Đang cập nhật..."
                        : set.status === "active"
                          ? "Inactive"
                          : "Active"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSet(set)}
                      disabled={deletingSetId === set.id}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingSetId === set.id ? "Đang xóa..." : "Xóa đề"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo bộ đề mới"
        subtitle={`Môn: ${subject.label}`}
        maxWidth="md"
        headerColor="from-[#a1001f] to-[#c41230]"
      >
        <form onSubmit={handleCreateSet} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tên đề</label>
            <input
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="Nhập tên bộ đề"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tổng điểm</label>
              <input
                type="number"
                min={1}
                value={totalPoints}
                onChange={(e) => setTotalPoints(Number(e.target.value || 10))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Điểm đạt</label>
              <input
                type="number"
                min={0}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value || 7))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Trạng thái</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              <PlusCircle className="h-4 w-4" />
              {isCreating ? "Đang tạo..." : "Tạo đề"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal chọn bộ đề mặc định cho tháng */}
      <Modal
        isOpen={isDefaultModalOpen}
        onClose={() => setIsDefaultModalOpen(false)}
        title={`Chọn bộ đề mặc định – Tháng ${currentMonth}/${currentYear}`}
        subtitle={`Môn: ${subject.label}`}
        maxWidth="md"
        headerColor="from-[#92400e] to-[#d97706]"
      >
        <form onSubmit={handleSaveDefault} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Chọn bộ đề</label>
            <select
              required
              value={defaultSelectedSetId}
              onChange={(e) => setDefaultSelectedSetId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">-- Chọn bộ đề --</option>
              {subjectSets
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.set_code} – {s.set_name}
                  </option>
                ))}
            </select>
            {subjectSets.length === 0 && (
              <p className="mt-1 text-xs text-red-500">Không có bộ đề nào để chọn.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDefaultModalOpen(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSavingDefault || !defaultSelectedSetId}
              className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Star className="h-4 w-4" />
              {isSavingDefault ? "Đang lưu..." : "Lưu mặc định"}
            </button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
