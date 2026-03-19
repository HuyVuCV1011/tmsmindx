"use client";

import { Card } from "@/components/Card";
import Modal from "@/components/Modal";
import { PageContainer } from "@/components/PageContainer";
import { cn } from "@/lib/utils";
import { BlockCode, ExamSetRecord, SUBJECT_CONFIGS, getSetsBySubject, inferLevel } from "./subject-mapping";
import { Bot, CalendarDays, CheckCircle2, Code2, GripVertical, Palette, PlusCircle, ChevronLeft, ChevronRight } from "lucide-react";
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

interface PlannedEvent {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  registrationTemplate: "official" | "supplementary";
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDate(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getDurationMins(startStr: string, endStr: string) {
  const [h1, m1] = startStr.split(":").map(Number);
  const [h2, m2] = endStr.split(":").map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function addMinutesToTime(timeStr: string, minsToAdd: number) {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMins = h * 60 + m + minsToAdd;
  const newH = Math.floor(totalMins / 60) % 24;
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function formatDateKey(date: Date) {
  const pad = (v: number) => v.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildCalendarCells(focusDate: Date) {
  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  const monthStartDay = monthStart.getDay();
  const diff = monthStartDay === 0 ? -6 : 1 - monthStartDay;
  gridStart.setDate(monthStart.getDate() + diff);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inCurrentMonth: date.getMonth() === focusDate.getMonth() };
  });
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

  const [isAutoCreateModalOpen, setIsAutoCreateModalOpen] = useState(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  
  const [autoStartDate, setAutoStartDate] = useState(() => {
    const start = new Date();
    start.setDate(1);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  });
  const [autoEndDate, setAutoEndDate] = useState(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + 1, 0);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  });
  const [autoStartTime, setAutoStartTime] = useState("19:00");
  const [autoEndTime, setAutoEndTime] = useState("21:00");

  const [plannedEvents, setPlannedEvents] = useState<PlannedEvent[]>([]);
  const [history, setHistory] = useState<PlannedEvent[][]>([]);
  const [future, setFuture] = useState<PlannedEvent[][]>([]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState(new Date());

  const commitPlannedEvents = (nextState: PlannedEvent[]) => {
    setHistory((prev) => [...prev, plannedEvents]);
    setFuture([]);
    setPlannedEvents(nextState);
  };

  const handleOpenAutoCreateModal = () => {
    setHistory([]);
    setFuture([]);
    setPlannedEvents(
      SUBJECT_CONFIGS.filter((s) => s.examType === "expertise" || s.examType === "experience").map((s) => ({
        id: s.id,
        label: s.label,
        startDate: autoStartDate,
        endDate: autoEndDate,
        startTime: "19:00",
        endTime: "21:00",
        registrationTemplate: "official",
      }))
    );
    setIsAutoCreateModalOpen(true);
  };

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

  const fetchScheduleEvents = async () => {
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
  };

  useEffect(() => {
    fetchScheduleEvents();
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

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === dropId) return;

    const draggedIndex = plannedEvents.findIndex((item) => item.id === draggedId);
    const dropIndex = plannedEvents.findIndex((item) => item.id === dropId);
    if (draggedIndex === -1 || dropIndex === -1) return;

    const next = [...plannedEvents];
    const [removed] = next.splice(draggedIndex, 1);
    next.splice(dropIndex, 0, removed);
    commitPlannedEvents(next);
    setDraggedId(null);
  };

  const handleCalendarDrop = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    if (!draggedId) return;

    const durationMins = getDurationMins(autoStartTime, autoEndTime) || 120;
    
    let newStart = autoStartTime;
    const existingOnDate = plannedEvents.filter(p => p.startDate === dateKey && p.endDate === dateKey && p.id !== draggedId);
    
    if (existingOnDate.length > 0) {
      let maxEnd = "00:00";
      existingOnDate.forEach(evt => {
        if (evt.endTime > maxEnd) maxEnd = evt.endTime;
      });
      newStart = maxEnd;
    }

    const newEnd = addMinutesToTime(newStart, durationMins);

    const next = plannedEvents.map((item) =>
      item.id === draggedId
        ? { ...item, startDate: dateKey, endDate: dateKey, startTime: newStart, endTime: newEnd }
        : item
    );
    commitPlannedEvents(next);
    setDraggedId(null);
  };

  const updatePlannedEvent = (id: string, field: keyof PlannedEvent, value: string) => {
    const next = plannedEvents.map((evt) => (evt.id === id ? { ...evt, [field]: value } : evt));
    commitPlannedEvents(next);
  };

  const applyMasterDatesToAll = () => {
    const durationMins = getDurationMins(autoStartTime, autoEndTime) || 120;
    let currentStart = autoStartTime;
    
    const next = plannedEvents.map((evt) => {
      const assignedStart = currentStart;
      const assignedEnd = addMinutesToTime(assignedStart, durationMins);
      currentStart = assignedEnd;

      return {
        ...evt,
        startDate: autoStartDate,
        endDate: autoEndDate,
        startTime: assignedStart,
        endTime: assignedEnd,
      };
    });
    commitPlannedEvents(next);
  };

  const applyMasterDatesSequentially = () => {
    if (!autoStartDate) return;
    const start = new Date(autoStartDate);
    const next = plannedEvents.map((evt, idx) => {
      const d = new Date(start);
      d.setDate(d.getDate() + idx);
      const dateKey = formatDateKey(d);
      return {
        ...evt,
        startDate: dateKey,
        endDate: dateKey,
        startTime: autoStartTime,
        endTime: autoEndTime,
      };
    });
    commitPlannedEvents(next);
  };

  useEffect(() => {
    if (!isAutoCreateModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        setHistory((prevHistory) => {
          if (prevHistory.length === 0) return prevHistory;
          const prev = prevHistory[prevHistory.length - 1];
          setFuture((prevFuture) => [plannedEvents, ...prevFuture]);
          setPlannedEvents(prev);
          return prevHistory.slice(0, -1);
        });
      }

      // Ctrl + Y or Ctrl + Shift + Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        setFuture((prevFuture) => {
          if (prevFuture.length === 0) return prevFuture;
          const next = prevFuture[0];
          setHistory((prevHistory) => [...prevHistory, plannedEvents]);
          setPlannedEvents(next);
          return prevFuture.slice(1);
        });
      }

      // Arrow navigation
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") {
        return;
      }
      if (e.key === "ArrowLeft") {
        setFocusDate((prev) => {
          const d = new Date(prev);
          d.setMonth(d.getMonth() - 1);
          return d;
        });
      }
      if (e.key === "ArrowRight") {
        setFocusDate((prev) => {
          const d = new Date(prev);
          d.setMonth(d.getMonth() + 1);
          return d;
        });
      }

      // Ctrl + S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!isAutoCreating) {
          handleAutoCreateEvents();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAutoCreateModalOpen, history, future, plannedEvents, isAutoCreating]);

  const getAutoEventTitle = (label: string) => {
    if (label.toLowerCase().includes("quy trình")) {
      return "Kiểm tra quy trình - kỹ năng trải nghiệm";
    }
    return `Kiểm tra chuyên sâu ${label}`;
  };

  const handleAutoCreateEvents = async (evt?: React.FormEvent) => {
    if (evt) evt.preventDefault();
    if (plannedEvents.some(p => p.endDate < p.startDate)) {
      toast.error("Có bộ môn có ngày kết thúc trước ngày bắt đầu!");
      return;
    }

    try {
      setIsAutoCreating(true);
      let successCount = 0;
      
      for (const planned of plannedEvents) {
        const response = await fetch("/api/event-schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: getAutoEventTitle(planned.label),
            event_type: "exam",
            specialty: planned.label,
            registration_template: planned.registrationTemplate,
            start_at: `${planned.startDate}T${planned.startTime}:00`,
            end_at: `${planned.endDate}T${planned.endTime}:59`,
            note: "Lịch kiểm tra tạo tự động",
          }),
        });
        
        if (response.ok) {
          successCount++;
        }
      }
      
      toast.success(`Khởi tạo thành công ${successCount} sự kiện kiểm tra.`);
      setIsAutoCreateModalOpen(false);
      await fetchScheduleEvents();
    } catch (error) {
      console.error("Error auto creating events:", error);
      toast.error("Có lỗi xảy ra khi tạo sự kiện tự động");
    } finally {
      setIsAutoCreating(false);
    }
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
      <div className="mb-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={handleOpenAutoCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <CalendarDays className="h-4 w-4" />
          Tạo sự kiện tự động
        </button>
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

      <Modal
        isOpen={isAutoCreateModalOpen}
        onClose={() => setIsAutoCreateModalOpen(false)}
        title="Khởi tạo lịch kiểm tra hằng tháng (Visual Calendar)"
        subtitle="Kéo các môn học từ danh sách bên trái và thả vào Lịch để gán ngày kiểm tra."
        maxWidth="6xl"
        headerColor="from-[#1e3a8a] to-[#2563eb]"
      >
        <form onSubmit={handleAutoCreateEvents} className="flex flex-col h-[650px]">
          <div className="flex flex-1 gap-6 overflow-hidden">
            <div className="w-[360px] flex flex-col border-r border-gray-200 pr-4">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="font-bold text-gray-800 text-sm">Danh sách chờ lên lịch</h3>
              </div>
              
              <div className="text-xs text-blue-600 bg-blue-50 p-2 mb-3 rounded border border-blue-100">
                 * Kéo từ đây thả vào Lịch bên phải. Môn đứng trên cùng sẽ được tạo đầu tiên.
              </div>
              
              <div className="flex flex-col gap-2 p-2 mb-3 bg-gray-50 rounded border border-gray-200">
                <div className="flex gap-2 w-full">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-wider font-semibold text-gray-500">Từ ngày (Chung)</label>
                    <input
                      type="date"
                      value={autoStartDate}
                      onChange={(e) => setAutoStartDate(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-wider font-semibold text-gray-500">Đến (Chung)</label>
                    <input
                      type="date"
                      value={autoEndDate}
                      onChange={(e) => setAutoEndDate(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div className="flex gap-2 w-full mt-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-wider font-semibold text-gray-500">Giờ BĐ (Chung)</label>
                    <input
                      type="time"
                      value={autoStartTime}
                      onChange={(e) => setAutoStartTime(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-wider font-semibold text-gray-500">Giờ KT (Chung)</label>
                    <input
                      type="time"
                      value={autoEndTime}
                      onChange={(e) => setAutoEndTime(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                  </div>
                </div>
                <div className="flex gap-2 w-full mt-2">
                  <button
                    type="button"
                    title="Gán tất cả môn chung 1 khoảng thời gian"
                    onClick={applyMasterDatesToAll}
                    className="flex-1 rounded bg-gray-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                  >
                    Cùng ngày
                  </button>
                  <button
                    type="button"
                    title="Từ ngày bắt đầu, gán tuần tự mỗi ngày 1 môn"
                    onClick={applyMasterDatesSequentially}
                    className="flex-1 rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Tuần tự (+1)
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-4">
                {plannedEvents.map((evt) => (
                  <div
                    key={evt.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, evt.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, evt.id)}
                    className={cn(
                      "flex flex-col gap-2 rounded-md border p-2 bg-white transition-colors cursor-move",
                      draggedId === evt.id ? "opacity-50 border-blue-400 shadow-sm" : "border-gray-200 hover:border-gray-300 shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-2">
                       <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                       <span className="font-semibold text-sm text-gray-900 truncate" title={evt.label}>{evt.label}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 pl-6">
                       <select
                         value={evt.registrationTemplate}
                         onChange={(e) => updatePlannedEvent(evt.id, "registrationTemplate", e.target.value)}
                         className="flex-1 rounded border border-gray-300 px-2 py-1 text-[11px] bg-gray-50"
                       >
                         <option value="official">ĐK Chính thức</option>
                         <option value="supplementary">ĐK Bổ sung</option>
                       </select>
                    </div>

                    <div className="flex items-center gap-1 pl-6">
                       <input
                         type="date"
                         required
                         value={evt.startDate}
                         onChange={(e) => updatePlannedEvent(evt.id, "startDate", e.target.value)}
                         className="w-[45%] rounded border border-gray-300 px-1 py-1 text-[11px]"
                       />
                       <span className="text-gray-400 text-xs text-center w-[10%]">-</span>
                       <input
                         type="date"
                         required
                         value={evt.endDate}
                         onChange={(e) => updatePlannedEvent(evt.id, "endDate", e.target.value)}
                         className="w-[45%] rounded border border-gray-300 px-1 py-1 text-[11px]"
                       />
                    </div>
                    <div className="flex items-center gap-1 pl-6">
                       <input
                         type="time"
                         required
                         value={evt.startTime}
                         onChange={(e) => updatePlannedEvent(evt.id, "startTime", e.target.value)}
                         className="w-[45%] rounded border border-gray-300 px-1 py-1 text-[11px]"
                       />
                       <span className="text-gray-400 text-xs text-center w-[10%]">-</span>
                       <input
                         type="time"
                         required
                         value={evt.endTime}
                         onChange={(e) => updatePlannedEvent(evt.id, "endTime", e.target.value)}
                         className="w-[45%] rounded border border-gray-300 px-1 py-1 text-[11px]"
                       />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
               <div className="flex items-center justify-between mb-3 bg-gray-50 p-2 rounded border border-gray-200">
                  <div className="font-bold text-lg text-blue-900">
                    Tháng {focusDate.getMonth() + 1} - Năm {focusDate.getFullYear()}
                  </div>
                  <div className="flex items-center gap-1">
                     <button
                       type="button"
                       onClick={() => {
                         const d = new Date(focusDate);
                         d.setMonth(d.getMonth() - 1);
                         setFocusDate(d);
                       }}
                       className="rounded p-1.5 hover:bg-gray-200 text-gray-700"
                     >
                        <ChevronLeft className="h-5 w-5" />
                     </button>
                     <button
                       type="button"
                       onClick={() => setFocusDate(new Date())}
                       className="rounded px-3 py-1.5 hover:bg-gray-200 text-sm font-medium text-gray-700"
                     >
                       Hôm nay
                     </button>
                     <button
                       type="button"
                       onClick={() => {
                         const d = new Date(focusDate);
                         d.setMonth(d.getMonth() + 1);
                         setFocusDate(d);
                       }}
                       className="rounded p-1.5 hover:bg-gray-200 text-gray-700"
                     >
                        <ChevronRight className="h-5 w-5" />
                     </button>
                  </div>
               </div>

               <div className="flex-1 flex flex-col bg-white border-l border-t border-gray-200">
                 <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 h-10">
                    {WEEKDAY_LABELS.map(w => (
                       <div key={w} className="border-r border-gray-200 flex items-center justify-center font-bold text-gray-600 text-sm">
                          {w}
                       </div>
                    ))}
                 </div>
                 <div className="grid grid-cols-7 flex-1 min-h-0">
                    {buildCalendarCells(focusDate).map((cell, idx) => {
                       const cellKey = formatDateKey(cell.date);
                       const eventsOnDay = plannedEvents.filter(p => p.startDate === cellKey);
                       const isToday = isSameDate(startOfDay(cell.date), startOfDay(new Date()));
                       
                       return (
                          <div
                            key={idx}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleCalendarDrop(e, cellKey)}
                            className={cn(
                              "border-r border-b border-gray-200 p-1 flex flex-col gap-1 transition-colors min-h-[50px]",
                              !cell.inCurrentMonth ? "bg-gray-50/50 text-gray-400" : "bg-white",
                              "hover:bg-blue-50/30"
                            )}
                          >
                             <div className="w-full flex justify-end">
                                <span className={cn(
                                   "text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full",
                                   isToday ? "bg-blue-600 text-white" : "text-gray-600"
                                )}>
                                   {cell.date.getDate()}
                                </span>
                             </div>
                             
                             <div className="flex-1 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                {eventsOnDay.map((evt) => (
                                   <div
                                     key={evt.id}
                                     draggable
                                     onDragStart={(e) => handleDragStart(e, evt.id)}
                                     title={evt.label}
                                     className={cn(
                                       "text-[10px] leading-tight px-1.5 py-1 rounded truncate border cursor-move transition-transform active:scale-95 shadow-sm",
                                       evt.registrationTemplate === "official" 
                                          ? "bg-green-100 text-green-800 border-green-200" 
                                          : "bg-red-100 text-red-800 border-red-200"
                                     )}
                                   >
                                      {evt.label}
                                   </div>
                                ))}
                             </div>
                          </div>
                       );
                    })}
                 </div>
               </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4 border-gray-200 shrink-0">
            <button
              type="button"
              onClick={() => setIsAutoCreateModalOpen(false)}
              className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isAutoCreating}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 shadow-sm"
            >
              <CalendarDays className="h-4 w-4" />
              {isAutoCreating ? "Đang xử lý..." : "Lưu lịch tự động"}
            </button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
