"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/lib/auth-context";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type CalendarView = "day" | "week" | "month";
type EventCategory = "registration" | "exam" | "workshop_teaching" | "meeting" | "advanced_training_release" | "holiday";
type ParticipationStatus = "accepted" | "declined";

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

interface ExamSetAvailability {
  status: "active" | "inactive";
  block_code: string;
  subject_code: string;
}

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const EVENT_TYPE_LABELS: Record<EventCategory, string> = {
  registration: "A: Lịch đăng ký kiểm tra",
  exam: "B: Lịch kiểm tra chuyên môn",
  workshop_teaching: "C: Lịch Workshop Teaching",
  meeting: "D: Lịch họp",
  advanced_training_release: "E: Lịch phát hành đào tạo nâng cao",
  holiday: "F: Lịch nghỉ",
};

const REGISTRATION_TEMPLATE_LABELS: Record<RegistrationTemplate, string> = {
  official: "Chính thức",
  supplement: "Bổ sung",
};

function parseLocalDateTime(value: string) {
  const normalized = value.trim().replace(" ", "T");
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return new Date(value);
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

function formatDateTime(value: string) {
  return parseLocalDateTime(value).toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getCalendarEventStyle(eventType: EventCategory | undefined) {
  switch (eventType) {
    case "registration":
      return {
        timeClassName: "text-red-700",
        titleClassName: "bg-red-100 text-red-900",
      };
    case "workshop_teaching":
      return {
        timeClassName: "text-purple-700",
        titleClassName: "bg-purple-200 text-purple-900",
      };
    case "meeting":
      return {
        timeClassName: "text-blue-700",
        titleClassName: "bg-blue-200 text-blue-900",
      };
    case "advanced_training_release":
      return {
        timeClassName: "text-indigo-700",
        titleClassName: "bg-indigo-200 text-indigo-900",
      };
    case "holiday":
      return {
        timeClassName: "text-amber-700",
        titleClassName: "bg-amber-200 text-amber-900",
      };
    case "exam":
    default:
      return {
        timeClassName: "text-green-700",
        titleClassName: "bg-green-200 text-green-900",
      };
  }
}

const REGISTER_OPTIONS = [
  "[COD] Scratch (S)",
  "[COD] GameMaker (G)",
  "[COD] Python (PT)",
  "[COD] Web (JS)",
  "[COD] Computer Science (CS)",
  "[ROB] Lego 4+",
  "[ROB] Vex Go",
  "[ROB] Vex IQ",
  "[ART] Arts",
  "Kiểm tra quy trình & kỹ năng trải nghiệm",
];

type RegisterPayload = {
  exam_type: "expertise" | "experience";
  block_code: string;
  subject_code: string;
  optionLabel: string;
  specialtyAliases: string[];
  subjectCodeCandidates: string[];
};

const REGISTER_OPTION_MAP: Record<string, RegisterPayload> = {
  "[COD] Scratch (S)": {
    exam_type: "expertise",
    block_code: "CODING",
    subject_code: "[COD] Scratch (S)",
    optionLabel: "[COD] Scratch (S)",
    specialtyAliases: ["Coding - Scratch", "Scratch"],
    subjectCodeCandidates: ["[COD] Scratch (S)", "[COD] Scratch", "SCRATCH"],
  },
  "[COD] GameMaker (G)": {
    exam_type: "expertise",
    block_code: "CODING",
    subject_code: "[COD] GameMaker (G)",
    optionLabel: "[COD] GameMaker (G)",
    specialtyAliases: ["Coding - Game", "GameMaker", "Coding - Gamemaker"],
    subjectCodeCandidates: ["[COD] GameMaker (G)", "[COD] GameMaker", "GAMEMAKER"],
  },
  "[COD] Python (PT)": {
    exam_type: "expertise",
    block_code: "CODING",
    subject_code: "[COD] Python (PT)",
    optionLabel: "[COD] Python (PT)",
    specialtyAliases: ["Coding - Python", "Python"],
    subjectCodeCandidates: ["[COD] Python (PT)", "[COD] Python", "PYTHON"],
  },
  "[COD] Web (JS)": {
    exam_type: "expertise",
    block_code: "CODING",
    subject_code: "[COD] Web (JS)",
    optionLabel: "[COD] Web (JS)",
    specialtyAliases: ["Coding - Web", "Web"],
    subjectCodeCandidates: ["[COD] Web (JS)", "[COD] Web", "WEB"],
  },
  "[COD] Computer Science (CS)": {
    exam_type: "expertise",
    block_code: "CODING",
    subject_code: "[COD] Computer Science (CS)",
    optionLabel: "[COD] Computer Science (CS)",
    specialtyAliases: ["Computer Science", "ComputerScience"],
    subjectCodeCandidates: ["[COD] Computer Science (CS)", "[COD] ComputerScience", "COMPUTERSCIENCE"],
  },
  "[ROB] Lego 4+": {
    exam_type: "expertise",
    block_code: "ROBOTICS",
    subject_code: "[ROB] Lego 4+",
    optionLabel: "[ROB] Lego 4+",
    specialtyAliases: ["Robotics Lego Spike 4+", "Lego", "Lego Spike"],
    subjectCodeCandidates: ["[ROB] Lego 4+", "[ROB] Lego Spike", "LEGO"],
  },
  "[ROB] Vex Go": {
    exam_type: "expertise",
    block_code: "ROBOTICS",
    subject_code: "[ROB] Vex Go",
    optionLabel: "[ROB] Vex Go",
    specialtyAliases: ["Robotics VexGo", "VexGo", "Robotics - VexGo"],
    subjectCodeCandidates: ["[ROB] Vex Go", "[ROB] VexGo", "VEXGO"],
  },
  "[ROB] Vex IQ": {
    exam_type: "expertise",
    block_code: "ROBOTICS",
    subject_code: "[ROB] Vex IQ",
    optionLabel: "[ROB] Vex IQ",
    specialtyAliases: ["Robotics Vex IQ", "VexIQ", "Vex IQ", "Robotics - VexIQ"],
    subjectCodeCandidates: ["[ROB] Vex IQ", "[ROB] VexIQ", "VEXIQ"],
  },
  "[ART] Arts": {
    exam_type: "expertise",
    block_code: "ART",
    subject_code: "[ART] Arts",
    optionLabel: "[ART] Arts",
    specialtyAliases: ["Art", "Test chuyên sâu", "Arts"],
    subjectCodeCandidates: ["[ART] Arts", "[ART] Test chuyên sâu", "TEST_CHUY_N_S_U", "[ART]"],
  },
  "Kiểm tra quy trình & kỹ năng trải nghiệm": {
    exam_type: "experience",
    block_code: "PROCESS",
    subject_code: "Kiểm tra quy trình & kỹ năng trải nghiệm",
    optionLabel: "Kiểm tra quy trình & kỹ năng trải nghiệm",
    specialtyAliases: [
      "Quy trình quy định",
      "Quy trình - kỹ năng trải nghiệm",
      "Kiểm tra quy trình - kỹ năng trải nghiệm bổ sung",
    ],
    subjectCodeCandidates: [
      "Kiểm tra quy trình & kỹ năng trải nghiệm",
      "[Trial] Quy Trình Trai nghiệm",
      "QUY_TR_NH_TRAI_NGHI_M",
      "quytrinh",
    ],
  },
};

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

function getWeekStartSunday(date: Date) {
  const current = startOfDay(date);
  const start = new Date(current);
  start.setDate(current.getDate() - current.getDay());
  return start;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatEventTimeRange(startAt: string, endAt: string) {
  const start = parseLocalDateTime(startAt);
  const end = parseLocalDateTime(endAt);
  const hhmm = (value: Date) => {
    const h = value.getHours().toString().padStart(2, "0");
    const m = value.getMinutes().toString().padStart(2, "0");
    return `${h}h${m}`;
  };
  return `${hhmm(start)} - ${hhmm(end)}`;
}

function isPastEvent(event: EvaluationEvent) {
  return parseLocalDateTime(event.endAt).getTime() < Date.now();
}

function isPastDate(date: Date) {
  return startOfDay(date).getTime() < startOfDay(new Date()).getTime();
}

function isRegistrationActive(event: EvaluationEvent) {
  const now = new Date();
  return now >= parseLocalDateTime(event.startAt) && now <= parseLocalDateTime(event.endAt);
}

function buildCalendarCells(focusDate: Date, view: CalendarView) {
  if (view === "day") {
    return [{ date: new Date(focusDate), inCurrentMonth: true }];
  }

  if (view === "week") {
    const start = getWeekStartSunday(focusDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date, inCurrentMonth: true };
    });
  }

  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inCurrentMonth: date.getMonth() === focusDate.getMonth() };
  });
}

export default function MonthlyActivitiesPage() {
  const { user } = useAuth();
  const [view, setView] = useState<CalendarView>("month");
  const [focusDate, setFocusDate] = useState(new Date());
  const [events, setEvents] = useState<EvaluationEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRegistrationEvent, setSelectedRegistrationEvent] = useState<EvaluationEvent | null>(null);
  const [showDayEventsModal, setShowDayEventsModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [availableOptions, setAvailableOptions] = useState<Set<string>>(new Set());
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherCenterCode, setTeacherCenterCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [respondingEventId, setRespondingEventId] = useState<string | null>(null);
  const [participationByEvent, setParticipationByEvent] = useState<Record<string, ParticipationStatus>>({});
  const [userRegisteredSubjects, setUserRegisteredSubjects] = useState<Set<string>>(new Set());
  const [selectedExamEventByOption, setSelectedExamEventByOption] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user?.email) return;

    (async () => {
      try {
        const response = await fetch(`/api/teachers?email=${encodeURIComponent(user.email)}`);
        const data = await response.json();
        if (data?.teacher?.code) {
          setTeacherCode(data.teacher.code);
          if (data?.teacher?.name) {
            setTeacherName(String(data.teacher.name));
          }
          if (data?.teacher?.branchCurrent) {
            setTeacherCenterCode(String(data.teacher.branchCurrent));
          }
          return;
        }
      } catch {
      }

      const fallback = user.email.split('@')[0] || '';
      setTeacherCode(fallback);
      setTeacherName(user.displayName || fallback);
    })();
  }, [user?.email, user?.displayName]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/exam-sets');
        const data = await response.json();
        if (!response.ok || !data?.success) return;

        const rows: ExamSetAvailability[] = data.data || [];
        const normalize = (value: string) =>
          value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .trim();

        const activeSet = new Set<string>();
        rows
          .filter((item) => item.status === 'active')
          .forEach((item) => {
            activeSet.add(`${item.block_code}::${normalize(item.subject_code)}`);
          });

        const available = new Set<string>();
        Object.entries(REGISTER_OPTION_MAP).forEach(([option, mapped]) => {
          const hasActive = mapped.subjectCodeCandidates.some((candidate) =>
            activeSet.has(`${mapped.block_code}::${normalize(candidate)}`)
          );
          if (hasActive) {
            available.add(option);
          }
        });

        setAvailableOptions(available);
      } catch {
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/event-schedules', {
          headers: {
            'x-api-key': process.env.NEXT_PUBLIC_API_SECRET || '',
          },
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Không thể tải dữ liệu lịch sự kiện');
        }

        const rows = (data.data || []) as Array<{
          id: string;
          title: string;
          specialty: string | null;
          start_at: string;
          end_at: string;
          note?: string | null;
          event_type: EventCategory;
          registration_template?: RegistrationTemplate | null;
        }>;

        setEvents(
          rows.map((item) => ({
            id: item.id,
            title: item.title,
            specialty: item.specialty || item.title,
            startAt: item.start_at,
            endAt: item.end_at,
            note: item.note || undefined,
            eventType: item.event_type,
            registrationTemplate: item.registration_template || undefined,
          }))
        );
      } catch (error) {
        console.error('Failed to load event_schedules for teacher calendar:', error);
        setEvents([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!teacherCode) return;
    (async () => {
      try {
        const response = await fetch(`/api/exam-registrations?teacher_code=${encodeURIComponent(teacherCode)}`);
        const data = await response.json();
        if (!response.ok || !data?.success) return;
        const registeredSet = new Set<string>();
        (data.data || []).forEach((row: { block_code: string; subject_code: string }) => {
          Object.entries(REGISTER_OPTION_MAP).forEach(([option, mapped]) => {
            if (mapped.block_code === row.block_code && mapped.subject_code === row.subject_code) {
              registeredSet.add(option);
            }
          });
        });
        setUserRegisteredSubjects(registeredSet);
      } catch {}
    })();
  }, [teacherCode]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 9 }, (_, index) => currentYear - 3 + index);
  }, []);

  const calendarCells = useMemo(() => buildCalendarCells(focusDate, view), [focusDate, view]);

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, EvaluationEvent[]>();
    events.forEach((event) => {
      if (event.eventType === "registration" || event.eventType === "holiday") {
        const startDate = startOfDay(parseLocalDateTime(event.startAt));
        const endDate = startOfDay(parseLocalDateTime(event.endAt));
        const cursor = new Date(startDate);
        while (cursor.getTime() <= endDate.getTime()) {
          const key = formatDateKey(cursor);
          const previous = map.get(key) || [];
          previous.push(event);
          map.set(key, previous);
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        const key = formatDateKey(parseLocalDateTime(event.startAt));
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
            parseLocalDateTime(first.startAt).getTime() - parseLocalDateTime(second.startAt).getTime()
        )
      );
    });

    return map;
  }, [events]);

  const visibleEventsByDateKey = useMemo(() => {
    const normalizeStr = (v: string) =>
      v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const map = new Map<string, EvaluationEvent[]>();
    eventsByDateKey.forEach((dayEvents, key) => {
      const visible = dayEvents.filter((event) => {
        if (event.eventType !== "exam") return true;
        return Object.entries(REGISTER_OPTION_MAP).some(([option, mapped]) => {
          if (!userRegisteredSubjects.has(option)) return false;
          const specialty = normalizeStr(event.specialty || "");
          const title = normalizeStr(event.title || "");
          return mapped.specialtyAliases.some((alias) => {
            const a = normalizeStr(alias);
            return specialty.includes(a) || title.includes(a);
          });
        });
      });
      map.set(key, visible);
    });
    return map;
  }, [eventsByDateKey, userRegisteredSubjects]);

  const upcomingExamEventsByOption = useMemo(() => {
    const now = new Date();
    const normalizeStr = (v: string) =>
      v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const map: Record<string, EvaluationEvent[]> = {};
    Object.entries(REGISTER_OPTION_MAP).forEach(([option, mapped]) => {
      map[option] = events
        .filter((e) => e.eventType === "exam")
        .filter((e) => {
          const specialty = normalizeStr(e.specialty || "");
          const title = normalizeStr(e.title || "");
          return mapped.specialtyAliases.some((alias) => {
            const a = normalizeStr(alias);
            return specialty.includes(a) || title.includes(a);
          });
        })
        .filter((e) => parseLocalDateTime(e.endAt) >= now)
        .sort(
          (a, b) =>
            parseLocalDateTime(a.startAt).getTime() -
            parseLocalDateTime(b.startAt).getTime()
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
      const start = getWeekStartSunday(focusDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString("vi-VN")} - ${end.toLocaleDateString("vi-VN")}`;
    }

    return `Tháng ${focusDate.getMonth() + 1}/${focusDate.getFullYear()}`;
  }, [focusDate, view]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return visibleEventsByDateKey.get(formatDateKey(selectedDate)) || [];
  }, [visibleEventsByDateKey, selectedDate]);

  const activeRegistrationEventsForSelectedDate = useMemo(() => {
    return selectedDayEvents.filter(
      (event) => event.eventType === "registration" && !isPastEvent(event)
    );
  }, [selectedDayEvents]);

  useEffect(() => {
    if (!showDayEventsModal || !teacherCode || selectedDayEvents.length === 0) {
      return;
    }

    const eventIds = selectedDayEvents.map((event) => event.id).join(',');

    (async () => {
      try {
        const response = await fetch(
          `/api/event-schedule-participants?teacher_code=${encodeURIComponent(teacherCode)}&event_ids=${encodeURIComponent(eventIds)}`
        );
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Không thể tải phản hồi tham gia');
        }

        const next: Record<string, ParticipationStatus> = {};
        (data.data || []).forEach((row: { event_id: string; response_status: ParticipationStatus }) => {
          if (row.event_id && row.response_status) {
            next[row.event_id] = row.response_status;
          }
        });
        setParticipationByEvent(next);
      } catch (error) {
        console.error('Failed to load participation response:', error);
        setParticipationByEvent({});
      }
    })();
  }, [showDayEventsModal, selectedDayEvents, teacherCode]);

  useEffect(() => {
    if (!showRegisterModal) return;
    setSelectedExamEventByOption((prev) => {
      const next: Record<string, string> = {};
      selectedOptions.forEach((option) => {
        const examEvents = upcomingExamEventsByOption[option] || [];
        next[option] =
          prev[option] && examEvents.some((e) => e.id === prev[option])
            ? prev[option]
            : examEvents[0]?.id || "";
      });
      return next;
    });
  }, [selectedOptions, upcomingExamEventsByOption, showRegisterModal]);

  const stepDate = (amount: number) => {
    const next = new Date(focusDate);

    if (view === "day") {
      next.setDate(next.getDate() + amount);
    } else if (view === "week") {
      next.setDate(next.getDate() + amount * 7);
    } else {
      next.setMonth(next.getMonth() + amount);
    }

    setFocusDate(next);
  };

  const activeRegistrationEventByDate = (date: Date) => {
    const dateEvents = eventsByDateKey.get(formatDateKey(date)) || [];
    return dateEvents.find(
      (event) => event.eventType === "registration" && !isPastEvent(event)
    );
  };

  const registrationEventByDate = (date: Date) => {
    const dateEvents = eventsByDateKey.get(formatDateKey(date)) || [];
    return dateEvents.find((event) => event.eventType === "registration");
  };

  const handleDayClick = (date: Date) => {
    if (isPastDate(date)) {
      return;
    }

    const dateEvents = visibleEventsByDateKey.get(formatDateKey(date)) || [];
    if (dateEvents.length === 0) {
      return;
    }

    const registrationEvent = dateEvents.find(
      (event) => event.eventType === "registration" && !isPastEvent(event)
    );
    if (registrationEvent) {
      setSelectedDate(date);
      openRegisterModalForEvent(registrationEvent);
      return;
    }

    setSelectedDate(date);
    setShowDayEventsModal(true);
  };

  const openRegisterModalFromDay = () => {
    if (!selectedDate) {
      return;
    }

    const registrationEvent = registrationEventByDate(selectedDate);
    if (!registrationEvent) {
      toast.error("Ngày này không có lịch đăng ký");
      return;
    }

    openRegisterModalForEvent(registrationEvent);
  };

  const openRegisterModalForEvent = (registrationEvent: EvaluationEvent) => {
    if (isPastEvent(registrationEvent)) {
      toast.error("Sự kiện đăng ký đã hết hạn");
      return;
    }

    setShowDayEventsModal(false);
    setSelectedOptions([]);
    setSelectedExamEventByOption({});
    setSelectedRegistrationEvent(registrationEvent);
    setShowRegisterModal(true);
  };

  const resolveValidTeacherCode = async () => {
    if (!user?.email) return "";

    // /api/teachers trả về teacher đã được đối soát với training_teacher_stats.
    try {
      const response = await fetch(`/api/teachers?email=${encodeURIComponent(user.email)}`);
      const data = await response.json();
      const resolved = (data?.teacher?.code || "").toString().trim();

      if (response.ok && data?.teacher && resolved) {
        if (resolved !== teacherCode) {
          setTeacherCode(resolved);
        }
        return resolved;
      }
    } catch {
    }

    return "";
  };

  const handleParticipationResponse = async (eventId: string, responseStatus: ParticipationStatus) => {
    if (!teacherCode.trim()) {
      toast.error("Không xác định được mã giáo viên");
      return;
    }

    const event = events.find((item) => item.id === eventId);
    if (event && isPastEvent(event)) {
      toast.error("Sự kiện đã qua, không thể phản hồi");
      return;
    }

    try {
      setRespondingEventId(eventId);
      const response = await fetch('/api/event-schedule-participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          teacher_code: teacherCode,
          teacher_name: teacherName || user?.displayName || teacherCode,
          teacher_email: user?.email || null,
          response_status: responseStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể cập nhật phản hồi tham gia');
      }

      setParticipationByEvent((previous) => ({
        ...previous,
        [eventId]: responseStatus,
      }));

      toast.success(responseStatus === 'accepted' ? 'Bạn đã xác nhận tham gia' : 'Bạn đã từ chối tham gia');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu phản hồi');
    } finally {
      setRespondingEventId(null);
    }
  };

  const submitRegistration = async () => {
    if (selectedOptions.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 nội dung đăng ký");
      return;
    }

    if (!selectedDate) {
      toast.error("Không xác định được ngày đăng ký");
      return;
    }

    const validTeacherCode = await resolveValidTeacherCode();
    if (!validTeacherCode) {
      toast.error("Không xác định được mã giáo viên hợp lệ từ hồ sơ. Vui lòng kiểm tra lại email/mã GV hoặc liên hệ admin.");
      return;
    }

    const registrationEvent = selectedRegistrationEvent || registrationEventByDate(selectedDate);
    if (!registrationEvent || isPastEvent(registrationEvent)) {
      toast.error("Đợt đăng ký này đã hết hạn");
      return;
    }
    const registrationType = registrationEvent?.registrationTemplate === "supplement" ? "additional" : "official";
    const sourceForm = registrationEvent?.registrationTemplate === "supplement" ? "additional_form" : "main_form";

    const submittedOptions: string[] = [];
    const failedOptions: string[] = [];
    const failedDetails: string[] = [];

    try {
      setSubmitting(true);

      for (const option of selectedOptions) {
        if (userRegisteredSubjects.has(option)) {
          failedOptions.push(option);
          failedDetails.push(`${option}: bạn đã đăng ký môn này trước đó`);
          continue;
        }

        const mapped = REGISTER_OPTION_MAP[option];
        if (!mapped) {
          failedOptions.push(option);
          failedDetails.push(`${option}: chưa có mapping dữ liệu`);
          continue;
        }

        const hasActiveSetForOption = availableOptions.has(option);
        if (!hasActiveSetForOption) {
          failedOptions.push(option);
          failedDetails.push(`${option}: chưa có bộ đề active`);
          continue;
        }

        const examEventId = selectedExamEventByOption[option];
        const matchedExamEvent = examEventId
          ? events.find((e) => e.id === examEventId) || null
          : null;

        if (!matchedExamEvent) {
          failedOptions.push(option);
          failedDetails.push(`${option}: chưa chọn lịch thi`);
          continue;
        }

        const scheduledAt = parseLocalDateTime(matchedExamEvent.startAt);
        const closeAt = parseLocalDateTime(matchedExamEvent.endAt);

        const response = await fetch('/api/exam-registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_code: validTeacherCode,
            exam_type: mapped.exam_type,
            registration_type: registrationType,
            block_code: mapped.block_code,
            subject_code: mapped.subject_code,
            center_code: teacherCenterCode || null,
            scheduled_at: scheduledAt.toISOString(),
            source_form: sourceForm,
            open_at: scheduledAt.toISOString(),
            close_at: closeAt.toISOString(),
          }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          submittedOptions.push(option);
        } else {
          const errMsg = data?.error || 'lỗi không xác định';
          failedOptions.push(option);
          failedDetails.push(`${option}: ${errMsg}`);
          console.error('[Registration] Failed:', { option, errMsg, teacher_code: validTeacherCode, block_code: mapped.block_code, subject_code: mapped.subject_code });
        }
      }
    } finally {
      setSubmitting(false);
    }

    if (submittedOptions.length > 0) {
      setUserRegisteredSubjects((prev) => {
        const next = new Set(prev);
        submittedOptions.forEach((option) => next.add(option));
        return next;
      });
      toast.success(`Đăng ký thành công ${submittedOptions.length} nội dung`);
      setShowRegisterModal(false);
      setSelectedOptions([]);
      setSelectedRegistrationEvent(null);
    }

    if (failedOptions.length > 0) {
      const firstDetail = failedDetails[0] || failedOptions.join(', ');
      toast.error(`Đăng ký thất bại: ${firstDetail}`, { duration: 6000 });
      if (failedDetails.length > 1) {
        setTimeout(() => toast.error(failedDetails.slice(1).join('\n'), { duration: 6000 }), 500);
      }
      console.warn('Registration failed details:', failedDetails);
    }
  };

  const toggleOption = (option: string) => {
    setSelectedOptions((previous) =>
      previous.includes(option)
        ? previous.filter((item) => item !== option)
        : [...previous, option]
    );
  };

  return (
    <PageContainer
      title="CÁC HOẠT ĐỘNG HÀNG THÁNG"
      description=""
    >
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
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => stepDate(1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {[
              { value: "day" as CalendarView, label: "Ngày" },
              { value: "week" as CalendarView, label: "Tuần" },
              { value: "month" as CalendarView, label: "Tháng" },
            ].map((option) => (
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
          </div>
        </div>

        <div className="px-4 py-2 text-sm font-semibold text-gray-700 border-b border-gray-200 bg-gray-50">
          {periodLabel}
        </div>

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
            const isToday = isSameDate(startOfDay(date), startOfDay(new Date()));
            const dateKey = formatDateKey(date);
            const dayEvents = visibleEventsByDateKey.get(dateKey) || [];
            const hasRegistrationEvent = Boolean(registrationEventByDate(date));
            const hasActiveRegistration = Boolean(activeRegistrationEventByDate(date));
            const isPastCalendarDate = isPastDate(date);

            return (
              <div
                key={dateKey}
                className={`min-h-28 border-r border-b border-gray-200 p-2 ${
                  isToday
                    ? "bg-yellow-50 border-yellow-300"
                    : inCurrentMonth
                      ? "bg-white"
                      : "bg-gray-50"
                  } ${dayEvents.length > 0 && !isPastCalendarDate ? "cursor-pointer hover:bg-blue-50" : ""} ${isPastCalendarDate ? "opacity-60" : ""}`}
                onClick={() => handleDayClick(date)}
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

                  {hasActiveRegistration && !isPastCalendarDate && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      Đăng ký
                    </span>
                  )}
                  {(isPastCalendarDate || (hasRegistrationEvent && !hasActiveRegistration)) && (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                      Quá hạn
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => {
                    const calendarEventStyle = getCalendarEventStyle(event.eventType);

                    if (event.eventType === "registration") {
                      return (
                        <div
                          key={event.id}
                          className={`rounded-sm px-1 py-1 text-center text-[11px] leading-4 font-bold whitespace-pre-line ${calendarEventStyle.titleClassName}`}
                          title={event.title.replace(/\n/g, " ")}
                        >
                          {event.title}
                        </div>
                      );
                    }

                    return (
                      <div key={event.id} className="flex items-start gap-1">
                        <div className={`w-18 shrink-0 text-[11px] font-semibold leading-4 ${calendarEventStyle.timeClassName}`}>
                          {formatEventTimeRange(event.startAt, event.endAt)}
                        </div>
                        <div className={`flex-1 rounded-sm px-1 py-1 text-[11px] leading-4 font-semibold text-center ${calendarEventStyle.titleClassName}`}>
                          {event.title}
                        </div>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[11px] font-semibold text-gray-500">
                      +{dayEvents.length - 3} sự kiện khác
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {showDayEventsModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-bold text-gray-900">
                Sự kiện ngày {selectedDate.toLocaleDateString("vi-VN")}
              </h3>
              <button
                onClick={() => setShowDayEventsModal(false)}
                className="rounded-md p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-4">
              {selectedDayEvents.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Không có sự kiện nào trong ngày này.
                </div>
              ) : (
                selectedDayEvents.map((event) => {
                  const eventIsPast = isPastEvent(event);
                  const canRespond = event.eventType !== "registration" && event.eventType !== "holiday" && !eventIsPast;
                  const canRegister = event.eventType === "registration" && !eventIsPast;

                  return (
                  <div key={event.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getEventClass(event.eventType)}`}>
                        {EVENT_TYPE_LABELS[event.eventType || "exam"]}
                      </span>
                      <span className="text-xs font-semibold text-blue-700">
                        {formatEventTimeRange(event.startAt, event.endAt)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-semibold whitespace-pre-line text-gray-900">{event.title}</p>

                    <div className="mt-2 grid gap-1 text-sm text-gray-700">
                      <p>
                        <span className="font-semibold">Chuyên môn:</span> {event.specialty || "-"}
                      </p>
                      <p>
                        <span className="font-semibold">Bắt đầu:</span> {formatDateTime(event.startAt)}
                      </p>
                      <p>
                        <span className="font-semibold">Kết thúc:</span> {formatDateTime(event.endAt)}
                      </p>
                      {event.registrationTemplate && (
                        <p>
                          <span className="font-semibold">Mẫu đăng ký:</span>{" "}
                          {REGISTRATION_TEMPLATE_LABELS[event.registrationTemplate]}
                        </p>
                      )}
                      {event.note && (
                        <p className="whitespace-pre-line">
                          <span className="font-semibold">Ghi chú:</span> {event.note}
                        </p>
                      )}
                      {eventIsPast && (
                        <p className="text-xs font-semibold text-gray-500">Sự kiện đã qua</p>
                      )}
                    </div>

                    {canRegister && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <button
                          onClick={() => openRegisterModalForEvent(event)}
                          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          {event.registrationTemplate === "supplement"
                            ? "Đăng ký kiểm tra chuyên sâu bổ sung"
                            : "Đăng ký kiểm tra chuyên sâu chính thức"}
                        </button>
                      </div>
                    )}

                    {canRespond && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <p className="mb-2 text-xs font-semibold text-gray-600">Xác nhận tham gia sự kiện</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleParticipationResponse(event.id, "accepted")}
                            disabled={respondingEventId === event.id}
                            className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                              participationByEvent[event.id] === "accepted"
                                ? "border-green-500 bg-green-600 text-white"
                                : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {respondingEventId === event.id ? "Đang lưu..." : "Tham gia"}
                          </button>
                          <button
                            onClick={() => handleParticipationResponse(event.id, "declined")}
                            disabled={respondingEventId === event.id}
                            className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                              participationByEvent[event.id] === "declined"
                                ? "border-red-500 bg-red-600 text-white"
                                : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                            }`}
                          >
                            {respondingEventId === event.id ? "Đang lưu..." : "Từ chối"}
                          </button>
                          {participationByEvent[event.id] === "accepted" && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                              Bạn đã xác nhận tham gia
                            </span>
                          )}
                          {participationByEvent[event.id] === "declined" && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                              Bạn đã từ chối tham gia
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
              {activeRegistrationEventsForSelectedDate.length > 0 && (
                <button
                  onClick={openRegisterModalFromDay}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Mở đăng ký
                </button>
              )}
              <button
                onClick={() => setShowDayEventsModal(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegisterModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-bold text-gray-900">
                Form đăng ký kiểm tra - {selectedDate.toLocaleDateString("vi-VN")}
              </h3>
              <button
                onClick={() => {
                  setShowRegisterModal(false);
                  setSelectedRegistrationEvent(null);
                }}
                className="rounded-md p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
              {selectedRegistrationEvent && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <p className="font-semibold">Đợt đăng ký đang chọn</p>
                  <p className="mt-1 whitespace-pre-line">{selectedRegistrationEvent.title}</p>
                  <p className="mt-1 text-xs">
                    Thời gian: {formatDateTime(selectedRegistrationEvent.startAt)} - {formatDateTime(selectedRegistrationEvent.endAt)}
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-700 font-medium">
                Nội dung đăng ký kiểm tra chuyên sâu <span className="text-red-600">*</span>
              </p>
              <p className="text-sm text-gray-500">Các bạn vui lòng chọn ít nhất 1 option</p>

              {REGISTER_OPTIONS.map((option) => {
                const isAvailable = availableOptions.has(option);
                const isSelected = selectedOptions.includes(option);
                const examEvents = upcomingExamEventsByOption[option] || [];
                const hasExamEvents = examEvents.length > 0;
                const isAlreadyRegistered = userRegisteredSubjects.has(option);
                const isDisabled = !isAvailable || !hasExamEvents || isAlreadyRegistered;
                const selectedEventId = selectedExamEventByOption[option] || "";

                return (
                  <div key={option} className="space-y-1">
                    <label
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${
                        isDisabled
                          ? "border-gray-100 bg-gray-50 text-gray-400"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggleOption(option)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      />
                      <span className={`text-sm ${isDisabled ? "text-gray-400" : "text-gray-900"}`}>
                        {option}
                        {isAlreadyRegistered && " (đã đăng ký)"}
                        {!isAvailable && " (chưa có đề)"}
                        {!isAlreadyRegistered && isAvailable && !hasExamEvents && " (chưa có lịch thi)"}
                      </span>
                    </label>

                    {isSelected && !isDisabled && (
                      <div className="ml-6 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                        <p className="mb-1 text-xs font-semibold text-blue-700">Lịch thi:</p>
                        {examEvents.length === 1 ? (
                          <p className="text-sm text-blue-900">
                            {formatDateTime(examEvents[0].startAt)} — {formatDateTime(examEvents[0].endAt)}
                          </p>
                        ) : (
                          <select
                            value={selectedEventId}
                            onChange={(e) =>
                              setSelectedExamEventByOption((prev) => ({
                                ...prev,
                                [option]: e.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-blue-300 bg-white px-2 py-1 text-sm"
                          >
                            {examEvents.map((event) => (
                              <option key={event.id} value={event.id}>
                                {formatDateTime(event.startAt)} — {formatDateTime(event.endAt)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => {
                  setShowRegisterModal(false);
                  setSelectedRegistrationEvent(null);
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Đóng
              </button>
              <button
                onClick={submitRegistration}
                disabled={submitting}
                className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                {submitting ? "Đang gửi..." : "Gửi đăng ký"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
