"use client";

import { Card } from "@/components/Card";
import Modal from "@/components/Modal";
import { PageContainer } from "@/components/PageContainer";
import { cn } from "@/lib/utils";
import { BlockCode, ExamSetRecord, SUBJECT_CONFIGS, getSetsBySubject, inferLevel } from "./subject-mapping";
import { Bot, CalendarDays, CheckCircle2, Code2, Palette, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface EvaluationEvent {
  id: string;
  specialty: string;
  startAt: string;
  endAt: string;
  eventType?: "registration" | "exam" | "workshop_teaching" | "meeting" | "advanced_training_release" | "holiday";
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const mapSpecialtyToSubjectLabel = (specialty: string) => {
  const normalized = normalizeText(specialty);

  if (normalized.includes("scratch")) return "[COD] Scratch (S)";
  if (normalized.includes("gamemaker")) return "[COD] GameMaker (G)";
  if (normalized.includes("python")) return "[COD] Python (PT)";
  if (normalized.includes("web")) return "[COD] Web (JS)";
  if (normalized.includes("computerscience") || normalized.includes("cs")) return "[COD] Computer Science (CS)";
  if (normalized.includes("lego")) return "[ROB] Lego 4+";
  if (normalized.includes("vexgo")) return "[ROB] Vex Go";
  if (normalized.includes("vexiq")) return "[ROB] Vex IQ";
  if (normalized.includes("quytrinh") || normalized.includes("trainghiem")) return "Kiểm tra quy trình & kỹ năng trải nghiệm";
  if (normalized.includes("art") || normalized.includes("mythuat") || normalized.includes("dohoa")) return "[ART] Arts";

  return specialty;
};

interface BlockConfig {
  blockCode: BlockCode;
  label: string;
  description: string;
  icon: typeof Code2;
  iconWrapClass: string;
  iconClass: string;
  columnsClass: string;
}

const BLOCK_CONFIGS: BlockConfig[] = [
  {
    blockCode: "CODING",
    label: "Coding",
    description: "Danh sách bộ đề theo môn và cấp độ",
    icon: Code2,
    iconWrapClass: "bg-violet-100",
    iconClass: "text-violet-600",
    columnsClass: "grid-cols-1 md:grid-cols-3",
  },
  {
    blockCode: "ROBOTICS",
    label: "Robotics",
    description: "Danh sách bộ đề lắp ráp và lập trình robot",
    icon: Bot,
    iconWrapClass: "bg-orange-100",
    iconClass: "text-orange-600",
    columnsClass: "grid-cols-1 md:grid-cols-3",
  },
  {
    blockCode: "ART",
    label: "Art",
    description: "Danh sách bộ đề mỹ thuật và đồ họa",
    icon: Palette,
    iconWrapClass: "bg-pink-100",
    iconClass: "text-pink-600",
    columnsClass: "grid-cols-1",
  },
  {
    blockCode: "PROCESS",
    label: "KIỂM TRA QUY TRÌNH & KỸ NĂNG TRẢI NGHIỆM",
    description: "Đánh giá các kỹ năng mềm và quy trình làm việc",
    icon: CheckCircle2,
    iconWrapClass: "bg-green-100",
    iconClass: "text-green-600",
    columnsClass: "grid-cols-1",
  },
];


export default function ProfessionalAssignmentLibraryPage() {
  const [sets, setSets] = useState<ExamSetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedBlockCode, setSelectedBlockCode] = useState<BlockCode>("CODING");
  const [selectedSubjectId, setSelectedSubjectId] = useState("cod-scratch");
  const [setName, setSetName] = useState("");
  const [totalPoints, setTotalPoints] = useState(10);
  const [passingScore, setPassingScore] = useState(7);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [scheduleEvents, setScheduleEvents] = useState<EvaluationEvent[]>([]);

  const groupedByBlock = useMemo(() => {
    return BLOCK_CONFIGS.map((block) => {
      const subjects = SUBJECT_CONFIGS.filter((subject) => subject.blockCode === block.blockCode).map((subject) => {
        const subjectSets = getSetsBySubject(sets, subject);

        return {
          ...subject,
          sets: subjectSets,
        };
      });

      return {
        ...block,
        subjects,
      };
    });
  }, [sets]);

  const blockOptions = useMemo(() => {
    const blockMap = new Map<BlockCode, string>();
    SUBJECT_CONFIGS.filter((item) => item.examType === "expertise").forEach((item) => {
      if (!blockMap.has(item.blockCode)) {
        blockMap.set(item.blockCode, item.blockCode);
      }
    });

    return [
      { value: "CODING" as BlockCode, label: "Coding" },
      { value: "ROBOTICS" as BlockCode, label: "Robotics" },
      { value: "ART" as BlockCode, label: "Art" },
      { value: "PROCESS" as BlockCode, label: "Quy trình & trải nghiệm" },
    ].filter((item) => blockMap.has(item.value));
  }, []);

  const subjectOptions = useMemo(() => {
    return SUBJECT_CONFIGS.filter(
      (subject) => subject.examType === "expertise" && subject.blockCode === selectedBlockCode
    );
  }, [selectedBlockCode]);

  const selectedSubject = useMemo(() => {
    return subjectOptions.find((subject) => subject.id === selectedSubjectId) || subjectOptions[0];
  }, [subjectOptions, selectedSubjectId]);

  const fetchSets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/exam-sets');
      const data = await response.json();
      if (data.success) {
        setSets(data.data || []);
      } else {
        toast.error(data.error || 'Không thể tải danh sách bộ đề');
      }
    } catch (error) {
      console.error('Error fetching exam sets:', error);
      toast.error('Có lỗi xảy ra khi tải danh sách bộ đề');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/event-schedules');
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Không thể tải lịch sự kiện');
        }

        const rows = (data.data || []) as Array<{
          id: string;
          specialty: string | null;
          title: string;
          start_at: string;
          end_at: string;
          event_type: EvaluationEvent['eventType'];
        }>;

        setScheduleEvents(
          rows.map((item) => ({
            id: item.id,
            specialty: item.specialty || item.title,
            startAt: item.start_at,
            endAt: item.end_at,
            eventType: item.event_type,
          }))
        );
      } catch {
        setScheduleEvents([]);
      }
    })();
  }, []);

  const upcomingSubjectsInMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const examEvents = scheduleEvents
      .filter((event) => (event.eventType || "exam") === "exam")
      .map((event) => ({
        ...event,
        startDate: new Date(event.startAt),
        endDate: new Date(event.endAt),
      }))
      .filter((event) => !Number.isNaN(event.startDate.getTime()) && !Number.isNaN(event.endDate.getTime()))
      .filter((event) => event.startDate >= monthStart && event.startDate <= monthEnd)
      .filter((event) => event.endDate >= now);

    const map = new Map<string, { startAt: Date; endAt: Date }>();
    examEvents.forEach((event) => {
      const subjectLabel = mapSpecialtyToSubjectLabel(event.specialty);
      const existing = map.get(subjectLabel);
      if (!existing || event.startDate < existing.startAt) {
        map.set(subjectLabel, {
          startAt: event.startDate,
          endAt: event.endDate,
        });
      }
    });

    return Array.from(map.entries())
      .map(([label, value]) => ({
        label,
        startAt: value.startAt,
        endAt: value.endAt,
        isOpenNow: now >= value.startAt && now <= value.endAt,
      }))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [scheduleEvents]);

  useEffect(() => {
    if (!subjectOptions.some((subject) => subject.id === selectedSubjectId)) {
      setSelectedSubjectId(subjectOptions[0]?.id || "");
    }
  }, [selectedBlockCode, subjectOptions, selectedSubjectId]);

  const resetCreateForm = () => {
    setSelectedBlockCode("CODING");
    setSelectedSubjectId("cod-scratch");
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

    if (!selectedSubject) {
      toast.error("Vui lòng chọn môn");
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
          exam_type: selectedSubject.examType,
          block_code: selectedSubject.blockCode,
          subject_code: selectedSubject.label,
          subject_name: selectedSubject.label,
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

  return (
    <PageContainer
      title="Bộ đề đánh giá chuyên môn"
    >
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo đề kiểm tra chuyên môn
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
        <div className="mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-blue-700" />
          <p className="text-sm font-semibold text-blue-900">Bộ môn mở sắp tới trong tháng</p>
        </div>
        {upcomingSubjectsInMonth.length === 0 ? (
          <p className="text-xs text-blue-800/80">Chưa có lịch mở bộ môn nào trong tháng hiện tại.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {upcomingSubjectsInMonth.map((item) => (
              <span
                key={`${item.label}-${item.startAt.toISOString()}`}
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                  item.isOpenNow
                    ? "border-green-300 bg-green-50 text-green-800"
                    : "border-blue-200 bg-white text-blue-800"
                )}
                title={`Mở từ ${item.startAt.toLocaleString("vi-VN")} đến ${item.endAt.toLocaleString("vi-VN")}`}
              >
                {item.isOpenNow && <span className="mr-1 font-semibold">Đang mở •</span>}
                {item.label} • {item.startAt.toLocaleDateString("vi-VN")} • {item.startAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - {item.endAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {groupedByBlock.map((group) => {
          const Icon = group.icon;

          return (
            <Card key={group.blockCode} className="rounded-xl" padding="md">
              <div className="mb-4 flex items-start gap-3">
                <div className={cn("rounded-lg p-2", group.iconWrapClass)}>
                  <Icon className={cn("h-5 w-5", group.iconClass)} />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{group.label}</h2>
                  <p className="text-sm text-gray-500">{group.description}</p>
                </div>
              </div>

              <div className={cn("grid gap-3", group.columnsClass)}>
                {group.subjects.map((subject) => (
                  <div
                    key={`${group.blockCode}-${subject.id}`}
                    className={cn(
                      "rounded-lg border border-gray-200 bg-gray-50 p-3",
                      "min-h-30"
                    )}
                  >
                    <Link
                      href={`/admin/page4/thu-vien-de/subjects/${subject.id}`}
                      className="text-sm font-semibold text-gray-900 hover:text-red-700"
                    >
                      {subject.label}
                    </Link>
                    {subject.sets.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">{subject.sets.length} bộ đề</p>
                    )}

                    {subject.sets.length === 0 ? (
                      <p className="mt-1 text-xs text-gray-500">Chưa có bộ đề.</p>
                    ) : (
                      <>
                        <div className="mt-2 space-y-1.5">
                          {subject.sets.slice(0, 3).map((set) => {
                            const level = inferLevel(set);

                            return (
                              <div key={set.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", level.className)}>
                                    {level.label}
                                  </span>
                                  <span className="truncate text-xs text-gray-700">{set.set_code}</span>
                                </div>
                              </div>
                            );
                          })}
                          {subject.sets.length > 3 && (
                            <p className="text-[11px] text-gray-500">+ {subject.sets.length - 3} bộ đề khác</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {group.blockCode === "ART" && (
                <p className="mt-3 text-xs text-gray-500">* Mỗi môn tạo gồm 3 cấp độ (Basic, Advanced, Intensive).</p>
              )}
            </Card>
          );
        })}
      </div>

      {loading && (
        <div className="mt-4 text-sm text-gray-500">Đang tải danh sách bộ đề...</div>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo đề kiểm tra chuyên môn"
        subtitle="Tạo trực tiếp trong Library, không chuyển trang"
        maxWidth="md"
        headerColor="from-[#a1001f] to-[#c41230]"
      >
        <form onSubmit={handleCreateSet} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Khối</label>
            <select
              value={selectedBlockCode}
              onChange={(e) => setSelectedBlockCode(e.target.value as BlockCode)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {blockOptions.map((block) => (
                <option key={block.value} value={block.value}>
                  {block.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Môn</label>
            <select
              value={selectedSubject?.id || ""}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label}
                </option>
              ))}
            </select>
          </div>

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
