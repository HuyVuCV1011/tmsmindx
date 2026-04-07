"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/lib/auth-context";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type CalendarView = "day" | "week" | "month";
type EventCategory = "registration" | "exam" | "thi" | "workshop_teaching" | "meeting" | "advanced_training_release" | "holiday";

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

interface RegisteredExamParticipant {
  id: number;
  teacher_code: string;
  teacher_name: string | null;
  exam_type: "expertise" | "experience";
  subject_code: string;
  scheduled_at: string;
  assignment_status: string | null;
}

interface CalendarExamAssignment {
  id: number;
  registration_id?: number;
  exam_type: "expertise" | "experience";
  subject_code: string;
  open_at: string;
  close_at: string;
  event_schedule_id?: string | null;
  assignment_status: string;
  can_take: boolean;
  is_open: boolean;
  is_set_active_now: boolean;
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const EVENT_TYPE_LABELS: Record<EventCategory, string> = {
  registration: "A: Lịch đăng ký kiểm tra",
  exam: "B: Lịch kiểm tra chuyên môn",
  thi: "B: Lịch kiểm tra chuyên môn",
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
    case "thi":
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
    case "thi":
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

function getWeekStartMonday(date: Date) {
  const current = startOfDay(date);
  const start = new Date(current);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(current.getDate() + mondayOffset);
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

function normalizeSearchString(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeSubjectCode(value: string) {
  return normalizeSearchString(value || "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSameMinute(firstValue: string, secondValue: string) {
  const first = parseLocalDateTime(firstValue).getTime();
  const second = parseLocalDateTime(secondValue).getTime();
  return Math.abs(first - second) < 60 * 1000;
}

function toMinuteStamp(value: string) {
  return Math.floor(parseLocalDateTime(value).getTime() / (60 * 1000));
}

function isRegistrationActive(event: EvaluationEvent) {
  const now = new Date();
  return now >= parseLocalDateTime(event.startAt) && now <= parseLocalDateTime(event.endAt);
}

function extractCodeFromEmail(email: string) {
  return (email || "").split("@")[0]?.trim() || "";
}

function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function mapEventToRegisterPayloads(event: EvaluationEvent) {
  const eventTitle = normalizeSearchString(event.title || "");
  const eventSpecialty = normalizeSearchString(event.specialty || "");
  const eventText = `${eventTitle} ${eventSpecialty}`.trim();

  return Object.values(REGISTER_OPTION_MAP).filter((mapped) =>
    [...mapped.specialtyAliases, mapped.subject_code, mapped.optionLabel, ...mapped.subjectCodeCandidates].some(
      (alias) => {
        const normalizedAlias = normalizeSearchString(alias || "");
        return (
          normalizedAlias &&
          (eventText.includes(normalizedAlias) || normalizedAlias.includes(eventText))
        );
      }
    )
  );
}

function resolveExamActionStatus(assignment: CalendarExamAssignment | null) {
  if (!assignment) {
    return "Chưa có bài thi cho lịch này";
  }

  if (assignment.can_take) {
    return "Sẵn sàng làm bài";
  }

  if (!assignment.is_set_active_now) {
    return "Bộ đề đang tạm ngưng";
  }

  if (!assignment.is_open) {
    const now = Date.now();
    const openAt = new Date(assignment.open_at).getTime();
    const closeAt = new Date(assignment.close_at).getTime();
    if (now < openAt) {
      return "Chưa tới giờ mở bài";
    }
    if (now > closeAt) {
      return "Đã quá hạn làm bài";
    }
  }

  if (!["assigned", "in_progress"].includes(assignment.assignment_status)) {
    return `Trạng thái hiện tại: ${assignment.assignment_status}`;
  }

  return "Chưa thể làm bài";
}

function buildCalendarCells(focusDate: Date, view: CalendarView) {
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
  const monthStartOffset = monthStartDay === 0 ? 6 : monthStartDay - 1;
  gridStart.setDate(monthStart.getDate() - monthStartOffset);

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inCurrentMonth: date.getMonth() === focusDate.getMonth() };
  });
}

export default function MonthlyActivitiesPage() {
  const { user } = useAuth();
  const router = useRouter();
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
  const [teacherCenterCode, setTeacherCenterCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registeredParticipantsByEvent, setRegisteredParticipantsByEvent] = useState<Record<string, RegisteredExamParticipant[]>>({});
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsForEvent, setParticipantsForEvent] = useState<RegisteredExamParticipant[]>([]);
  const [participantsEvent, setParticipantsEvent] = useState<EvaluationEvent | null>(null);
  const [userRegisteredSubjects, setUserRegisteredSubjects] = useState<Set<string>>(new Set());
  const [registeredScheduleTimesByOption, setRegisteredScheduleTimesByOption] = useState<Record<string, string[]>>({});
  const [registeredExamEventIdsByOption, setRegisteredExamEventIdsByOption] = useState<Record<string, string[]>>({});
  const [selectedExamEventByOption, setSelectedExamEventByOption] = useState<Record<string, string>>({});
  const [examAssignments, setExamAssignments] = useState<CalendarExamAssignment[]>([]);

  const resolveExamEventIdByOptionAndSchedule = useCallback(
    (option: string, scheduledAt: string) => {
      const scheduledStamp = toMinuteStamp(scheduledAt);
      const matched = events.find((event) => {
        if (event.eventType !== "exam") {
          return false;
        }

        if (toMinuteStamp(event.startAt) !== scheduledStamp) {
          return false;
        }

        const mappedPayloads = mapEventToRegisterPayloads(event);
        return mappedPayloads.some((mapped) => mapped.optionLabel === option);
      });

      return matched?.id || "";
    },
    [events]
  );

  useEffect(() => {
    if (!user?.email) return;

    (async () => {
      try {
        const response = await fetch(`/api/teachers?email=${encodeURIComponent(user.email)}&basic=1`);
        const data = await response.json();
        if (data?.teacher?.code) {
          setTeacherCode(data.teacher.code);
          if (data?.teacher?.branchCurrent) {
            setTeacherCenterCode(String(data.teacher.branchCurrent));
          }
          return;
        }
      } catch {
      }

      const fallback = user.email.split('@')[0] || '';
      setTeacherCode(fallback);
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
        const scheduleTimesByOption: Record<string, string[]> = {};
        const eventIdsByOption: Record<string, string[]> = {};

        (data.data || []).forEach((row: { block_code: string; subject_code: string; scheduled_at: string; scheduled_event_id?: string | null }) => {
          Object.entries(REGISTER_OPTION_MAP).forEach(([option, mapped]) => {
            if (mapped.block_code === row.block_code && mapped.subject_code === row.subject_code) {
              registeredSet.add(option);
              if (!scheduleTimesByOption[option]) {
                scheduleTimesByOption[option] = [];
              }
              if (row.scheduled_at) {
                scheduleTimesByOption[option].push(row.scheduled_at);

                const rawEventId = (row.scheduled_event_id || '').toString().trim();
                const isExamEventId =
                  !!rawEventId &&
                  events.some((event) => event.id === rawEventId && event.eventType === 'exam');
                const eventId = isExamEventId
                  ? rawEventId
                  : resolveExamEventIdByOptionAndSchedule(option, row.scheduled_at);
                if (eventId) {
                  if (!eventIdsByOption[option]) {
                    eventIdsByOption[option] = [];
                  }

                  if (!eventIdsByOption[option].includes(eventId)) {
                    eventIdsByOption[option].push(eventId);
                  }
                }
              }
            }
          });
        });
        setUserRegisteredSubjects(registeredSet);
        setRegisteredScheduleTimesByOption(scheduleTimesByOption);
        setRegisteredExamEventIdsByOption(eventIdsByOption);
      } catch {
      }
    })();
  }, [teacherCode, resolveExamEventIdByOptionAndSchedule]);

  const fetchExamAssignmentsForMonth = useCallback(
    async (targetDate: Date) => {
      const candidates = new Set<string>();
      const normalizedTeacherCode = teacherCode?.trim();
      if (normalizedTeacherCode) {
        candidates.add(normalizedTeacherCode);
        candidates.add(normalizedTeacherCode.toLowerCase());
        candidates.add(normalizedTeacherCode.toUpperCase());
      }

      if (user?.email) {
        const emailCode = extractCodeFromEmail(user.email);
        if (emailCode) {
          candidates.add(emailCode);
          candidates.add(emailCode.toLowerCase());
          candidates.add(emailCode.toUpperCase());
        }
      }

      const candidateList = Array.from(candidates).filter(Boolean);
      if (candidateList.length === 0) {
        setExamAssignments([]);
        return;
      }

      const teacherCodeParam = normalizedTeacherCode || candidateList[0];
      const teacherCodesParam = encodeURIComponent(candidateList.join(","));
      const month = toMonthValue(targetDate);

      try {
        const response = await fetch(
          `/api/exam-assignments?teacher_code=${encodeURIComponent(
            teacherCodeParam
          )}&teacher_codes=${teacherCodesParam}&month=${month}`,
          { cache: "no-store" }
        );
        const data = await response.json();
        if (!response.ok || !data?.success) {
          setExamAssignments([]);
          return;
        }
        setExamAssignments((data.data || []) as CalendarExamAssignment[]);
      } catch {
        setExamAssignments([]);
      }
    },
    [teacherCode, user?.email]
  );

  useEffect(() => {
    const targetDate = selectedDate || focusDate;
    fetchExamAssignmentsForMonth(targetDate);
  }, [fetchExamAssignmentsForMonth, focusDate, selectedDate]);

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
        if (event.eventType !== "exam" && event.eventType !== "thi") return true;
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
        .filter((e) => e.eventType === "exam" || e.eventType === "thi")
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
      const start = getWeekStartMonday(focusDate);
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

  const examAssignmentByEventId = useMemo(() => {
    const next: Record<string, CalendarExamAssignment | null> = {};

    selectedDayEvents.forEach((event) => {
      if (event.eventType !== "exam" && event.eventType !== "thi") {
        next[event.id] = null;
        return;
      }

      const mappedPayloads = mapEventToRegisterPayloads(event);
      if (mappedPayloads.length === 0) {
        next[event.id] = null;
        return;
      }

      const matches = examAssignments.filter((assignment) => {
        if (assignment.event_schedule_id && assignment.event_schedule_id === event.id) {
          return true;
        }

        const hasMappedSubject = mappedPayloads.some(
          (mapped) => {
            if (mapped.exam_type !== assignment.exam_type) {
              return false;
            }

            const normalizedAssignmentSubject = normalizeSubjectCode(assignment.subject_code || "");
            if (!normalizedAssignmentSubject) {
              return false;
            }

            const candidates = [
              mapped.subject_code,
              mapped.optionLabel,
              ...mapped.subjectCodeCandidates,
            ]
              .map((candidate) => normalizeSubjectCode(candidate || ""))
              .filter(Boolean);

            return candidates.some(
              (candidate) =>
                candidate === normalizedAssignmentSubject ||
                candidate.includes(normalizedAssignmentSubject) ||
                normalizedAssignmentSubject.includes(candidate)
            );
          }
        );

        if (!hasMappedSubject) {
          return false;
        }

        const assignmentOpenAt = parseLocalDateTime(assignment.open_at);
        const eventStartAt = parseLocalDateTime(event.startAt);
        return isSameDate(assignmentOpenAt, eventStartAt);
      });

      if (matches.length === 0) {
        next[event.id] = null;
        return;
      }

      matches.sort((first, second) => {
        if (first.can_take !== second.can_take) {
          return first.can_take ? -1 : 1;
        }

        const eventStartTime = parseLocalDateTime(event.startAt).getTime();
        const firstDistance = Math.abs(parseLocalDateTime(first.open_at).getTime() - eventStartTime);
        const secondDistance = Math.abs(parseLocalDateTime(second.open_at).getTime() - eventStartTime);
        if (firstDistance !== secondDistance) {
          return firstDistance - secondDistance;
        }

        return parseLocalDateTime(second.open_at).getTime() - parseLocalDateTime(first.open_at).getTime();
      });

      next[event.id] = matches[0];
    });

    return next;
  }, [selectedDayEvents, examAssignments]);

  const activeRegistrationEventsForSelectedDate = useMemo(() => {
    return selectedDayEvents.filter(
      (event) => event.eventType === "registration" && !isPastEvent(event)
    );
  }, [selectedDayEvents]);

  useEffect(() => {
    if (!showDayEventsModal || selectedDayEvents.length === 0) {
      return;
    }

    const relevantEvents = selectedDayEvents.filter(
      (event) => event.eventType === "exam" || event.eventType === "thi" || !event.eventType
    );

    if (relevantEvents.length === 0) {
      setRegisteredParticipantsByEvent({});
      return;
    }

    (async () => {
      try {
        const targetDate = selectedDate || parseLocalDateTime(relevantEvents[0].startAt);
        const monthValue = `${targetDate.getFullYear()}-${`${targetDate.getMonth() + 1}`.padStart(2, "0")}`;
        const response = await fetch(`/api/exam-registrations?month=${monthValue}`);
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "Không thể tải danh sách đăng ký");
        }

        const registrationRows = (data.data || []) as RegisteredExamParticipant[];
        const next: Record<string, RegisteredExamParticipant[]> = {};

        relevantEvents.forEach((event) => {
          const matchedMappings = mapEventToRegisterPayloads(event);

          const subjectCodes = new Set(matchedMappings.map((mapped) => mapped.subject_code));
          const examTypes = new Set(matchedMappings.map((mapped) => mapped.exam_type));

          next[event.id] = registrationRows.filter((row) => {
            if (!subjectCodes.has(row.subject_code)) {
              return false;
            }
            if (!examTypes.has(row.exam_type)) {
              return false;
            }
            return isSameMinute(row.scheduled_at, event.startAt);
          });
        });

        setRegisteredParticipantsByEvent(next);
      } catch (error) {
        console.error("Failed to load registered participants:", error);
        setRegisteredParticipantsByEvent({});
      }
    })();
  }, [showDayEventsModal, selectedDayEvents, selectedDate]);

  useEffect(() => {
    if (!showRegisterModal) return;
    setSelectedExamEventByOption((prev) => {
      const next: Record<string, string> = {};
      REGISTER_OPTIONS.forEach((option) => {
        const examEvents = upcomingExamEventsByOption[option] || [];
        next[option] =
          prev[option] && examEvents.some((e) => e.id === prev[option])
            ? prev[option]
            : examEvents[0]?.id || "";
      });
      return next;
    });
  }, [upcomingExamEventsByOption, showRegisterModal]);

  useEffect(() => {
    const hasOpenModal = showParticipantsModal || showRegisterModal || showDayEventsModal;
    if (!hasOpenModal) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (showParticipantsModal) {
        setShowParticipantsModal(false);
        setParticipantsEvent(null);
        setParticipantsForEvent([]);
        return;
      }

      if (showRegisterModal) {
        setShowRegisterModal(false);
        setSelectedRegistrationEvent(null);
        return;
      }

      if (showDayEventsModal) {
        setShowDayEventsModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showDayEventsModal, showRegisterModal, showParticipantsModal]);

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
    if (registrationEvent && dateEvents.length === 1) {
      setSelectedDate(date);
      openRegisterModalForEvent(registrationEvent);
      return;
    }

    setSelectedDate(date);
    setShowDayEventsModal(true);
  };

  const handleDayEventClick = (date: Date, event: EvaluationEvent) => {
    if (isPastDate(date) || isPastEvent(event)) {
      return;
    }

    setSelectedDate(date);

    if (event.eventType === "registration") {
      openRegisterModalForEvent(event);
      return;
    }

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

    const preselectedOptions = REGISTER_OPTIONS.filter((option) => {
      const examEvents = upcomingExamEventsByOption[option] || [];
      const preferredEventId =
        selectedExamEventByOption[option] || examEvents[0]?.id || "";
      if (!preferredEventId) {
        return false;
      }
      return (registeredExamEventIdsByOption[option] || []).includes(preferredEventId);
    });

    setShowDayEventsModal(false);
    setSelectedOptions(preselectedOptions);
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

  const openParticipantsList = async (event: EvaluationEvent) => {
    setParticipantsEvent(event);
    setShowParticipantsModal(true);
    setParticipantsLoading(true);

    try {
      const list = registeredParticipantsByEvent[event.id] || [];
      setParticipantsForEvent(list);
    } finally {
      setParticipantsLoading(false);
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
    const submittedSlots: Array<{ option: string; scheduledAt: string }> = [];
    const failedOptions: string[] = [];
    const failedDetails: string[] = [];

    // Read teacher info from localStorage for chuyen_sau_results auto-fill
    let teacherAutoFillData: { teacher_name?: string; email?: string; campus?: string; lms_code?: string } = {};
    try {
      const cached = typeof window !== 'undefined' ? localStorage.getItem('teacher_auto_fill_data') : null;
      if (cached) teacherAutoFillData = JSON.parse(cached);
    } catch {
      // ignore localStorage errors
    }

    try {
      setSubmitting(true);

      for (const option of selectedOptions) {
        const examEvents = upcomingExamEventsByOption[option] || [];

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
        const matchedExamEvent =
          (examEventId ? events.find((e) => e.id === examEventId) || null : null) ||
          (examEvents.length === 1 ? examEvents[0] : null);

        if (!matchedExamEvent) {
          failedOptions.push(option);
          failedDetails.push(`${option}: chưa chọn lịch thi`);
          continue;
        }

        const targetEventId = examEventId || matchedExamEvent.id;
        const alreadyRegisteredSameSlot =
          !!targetEventId &&
          (registeredExamEventIdsByOption[option] || []).includes(targetEventId);

        if (alreadyRegisteredSameSlot) {
          failedOptions.push(option);
          failedDetails.push(`${option}: bạn đã đăng ký lịch thi này`);
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
            scheduled_event_id: targetEventId,
            teacher_info: teacherAutoFillData,
          }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          submittedOptions.push(option);
          submittedSlots.push({ option, scheduledAt: matchedExamEvent.startAt });
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

      setRegisteredScheduleTimesByOption((prev) => {
        const next: Record<string, string[]> = { ...prev };
        submittedSlots.forEach(({ option, scheduledAt }) => {
          const existing = next[option] || [];
          const hasSameSlot = existing.some((value) => toMinuteStamp(value) === toMinuteStamp(scheduledAt));
          if (!hasSameSlot) {
            next[option] = [...existing, scheduledAt];
          }
        });
        return next;
      });

      setRegisteredExamEventIdsByOption((prev) => {
        const next: Record<string, string[]> = { ...prev };
        submittedOptions.forEach((option) => {
          const selectedEventId = selectedExamEventByOption[option] || "";
          if (!selectedEventId) {
            return;
          }

          const existing = next[option] || [];
          if (!existing.includes(selectedEventId)) {
            next[option] = [...existing, selectedEventId];
          }
        });
        return next;
      });

      toast.success(`Đăng ký thành công ${submittedOptions.length} nội dung`);
      setShowRegisterModal(false);
      setSelectedOptions([]);
      setSelectedRegistrationEvent(null);

      const firstSubmittedOption = submittedOptions[0];
      const firstSubmittedExamEventId = selectedExamEventByOption[firstSubmittedOption];
      const firstSubmittedExamEvent = events.find((event) => event.id === firstSubmittedExamEventId);
      const refreshDate = firstSubmittedExamEvent
        ? parseLocalDateTime(firstSubmittedExamEvent.startAt)
        : selectedDate || focusDate;
      await fetchExamAssignmentsForMonth(refreshDate);
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
            const isPastCalendarDate = isPastDate(date);
            const dayEvents = isPastCalendarDate ? [] : visibleEventsByDateKey.get(dateKey) || [];
            const hasActiveRegistration = !isPastCalendarDate && Boolean(activeRegistrationEventByDate(date));

            return (
              <div
                key={dateKey}
                className={`min-h-28 flex flex-col border-r border-b border-gray-200 p-2 ${
                  isPastCalendarDate
                    ? "bg-gray-100"
                    : isToday
                    ? "bg-yellow-50 border-yellow-300"
                    : inCurrentMonth
                      ? "bg-white"
                      : "bg-gray-50"
                  } ${dayEvents.length > 0 && !isPastCalendarDate ? "cursor-pointer hover:bg-blue-50" : ""}`}
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
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => {
                    const calendarEventStyle = getCalendarEventStyle(event.eventType);

                    if (event.eventType === "registration") {
                      return (
                        <button
                          type="button"
                          key={event.id}
                          className={`rounded-sm px-1 py-1 text-center text-[11px] leading-4 font-bold whitespace-pre-line ${calendarEventStyle.titleClassName}`}
                          title={event.title.replace(/\n/g, " ")}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDayEventClick(date, event);
                          }}
                        >
                          {event.title}
                        </button>
                      );
                    }

                    return (
                      <button
                        type="button"
                        key={event.id}
                        className="flex w-full items-start gap-1 text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDayEventClick(date, event);
                        }}
                        title={event.title.replace(/\n/g, " ")}
                      >
                        <div className={`w-18 shrink-0 text-[11px] font-semibold leading-4 ${calendarEventStyle.timeClassName}`}>
                          {formatEventTimeRange(event.startAt, event.endAt)}
                        </div>
                        <div className={`flex-1 rounded-sm px-1 py-1 text-[11px] leading-4 font-semibold text-center ${calendarEventStyle.titleClassName}`}>
                          {event.title}
                        </div>
                      </button>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-gray-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate(date);
                        setShowDayEventsModal(true);
                      }}
                    >
                      +{dayEvents.length - 3} sự kiện khác
                    </button>
                  )}
                </div>
                <div className="flex-1" />
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
                  const canRegister = event.eventType === "registration" && !eventIsPast;
                  const supportsParticipantList = event.eventType === "exam" || !event.eventType;
                  const registeredCount = (registeredParticipantsByEvent[event.id] || []).length;
                  const matchedExamAssignment = examAssignmentByEventId[event.id] || null;
                  const examActionStatus = resolveExamActionStatus(matchedExamAssignment);
                  const canTakeExamNow = Boolean(matchedExamAssignment?.can_take);

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

                    {supportsParticipantList && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <p className="mb-2 text-xs font-semibold text-gray-600">Người tham gia</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                            {registeredCount} người đăng ký
                          </span>
                          <button
                            onClick={() => openParticipantsList(event)}
                            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Xem danh sách
                          </button>
                          {eventIsPast && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                              Sự kiện đã kết thúc
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {event.eventType === "exam" && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <p className="mb-2 text-xs font-semibold text-gray-600">Làm bài kiểm tra</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              canTakeExamNow
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {examActionStatus}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!matchedExamAssignment) {
                                toast.error("Chưa tạo assignment cho lịch thi này");
                                return;
                              }

                              if (!matchedExamAssignment.can_take) {
                                toast.error(examActionStatus);
                                return;
                              }

                              setShowDayEventsModal(false);
                              router.push(`/user/assignments/exam/${matchedExamAssignment.id}`);
                            }}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                              canTakeExamNow
                                ? "bg-green-600 text-white hover:bg-green-700"
                                : "cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-500"
                            }`}
                          >
                            Làm bài
                          </button>
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

      {showParticipantsModal && participantsEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Danh sách người đăng ký</h3>
                <p className="mt-1 text-xs text-gray-600">{participantsEvent.title}</p>
              </div>
              <button
                onClick={() => {
                  setShowParticipantsModal(false);
                  setParticipantsEvent(null);
                  setParticipantsForEvent([]);
                }}
                className="rounded-md p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {participantsLoading ? (
                <div className="py-8 text-center text-sm text-gray-500">Đang tải danh sách...</div>
              ) : participantsForEvent.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Chưa có giáo viên đăng ký làm bài cho lịch này.
                </div>
              ) : (
                <div className="space-y-2">
                  {participantsForEvent.map((participant, index) => (
                    <div
                      key={participant.id || `${participant.teacher_code}-${index}`}
                      className="rounded-md border border-gray-200 px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        {participant.teacher_name || participant.teacher_code}
                      </p>
                      <p className="text-xs text-gray-600">Mã GV: {participant.teacher_code}</p>
                      <p className="text-xs text-gray-600">Trạng thái bài: {participant.assignment_status || "pending"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => {
                  setShowParticipantsModal(false);
                  setParticipantsEvent(null);
                  setParticipantsForEvent([]);
                }}
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
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="font-semibold">Thứ tự thao tác</p>
                <p className="mt-1">1. Chọn lịch thi theo từng môn trước.</p>
                <p>2. Tick môn muốn đăng ký rồi bấm Gửi đăng ký.</p>
              </div>

              {REGISTER_OPTIONS.filter((option) => (upcomingExamEventsByOption[option] || []).length > 0).map((option) => {
                const isAvailable = availableOptions.has(option);
                const isSelected = selectedOptions.includes(option);
                const examEvents = upcomingExamEventsByOption[option] || [];
                const hasExamEvents = examEvents.length > 0;
                const selectedEventId = selectedExamEventByOption[option] || "";
                const selectedExamEvent =
                  (selectedEventId ? examEvents.find((event) => event.id === selectedEventId) : null) ||
                  examEvents[0] ||
                  null;
                const effectiveSelectedEventId = selectedEventId || selectedExamEvent?.id || "";
                const hasAnyRegistration = userRegisteredSubjects.has(option);
                const isAlreadyRegisteredForSelectedEvent =
                  !!effectiveSelectedEventId &&
                  (registeredExamEventIdsByOption[option] || []).includes(effectiveSelectedEventId);
                const isDisabled = !isAvailable || !hasExamEvents || isAlreadyRegisteredForSelectedEvent;

                return (
                  <div
                    key={option}
                    className={`space-y-2 rounded-lg border p-3 ${
                      isDisabled ? "border-gray-200 bg-gray-50" : "border-blue-200 bg-blue-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm font-semibold ${isDisabled ? "text-gray-500" : "text-gray-900"}`}>
                        {option}
                      </p>
                      {isSelected && !isDisabled && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                          Đã chọn đăng ký
                        </span>
                      )}
                    </div>

                    <div className="rounded-md border border-blue-200 bg-white px-3 py-2">
                      <p className="mb-1 text-xs font-semibold text-blue-700">Lịch thi</p>
                      {!hasExamEvents ? (
                        <p className="text-sm text-gray-500">Chưa có lịch thi</p>
                      ) : examEvents.length === 1 ? (
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
                          disabled={!hasExamEvents}
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

                    <label
                      className={`flex items-start gap-2 rounded-md border px-3 py-2 ${
                        isDisabled
                          ? "border-gray-200 bg-gray-100 text-gray-400"
                          : "border-gray-300 bg-white hover:bg-gray-50"
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
                        Đăng ký môn này
                        {isAlreadyRegisteredForSelectedEvent && " (đã đăng ký lịch này)"}
                        {!isAlreadyRegisteredForSelectedEvent && hasAnyRegistration && " (đã đăng ký lịch khác)"}
                        {!isAvailable && " (chưa có đề)"}
                      </span>
                    </label>
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
