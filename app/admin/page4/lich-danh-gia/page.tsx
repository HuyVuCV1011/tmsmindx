"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/lib/auth-context";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type CalendarView = "day" | "week" | "month" | "year";
type EventCategory =
  | "registration"
  | "exam"
  | "workshop_teaching"
  | "meeting"
  | "advanced_training_release"
  | "holiday";
type RegistrationTemplate = "official" | "supplement";

interface EvaluationEvent {
  id: string;
  title: string;
  specialty: string;
  startAt: string;
  endAt: string;
  note?: string;
  eventType?: EventCategory;
  registrationTemplate?: RegistrationTemplate;
}

interface EventRow {
  id: string;
  title: string;
  specialty: string | null;
  event_type: EventCategory;
  registration_template: RegistrationTemplate | null;
  start_at: string;
  end_at: string;
  note?: string | null;
}

interface ExamScheduleItem {
  specialty: string;
  startTime: string;
  endTime: string;
}

interface EventParticipant {
  id: number;
  event_id: string;
  teacher_code: string;
  teacher_name: string | null;
  teacher_email: string | null;
  response_status: "accepted" | "declined";
  responded_at: string;
}

const REGISTRATION_TEMPLATE_LABELS: Record<RegistrationTemplate, string> = {
  official:
    "Đăng ký Kiểm tra chuyên sâu &\nQuy trình - Kỹ năng trải nghiệm\n[Chính thức]",
  supplement:
    "Đăng ký Kiểm tra chuyên sâu &\nQuy trình - Kỹ năng trải nghiệm\n[Bổ sung]",
};

const EVENT_TYPE_LABELS: Record<EventCategory, string> = {
  registration: "A: Lịch đăng ký kiểm tra",
  exam: "B: Lịch kiểm tra chuyên môn",
  workshop_teaching: "C: Lịch Workshop Teaching",
  meeting: "D: Lịch họp",
  advanced_training_release: "E: Lịch phát hành đào tạo nâng cao",
  holiday: "F: Lịch nghỉ",
};

interface CalendarCell {
  date: Date;
  inCurrentMonth: boolean;
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DAY_HOURS = 24;
const HOUR_BLOCK_HEIGHT = 56;
const VIEW_OPTIONS: Array<{ value: CalendarView; label: string }> = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
];

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

function getWeekStartMonday(date: Date) {
  const current = startOfDay(date);
  const start = new Date(current);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  return start;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getEventClass(eventType: EventCategory | undefined) {
  switch (eventType) {
    case "registration":
      return "bg-red-100 text-red-900";
    case "workshop_teaching":
      return "bg-purple-200 text-purple-900";
    case "meeting":
      return "bg-blue-200 text-blue-900";
    case "advanced_training_release":
      return "bg-indigo-200 text-indigo-900";
    case "holiday":
      return "bg-amber-200 text-amber-900";
    case "exam":
    default:
      return "bg-green-200 text-green-900";
  }
}

function getEventDetailSectionClass(_eventType: EventCategory) {
  return "border-gray-200 bg-gray-50";
}

function mapEventRowToEvent(row: EventRow): EvaluationEvent {
  return {
    id: row.id,
    title: row.title,
    specialty: row.specialty || row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    note: row.note || "",
    eventType: row.event_type,
    registrationTemplate: row.registration_template || undefined,
  };
}

function formatDateOnly(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function combineDateAndTime(date: string, time: string) {
  return `${date}T${time}`;
}

function formatEventTimeRange(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const hhmm = (value: Date) => {
    const h = value.getHours().toString().padStart(2, "0");
    const m = value.getMinutes().toString().padStart(2, "0");
    return `${h}h${m}`;
  };
  return `${hhmm(start)} - ${hhmm(end)}`;
}

function getExamEventTitle(specialty: string) {
  if (specialty === "Kiểm tra chuyên sâu bổ sung") {
    return "Kiểm tra chuyên sâu bổ sung";
  }

  if (specialty === "Kiểm tra quy trình - kỹ năng trải nghiệm bổ sung") {
    return "Kiểm tra quy trình - kỹ năng trải nghiệm bổ sung";
  }

  if (specialty === "Quy trình quy định") {
    return "Kiểm tra quy trình - kỹ năng trải nghiệm";
  }

  return `Kiểm tra chuyên sâu ${specialty}`;
}

function formatTimeOnly(value: string) {
  const date = new Date(value);
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function buildCalendarCells(focusDate: Date, view: CalendarView): CalendarCell[] {
  if (view === "day") {
    return [{ date: new Date(focusDate), inCurrentMonth: true }];
  }

  if (view === "week") {
    const start = getWeekStartMonday(focusDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date, inCurrentMonth: true };
    });
  }

  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  const monthStartDay = monthStart.getDay();
  const diff = monthStartDay === 0 ? -6 : 1 - monthStartDay;
  gridStart.setDate(monthStart.getDate() + diff);

  const totalCells = view === "month" ? 35 : 42;

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inCurrentMonth: date.getMonth() === focusDate.getMonth() };
  });
}

export default function ProfessionalEvaluationSchedulePage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [focusDate, setFocusDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDayEventsModal, setShowDayEventsModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<EvaluationEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [selectedParticipantEvent, setSelectedParticipantEvent] = useState<EvaluationEvent | null>(null);
  const [acceptedParticipants, setAcceptedParticipants] = useState<EventParticipant[]>([]);
  const calendarPermissionPath = "/admin/page4/lich-danh-gia";

  const [formData, setFormData] = useState(() => {
    const start = new Date();
    const defaultDate = formatDateOnly(start);
    return {
      eventType: "exam" as EventCategory,
      registrationTemplate: "official" as RegistrationTemplate,
      registrationStartDate: defaultDate,
      registrationEndDate: defaultDate,
      holidayStartDate: defaultDate,
      holidayEndDate: defaultDate,
      examDate: defaultDate,
      commonDate: defaultDate,
      commonStartTime: "08:00",
      commonEndTime: "09:00",
      examSchedules: [
        {
          specialty: "Coding - Scratch",
          startTime: "21:00",
          endTime: "21:45",
        },
      ] as ExamScheduleItem[],
      title: "",
      note: "",
    };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoadingEvents(true);
      const response = await fetch('/api/event-schedules');
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể tải dữ liệu lịch sự kiện');
      }

      const mapped = (data.data || []).map((row: EventRow) => mapEventRowToEvent(row));
      setEvents(mapped);
    } catch (error: any) {
      console.error('Error fetching event schedules:', error);
      toast.error(error?.message || 'Không thể tải dữ liệu lịch sự kiện');
      setEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const canManageCalendar = user?.role === "super_admin";

  const yearOptions = useMemo(() => {
    const currentYear = currentTime.getFullYear();
    const focusYear = focusDate.getFullYear();
    const minYear = Math.min(currentYear - 5, focusYear - 5);
    const maxYear = Math.max(currentYear + 5, focusYear + 5);
    const length = maxYear - minYear + 1;
    return Array.from({ length }, (_, index) => minYear + index);
  }, [currentTime, focusDate]);

  const calendarCells = useMemo(
    () => buildCalendarCells(focusDate, view),
    [focusDate, view]
  );

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, EvaluationEvent[]>();
    events.forEach((event) => {
      if (event.eventType === "registration" || event.eventType === "holiday") {
        const startDate = startOfDay(new Date(event.startAt));
        const endDate = startOfDay(new Date(event.endAt));
        const cursor = new Date(startDate);

        while (cursor.getTime() <= endDate.getTime()) {
          const key = formatDateKey(cursor);
          const previous = map.get(key) || [];
          previous.push(event);
          map.set(key, previous);
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        const date = new Date(event.startAt);
        const key = formatDateKey(date);
        const previous = map.get(key) || [];
        previous.push(event);
        map.set(key, previous);
      }
    });

    map.forEach((list, key) => {
      map.set(
        key,
        list.sort(
          (first, second) =>
            new Date(first.startAt).getTime() - new Date(second.startAt).getTime()
        )
      );
    });

    return map;
  }, [events]);

  const periodLabel = useMemo(() => {
    if (view === "day") {
      return focusDate.toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }

    if (view === "week") {
      const start = getWeekStartMonday(focusDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString("vi-VN")} - ${end.toLocaleDateString("vi-VN")}`;
    }

    if (view === "year") {
      return `Năm ${focusDate.getFullYear()}`;
    }

    return `Tháng ${focusDate.getMonth() + 1}/${focusDate.getFullYear()}`;
  }, [focusDate, view]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDateKey.get(formatDateKey(selectedDate)) || [];
  }, [eventsByDateKey, selectedDate]);

  const dayViewEvents = useMemo(() => {
    if (view !== "day") return { registration: [] as EvaluationEvent[], exam: [] as EvaluationEvent[] };
    const eventsOfDay = eventsByDateKey.get(formatDateKey(focusDate)) || [];
    return {
      registration: eventsOfDay.filter((event) => event.eventType === "registration"),
      exam: eventsOfDay.filter((event) => event.eventType !== "registration"),
    };
  }, [eventsByDateKey, focusDate, view]);

  const stepDate = (amount: number) => {
    const next = new Date(focusDate);

    if (view === "day") {
      next.setDate(next.getDate() + amount);
    } else if (view === "week") {
      next.setDate(next.getDate() + amount * 7);
    } else if (view === "year") {
      next.setFullYear(next.getFullYear() + amount);
    } else {
      next.setMonth(next.getMonth() + amount);
    }

    setFocusDate(next);
  };

  const goToToday = () => {
    setFocusDate(new Date());
  };

  const applyDefaultFormForDate = (baseDate: Date) => {
    const start = new Date(baseDate);
    start.setHours(8, 0, 0, 0);

    setFormData({
      eventType: "exam",
      registrationTemplate: "official",
      registrationStartDate: formatDateOnly(start),
      registrationEndDate: formatDateOnly(start),
      holidayStartDate: formatDateOnly(start),
      holidayEndDate: formatDateOnly(start),
      examDate: formatDateOnly(start),
      commonDate: formatDateOnly(start),
      commonStartTime: "08:00",
      commonEndTime: "09:00",
      examSchedules: [
        {
          specialty: "Coding - Scratch",
          startTime: "21:00",
          endTime: "21:45",
        },
      ],
      title: "",
      note: "",
    });
  };

  const resetForm = () => {
    applyDefaultFormForDate(focusDate);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setEditingEventId(null);
  };

  const openCreateModal = () => {
    if (!canManageCalendar) {
      return;
    }
    resetForm();
    setEditingEventId(null);
    setShowCreateModal(true);
  };

  const openCreateModalForDay = (date: Date) => {
    if (!canManageCalendar) {
      return;
    }
    applyDefaultFormForDate(date);
    setEditingEventId(null);
    setShowDayEventsModal(false);
    setShowCreateModal(true);
  };

  const openEditEvent = (event: EvaluationEvent) => {
    if (!canManageCalendar) {
      return;
    }
    if (event.eventType === "registration") {
      setFormData((previous) => ({
        ...previous,
        eventType: "registration",
        registrationTemplate: event.registrationTemplate || "official",
        registrationStartDate: formatDateOnly(new Date(event.startAt)),
        registrationEndDate: formatDateOnly(new Date(event.endAt)),
        note: event.note || "",
      }));
    } else if (event.eventType === "exam") {
      setFormData((previous) => ({
        ...previous,
        eventType: "exam",
        examDate: formatDateOnly(new Date(event.startAt)),
        examSchedules: [
          {
            specialty: event.specialty,
            startTime: formatTimeOnly(event.startAt),
            endTime: formatTimeOnly(event.endAt),
          },
        ],
        note: event.note || "",
      }));
    } else if (event.eventType === "holiday") {
      setFormData((previous) => ({
        ...previous,
        eventType: "holiday",
        title: event.title,
        holidayStartDate: formatDateOnly(new Date(event.startAt)),
        holidayEndDate: formatDateOnly(new Date(event.endAt)),
        note: event.note || "",
      }));
    } else {
      setFormData((previous) => ({
        ...previous,
        eventType: event.eventType || "meeting",
        title: event.title,
        commonDate: formatDateOnly(new Date(event.startAt)),
        commonStartTime: formatTimeOnly(event.startAt),
        commonEndTime: formatTimeOnly(event.endAt),
        note: event.note || "",
      }));
    }

    setEditingEventId(event.id);
    setShowDayEventsModal(false);
    setShowCreateModal(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!canManageCalendar) {
      return;
    }
    try {
      const response = await fetch('/api/event-schedules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể xóa sự kiện');
      }

      setEvents((previous) => previous.filter((event) => event.id !== eventId));
      toast.success("Đã xóa sự kiện");
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xóa sự kiện');
    }
  };

  const handleViewParticipants = async (event: EvaluationEvent) => {
    try {
      setParticipantsLoading(true);
      setSelectedParticipantEvent(event);
      setShowParticipantsModal(true);

      const response = await fetch(
        `/api/event-schedule-participants?event_id=${encodeURIComponent(event.id)}&status=accepted`
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể tải danh sách tham gia');
      }

      setAcceptedParticipants((data.data || []) as EventParticipant[]);
    } catch (error: any) {
      setAcceptedParticipants([]);
      toast.error(error?.message || 'Không thể tải danh sách tham gia');
    } finally {
      setParticipantsLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!canManageCalendar) {
      return;
    }
    let nextEvents: EvaluationEvent[];

    if (formData.eventType === "registration") {
      if (!formData.registrationStartDate || !formData.registrationEndDate) {
        toast.error("Vui lòng chọn ngày mở và ngày đóng đăng ký");
        return;
      }

      if (new Date(formData.registrationEndDate) < new Date(formData.registrationStartDate)) {
        toast.error("Ngày kết thúc đăng ký phải sau hoặc bằng ngày mở đăng ký");
        return;
      }

      const startAt = `${formData.registrationStartDate}T00:00`;
      const endAt = `${formData.registrationEndDate}T23:59`;
      nextEvents = [{
        id: crypto.randomUUID(),
        eventType: "registration",
        registrationTemplate: formData.registrationTemplate,
        title: REGISTRATION_TEMPLATE_LABELS[formData.registrationTemplate],
        specialty: "Lịch đăng ký kiểm tra",
        startAt,
        endAt,
        note: formData.note.trim(),
      }];
    } else if (formData.eventType === "exam") {
      if (!formData.examDate) {
        toast.error("Vui lòng nhập đầy đủ thông tin sự kiện");
        return;
      }

      if (!Array.isArray(formData.examSchedules) || formData.examSchedules.length === 0) {
        toast.error("Vui lòng thêm ít nhất 1 lịch kiểm tra");
        return;
      }

      const hasInvalidSchedule = formData.examSchedules.some(
        (schedule) => !schedule.specialty || !schedule.startTime || !schedule.endTime
      );
      if (hasInvalidSchedule) {
        toast.error("Vui lòng nhập đầy đủ môn và thời gian cho tất cả lịch kiểm tra");
        return;
      }

      const hasInvalidTimeRange = formData.examSchedules.some((schedule) => {
        const startAt = combineDateAndTime(formData.examDate, schedule.startTime);
        const endAt = combineDateAndTime(formData.examDate, schedule.endTime);
        return new Date(endAt) <= new Date(startAt);
      });
      if (hasInvalidTimeRange) {
        toast.error("Mỗi lịch kiểm tra phải có thời gian kết thúc sau thời gian bắt đầu");
        return;
      }

      nextEvents = formData.examSchedules.map((schedule) => {
        const startAt = combineDateAndTime(formData.examDate, schedule.startTime);
        const endAt = combineDateAndTime(formData.examDate, schedule.endTime);
        return {
          id: crypto.randomUUID(),
          eventType: "exam" as EventCategory,
          title: getExamEventTitle(schedule.specialty),
          specialty: schedule.specialty,
          startAt,
          endAt,
          note: formData.note.trim(),
        };
      });
    } else {
      let startAt = "";
      let endAt = "";

      if (formData.eventType === "holiday") {
        if (!formData.holidayStartDate || !formData.holidayEndDate) {
          toast.error("Vui lòng chọn ngày bắt đầu và ngày kết thúc lịch nghỉ");
          return;
        }

        if (new Date(formData.holidayEndDate) < new Date(formData.holidayStartDate)) {
          toast.error("Ngày kết thúc lịch nghỉ phải sau hoặc bằng ngày bắt đầu");
          return;
        }

        startAt = `${formData.holidayStartDate}T00:00`;
        endAt = `${formData.holidayEndDate}T23:59`;
      } else {
        if (!formData.commonDate || !formData.commonStartTime || !formData.commonEndTime) {
          toast.error("Vui lòng nhập đầy đủ ngày và giờ sự kiện");
          return;
        }

        startAt = combineDateAndTime(formData.commonDate, formData.commonStartTime);
        endAt = combineDateAndTime(formData.commonDate, formData.commonEndTime);
        if (new Date(endAt) <= new Date(startAt)) {
          toast.error("Thời gian kết thúc phải sau thời gian bắt đầu");
          return;
        }
      }

      const titleByType: Record<EventCategory, string> = {
        registration: EVENT_TYPE_LABELS.registration,
        exam: EVENT_TYPE_LABELS.exam,
        workshop_teaching: "Workshop Teaching",
        meeting: "Lịch họp",
        advanced_training_release: "Phát hành đào tạo nâng cao",
        holiday: "Lịch nghỉ",
      };

      const finalTitle = formData.title.trim() || titleByType[formData.eventType];
      nextEvents = [
        {
          id: crypto.randomUUID(),
          eventType: formData.eventType,
          title: finalTitle,
          specialty: finalTitle,
          startAt,
          endAt,
          note: formData.note.trim(),
        },
      ];
    }

    try {
      setIsSavingEvent(true);
      if (editingEventId) {
        const updated = nextEvents[0];
        const response = await fetch('/api/event-schedules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingEventId,
            title: updated.title,
            specialty: updated.specialty,
            event_type: updated.eventType,
            registration_template: updated.registrationTemplate || null,
            start_at: updated.startAt,
            end_at: updated.endAt,
            note: updated.note || null,
          }),
        });
        const data = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Không thể cập nhật sự kiện');
        }

        const mapped = mapEventRowToEvent(data.data as EventRow);
        setEvents((previous) =>
          previous.map((event) => (event.id === editingEventId ? mapped : event))
        );
        toast.success("Đã cập nhật sự kiện");
      } else {
        const createdRows = await Promise.all(
          nextEvents.map(async (event) => {
            const response = await fetch('/api/event-schedules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: event.id,
                title: event.title,
                specialty: event.specialty,
                event_type: event.eventType,
                registration_template: event.registrationTemplate || null,
                start_at: event.startAt,
                end_at: event.endAt,
                note: event.note || null,
              }),
            });
            const data = await response.json();
            if (!response.ok || !data?.success) {
              throw new Error(data?.error || 'Không thể tạo sự kiện');
            }
            return mapEventRowToEvent(data.data as EventRow);
          })
        );

        setEvents((previous) => [...previous, ...createdRows]);
        toast.success("Đã thêm lịch sự kiện");
      }

      closeCreateModal();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu sự kiện');
    } finally {
      setIsSavingEvent(false);
    }
  };

  const exportEvents = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lich-su-kien-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCreateModal();
        setShowDayEventsModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreateModal, showDayEventsModal]);

  const dayTimelineHeight = DAY_HOURS * HOUR_BLOCK_HEIGHT;
  const dayIsToday = isSameDate(startOfDay(focusDate), startOfDay(currentTime));
  const currentMinuteOfDay = currentTime.getHours() * 60 + currentTime.getMinutes();
  const currentTimeTop = (currentMinuteOfDay / 60) * HOUR_BLOCK_HEIGHT;

  return (
    <PageContainer title="Lịch sự kiện">
      <Card className="overflow-hidden" padding="sm">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Lịch Sự Kiện</h2>
        </div>

        <div className="px-4 py-2 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-700" />
            <select
              value={focusDate.getMonth()}
              onChange={(event) => {
                const next = new Date(focusDate);
                next.setMonth(Number(event.target.value));
                setFocusDate(next);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index} value={index}>
                  Tháng {index + 1}
                </option>
              ))}
            </select>

            <select
              value={focusDate.getFullYear()}
              onChange={(event) => {
                const next = new Date(focusDate);
                next.setFullYear(Number(event.target.value));
                setFocusDate(next);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => stepDate(-1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
              aria-label="Trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => stepDate(1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
              aria-label="Sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setView(option.value)}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                  view === option.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}

            <button
              onClick={goToToday}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
            >
              Hôm nay
            </button>

            {canManageCalendar && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                <Plus className="h-4 w-4" /> Thêm mới
              </button>
            )}

            <button
              onClick={exportEvents}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Xuất file
            </button>
          </div>
        </div>

        <div className="px-4 py-2 text-sm font-semibold text-gray-700 border-b border-gray-200 bg-gray-50">
          {periodLabel}
        </div>

        {!canManageCalendar && (
          <div className="px-4 py-2 text-xs text-amber-800 border-b border-amber-200 bg-amber-50">
            Bạn đang ở chế độ chỉ xem. Các chức năng Thêm mới, Sửa và Xóa sự kiện chỉ dành cho Super Admin.
          </div>
        )}

        {isLoadingEvents && (
          <div className="px-4 py-2 text-xs text-blue-700 border-b border-gray-200 bg-blue-50">
            Đang tải dữ liệu lịch sự kiện từ hệ thống...
          </div>
        )}

        {view === "day" ? (
          <div className="border-l border-t border-gray-200">
            <div className="grid grid-cols-[78px_1fr] border-b border-gray-200 bg-gray-50">
              <div className="px-3 py-2 text-sm font-semibold text-gray-600">Giờ</div>
              <div className="px-3 py-2 text-sm font-semibold text-gray-700">
                {focusDate.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </div>
            </div>

            {dayViewEvents.registration.length > 0 && (
              <div className="border-b border-gray-200 bg-yellow-50 px-3 py-2">
                {dayViewEvents.registration.map((event) => (
                  <div
                    key={event.id}
                    className="text-sm font-bold leading-5 text-red-700 whitespace-pre-line"
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            )}

            <div className="relative grid grid-cols-[78px_1fr]">
              <div className="relative border-r border-gray-200 bg-white">
                {Array.from({ length: DAY_HOURS + 1 }, (_, hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0"
                    style={{ top: hour * HOUR_BLOCK_HEIGHT }}
                  >
                    <span className="-translate-y-1/2 block px-2 text-xs font-semibold text-blue-700">
                      {`${hour.toString().padStart(2, "0")}h00`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="relative bg-white" style={{ height: dayTimelineHeight }}>
                {Array.from({ length: DAY_HOURS + 1 }, (_, hour) => (
                  <div
                    key={`line-${hour}`}
                    className="absolute left-0 right-0 border-t border-gray-200"
                    style={{ top: hour * HOUR_BLOCK_HEIGHT }}
                  />
                ))}

                {dayViewEvents.exam.map((event) => {
                  const start = new Date(event.startAt);
                  const end = new Date(event.endAt);
                  const startMinute = start.getHours() * 60 + start.getMinutes();
                  const endMinute = end.getHours() * 60 + end.getMinutes();
                  const top = (startMinute / 60) * HOUR_BLOCK_HEIGHT;
                  const height = Math.max(26, ((endMinute - startMinute) / 60) * HOUR_BLOCK_HEIGHT);
                  const eventTitle =
                    event.specialty === "Quy trình quy định"
                      ? "Kiểm tra quy trình - kỹ năng trải nghiệm"
                      : event.title;

                  return (
                    <div
                      key={event.id}
                      className={`absolute left-2 right-2 rounded-sm px-2 py-1 text-[11px] leading-4 font-semibold ${getEventClass(event.eventType)}`}
                      style={{ top, height }}
                      title={`${eventTitle} (${formatEventTimeRange(event.startAt, event.endAt)})`}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        setSelectedDate(focusDate);
                        setShowDayEventsModal(true);
                      }}
                    >
                      <div className="truncate">{eventTitle}</div>
                      <div className="text-[10px] opacity-80">{formatEventTimeRange(event.startAt, event.endAt)}</div>
                    </div>
                  );
                })}

                {dayIsToday && (
                  <div className="absolute left-0 right-0 z-20" style={{ top: currentTimeTop }}>
                    <div className="border-t-2 border-red-500" />
                    <span className="absolute -top-2 right-1 bg-white px-1 text-[10px] font-semibold text-red-600">
                      {currentTime.toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 border-l border-t border-gray-200">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="h-10 border-r border-b border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600 flex items-center justify-center"
              >
                {label}
              </div>
            ))}

            {calendarCells.map(({ date, inCurrentMonth }) => {
              const isToday = isSameDate(startOfDay(date), startOfDay(currentTime));
              const dateKey = formatDateKey(date);
              const dayEvents = eventsByDateKey.get(dateKey) || [];

              return (
                <div
                  key={dateKey}
                  className={`min-h-28 border-r border-b border-gray-200 p-2 ${
                    isToday
                      ? "bg-yellow-50 border-yellow-300"
                      : inCurrentMonth
                        ? "bg-white"
                        : "bg-gray-50"
                  } cursor-pointer hover:bg-blue-50`}
                  onClick={() => {
                    setSelectedDate(date);
                    setShowDayEventsModal(true);
                  }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    {isToday ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-300 text-sm font-bold text-yellow-900">
                        {date.getDate()}
                      </span>
                    ) : (
                      <span
                        className={`text-sm font-medium ${
                          inCurrentMonth ? "text-gray-900" : "text-gray-400"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.map((event) => {
                      if (event.eventType === "registration") {
                        return (
                          <div
                            key={event.id}
                            className="py-1 text-center text-[12px] leading-4 font-bold text-red-700 whitespace-pre-line"
                            title={event.title.replace(/\n/g, " ")}
                          >
                            {event.title}
                          </div>
                        );
                      }

                      const eventTitle =
                        event.specialty === "Quy trình quy định"
                          ? "Kiểm tra quy trình - kỹ năng trải nghiệm"
                          : event.title;

                      return (
                        <div key={event.id} className="flex items-start gap-1">
                          <div className="w-18 shrink-0 text-[11px] font-semibold text-blue-700 leading-4">
                            {formatEventTimeRange(event.startAt, event.endAt)}
                          </div>
                          <div
                            className={`flex-1 rounded-sm px-1 py-1 text-[11px] leading-4 font-semibold text-center ${getEventClass(event.eventType)}`}
                            title={eventTitle}
                          >
                            {eventTitle}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-bold text-gray-900">Thêm mới sự kiện</h3>
              <button onClick={closeCreateModal} className="rounded-md p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 px-4 py-4 flex-1 overflow-y-auto">
              <div>
                <label className="mb-1 block text-sm font-medium">Loại sự kiện</label>
                <select
                  value={formData.eventType}
                  onChange={(event) => {
                    const eventType = event.target.value as EventCategory;
                    setFormData((previous) => ({
                      ...previous,
                      eventType,
                      title:
                        eventType === "workshop_teaching"
                          ? "Workshop Teaching"
                          : eventType === "meeting"
                            ? "Lịch họp"
                            : eventType === "advanced_training_release"
                              ? "Phát hành đào tạo nâng cao"
                              : eventType === "holiday"
                                ? "Lịch nghỉ"
                                : previous.title,
                    }));
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {(Object.keys(EVENT_TYPE_LABELS) as EventCategory[]).map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {EVENT_TYPE_LABELS[eventType]}
                    </option>
                  ))}
                </select>

                {formData.eventType === "registration" && (
                  <p className="mt-2 text-xs text-gray-600">
                    Dùng cho form đăng ký [Chính thức]/[Bổ sung]
                  </p>
                )}
                {formData.eventType === "exam" && (
                  <p className="mt-2 text-xs text-gray-600">
                    1 ngày có thể tạo nhiều mục kiểm tra
                  </p>
                )}
                {formData.eventType === "holiday" && (
                  <p className="mt-2 text-xs text-gray-600">
                    Tạo lịch nghỉ theo thời gian bạn chọn
                  </p>
                )}
              </div>

              <div className={`rounded-lg border p-3 space-y-3 ${getEventDetailSectionClass(formData.eventType)}`}>
                <div className="text-sm font-semibold text-gray-800">Chi tiết nội dung sự kiện</div>

                {formData.eventType === "registration" ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Mẫu đăng ký *</label>
                      <select
                        value={formData.registrationTemplate}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            registrationTemplate: event.target.value as RegistrationTemplate,
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      >
                        <option value="official">Đăng ký Kiểm tra chuyên sâu & Quy trình - Kỹ năng trải nghiệm [Chính thức]</option>
                        <option value="supplement">Đăng ký Kiểm tra chuyên sâu & Quy trình - Kỹ năng trải nghiệm [Bổ sung]</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Ngày bắt đầu mở đăng ký *</label>
                      <input
                        type="date"
                        value={formData.registrationStartDate}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            registrationStartDate: event.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Ngày kết thúc đăng ký *</label>
                      <input
                        type="date"
                        value={formData.registrationEndDate}
                        onChange={(event) =>
                          setFormData((previous) => ({
                            ...previous,
                            registrationEndDate: event.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      />
                    </div>
                  </>
                ) : formData.eventType === "exam" ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Ngày kiểm tra chuyên môn *</label>
                      <input
                        type="date"
                        value={formData.examDate}
                        onChange={(event) =>
                          setFormData((previous) => ({ ...previous, examDate: event.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      />
                    </div>

                    <div className="space-y-3">
                      {formData.examSchedules.map((schedule, index) => (
                        <div key={index} className="rounded-md border border-gray-200 p-3 bg-white">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-semibold text-gray-800">Lịch môn #{index + 1}</div>
                            {formData.examSchedules.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData((previous) => ({
                                    ...previous,
                                    examSchedules: previous.examSchedules.filter((_, itemIndex) => itemIndex !== index),
                                  }))
                                }
                                className="text-xs font-semibold text-red-600 hover:text-red-700"
                              >
                                Xóa
                              </button>
                            )}
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">Môn kiểm tra</label>
                            <select
                              value={schedule.specialty}
                              onChange={(event) =>
                                setFormData((previous) => ({
                                  ...previous,
                                  examSchedules: previous.examSchedules.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, specialty: event.target.value }
                                      : item
                                  ),
                                }))
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                            >
                              <option>Coding - Scratch</option>
                              <option>Coding - Game</option>
                              <option>Coding - App</option>
                              <option>Coding - Web</option>
                              <option>Computer Science</option>
                              <option>Robotics Lego Spike 4+</option>
                              <option>Robotics VexGo</option>
                              <option>Robotics Vex IQ</option>
                              <option>Art</option>
                              <option>Quy trình quy định</option>
                              <option>Kiểm tra chuyên sâu bổ sung</option>
                              <option>Kiểm tra quy trình - kỹ năng trải nghiệm bổ sung</option>
                            </select>
                          </div>

                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-sm font-medium">Bắt đầu *</label>
                              <input
                                type="time"
                                value={schedule.startTime}
                                onChange={(event) =>
                                  setFormData((previous) => ({
                                    ...previous,
                                    examSchedules: previous.examSchedules.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, startTime: event.target.value }
                                        : item
                                    ),
                                  }))
                                }
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-sm font-medium">Kết thúc *</label>
                              <input
                                type="time"
                                value={schedule.endTime}
                                onChange={(event) =>
                                  setFormData((previous) => ({
                                    ...previous,
                                    examSchedules: previous.examSchedules.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, endTime: event.target.value }
                                        : item
                                    ),
                                  }))
                                }
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {!editingEventId && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((previous) => ({
                              ...previous,
                              examSchedules: [
                                ...previous.examSchedules,
                                {
                                  specialty: "Coding - Scratch",
                                  startTime: "21:00",
                                  endTime: "21:45",
                                },
                              ],
                            }))
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
                        >
                          <Plus className="h-4 w-4" /> Thêm lịch / môn tiếp theo
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Tên sự kiện *</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(event) =>
                          setFormData((previous) => ({ ...previous, title: event.target.value }))
                        }
                        placeholder="Nhập tên sự kiện"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      />
                    </div>

                    {formData.eventType === "holiday" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium">Ngày bắt đầu nghỉ *</label>
                          <input
                            type="date"
                            value={formData.holidayStartDate}
                            onChange={(event) =>
                              setFormData((previous) => ({ ...previous, holidayStartDate: event.target.value }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium">Ngày kết thúc nghỉ *</label>
                          <input
                            type="date"
                            value={formData.holidayEndDate}
                            onChange={(event) =>
                              setFormData((previous) => ({ ...previous, holidayEndDate: event.target.value }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="mb-1 block text-sm font-medium">Ngày sự kiện *</label>
                          <input
                            type="date"
                            value={formData.commonDate}
                            onChange={(event) =>
                              setFormData((previous) => ({ ...previous, commonDate: event.target.value }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-sm font-medium">Bắt đầu *</label>
                            <input
                              type="time"
                              value={formData.commonStartTime}
                              onChange={(event) =>
                                setFormData((previous) => ({ ...previous, commonStartTime: event.target.value }))
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">Kết thúc *</label>
                            <input
                              type="time"
                              value={formData.commonEndTime}
                              onChange={(event) =>
                                setFormData((previous) => ({ ...previous, commonEndTime: event.target.value }))
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="mb-1 block text-sm font-medium">Ghi chú</label>
                      <textarea
                        value={formData.note}
                        onChange={(event) =>
                          setFormData((previous) => ({ ...previous, note: event.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {(formData.eventType === "registration" || formData.eventType === "exam") && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Ghi chú</label>
                    <textarea
                      value={formData.note}
                      onChange={(event) =>
                        setFormData((previous) => ({ ...previous, note: event.target.value }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 shrink-0 bg-white">
              <button
                onClick={closeCreateModal}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={isSavingEvent}
                className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                <Plus className="h-4 w-4" /> {isSavingEvent ? "Đang lưu..." : editingEventId ? "Cập nhật sự kiện" : "Lưu sự kiện"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDayEventsModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-bold text-gray-900">
                Sự kiện ngày {selectedDate.toLocaleDateString("vi-VN")}
              </h3>
              <div className="flex items-center gap-2">
                {canManageCalendar && (
                  <button
                    onClick={() => openCreateModalForDay(selectedDate)}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    <Plus className="h-4 w-4" /> Thêm sự kiện mới
                  </button>
                )}
                <button
                  onClick={() => setShowDayEventsModal(false)}
                  className="rounded-md p-1 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-4 space-y-3">
              {selectedDayEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Không có sự kiện trong ngày này.
                </div>
              ) : (
                selectedDayEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">
                          {EVENT_TYPE_LABELS[event.eventType || "exam"]}
                        </div>
                        <div className="text-sm font-bold text-gray-900 whitespace-pre-line">{event.title}</div>
                        <div className="text-xs text-blue-700 mt-1">
                          {formatEventTimeRange(event.startAt, event.endAt)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{event.specialty}</div>
                      </div>

                      {canManageCalendar && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewParticipants(event)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            <Users className="h-3.5 w-3.5" /> Xem tham gia
                          </button>
                          <button
                            onClick={() => openEditEvent(event)}
                            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => setShowDayEventsModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showParticipantsModal && selectedParticipantEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Danh sách xác nhận tham gia</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {selectedParticipantEvent.title} • {formatEventTimeRange(selectedParticipantEvent.startAt, selectedParticipantEvent.endAt)}
                </p>
              </div>
              <button
                onClick={() => setShowParticipantsModal(false)}
                className="rounded-md p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {participantsLoading ? (
                <div className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-500">
                  Đang tải danh sách tham gia...
                </div>
              ) : acceptedParticipants.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Chưa có mentor tham gia.
                </div>
              ) : (
                <div className="space-y-2">
                  {acceptedParticipants.map((participant, index) => (
                    <div key={participant.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {index + 1}. {participant.teacher_name || participant.teacher_code}
                          </p>
                          <p className="text-xs text-gray-600">Mã GV: {participant.teacher_code}</p>
                          {participant.teacher_email && (
                            <p className="text-xs text-gray-600">Email: {participant.teacher_email}</p>
                          )}
                        </div>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                          Đã xác nhận
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => setShowParticipantsModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
