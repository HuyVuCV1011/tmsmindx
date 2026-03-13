"use client";

import { Card } from "@/components/Card";
import Modal from "@/components/Modal";
import { PageContainer } from "@/components/PageContainer";
import { cn } from "@/lib/utils";
import { ArrowLeft, ListChecks, PlusCircle, SquarePen, Trash2 } from "lucide-react";
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

  const subject = useMemo(() => {
    if (!subjectId) return undefined;
    return getSubjectById(subjectId);
  }, [subjectId]);

  const subjectSets = useMemo(() => {
    if (!subject) return [];
    return getSetsBySubject(sets, subject);
  }, [sets, subject]);

  const fetchSets = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/exam-sets");
      const data = await response.json();

      if (data.success) {
        setSets(data.data || []);
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
  }, []);

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

      <Card className="rounded-xl" padding="md">
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-lg bg-gray-100 p-2">
            <ListChecks className="h-5 w-5 text-gray-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{subject.label}</h2>
            <p className="text-sm text-gray-500">Danh sách đầy đủ bộ đề của môn</p>
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
    </PageContainer>
  );
}
