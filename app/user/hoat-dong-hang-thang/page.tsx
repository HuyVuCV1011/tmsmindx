"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/lib/auth-context";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type CalendarView = "day" | "week" | "month";
type EventCategory = "registration" | "exam";

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

const STORAGE_KEY = "teacher_evaluation_schedule_events_v1";
const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const REGISTER_OPTIONS = [
  "[COD] Scratch",
  "[COD] GameMaker",
  "[COD] Web",
  "[COD] AppProducer",
  "[COD] ComputerScience",
  "[ROB] VexGo",
  "[ROB] VexIQ",
  "[ART] Test chuyên sâu",
  "Kiểm tra quy trình - kỹ năng trải nghiệm",
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
  "[COD] Scratch": {
    exam_type: "expertise",
    block_code: "CODING",
    subject_code: "SCRATCH",
    optionLabel: "[COD] Scratch",
    specialtyAliases: ["Coding - Scratch", "Scratch"],
    subjectCodeCandidates: ["SCRATCH", "[COD] Scratch"],
  },
  "[COD] GameMaker": {
    exam_type: "expertise",
    block_code: "CODING",
    subject_code: "GAMEMAKER",
    optionLabel: "[COD] GameMaker",
    specialtyAliases: ["Coding - Game", "GameMaker", "Coding - Gamemaker"],
    subjectCodeCandidates: ["GAMEMAKER", "[COD] GameMaker"],
  },
  "[COD] Web": {
    exam_type: "expertise",
    block_code: "CODING",
    subject_code: "WEB",
    optionLabel: "[COD] Web",
    specialtyAliases: ["Coding - Web", "Web"],
    subjectCodeCandidates: ["WEB", "[COD] Web"],
  },
  "[COD] AppProducer": {
    exam_type: "expertise",
    block_code: "CODING",
    subject_code: "[COD] AppProducer",
    optionLabel: "[COD] AppProducer",
    specialtyAliases: ["Coding - App", "AppProducer", "Coding - AppProducer"],
    subjectCodeCandidates: ["[COD] AppProducer", "APPPRODUCER"],
  },
  "[COD] ComputerScience": {
    exam_type: "expertise",
    block_code: "CODING",
    subject_code: "[COD] ComputerScience",
    optionLabel: "[COD] ComputerScience",
    specialtyAliases: ["Computer Science", "ComputerScience"],
    subjectCodeCandidates: ["[COD] ComputerScience", "COMPUTERSCIENCE"],
  },
  "[ROB] VexGo": {
    exam_type: "expertise",
    block_code: "ROBOTICS",
    subject_code: "VEXGO",
    optionLabel: "[ROB] VexGo",
    specialtyAliases: ["Robotics VexGo", "VexGo", "Robotics - VexGo"],
    subjectCodeCandidates: ["VEXGO", "[ROB] VexGo"],
  },
  "[ROB] VexIQ": {
    exam_type: "expertise",
    block_code: "ROBOTICS",
    subject_code: "VEXIQ",
    optionLabel: "[ROB] VexIQ",
    specialtyAliases: ["Robotics Vex IQ", "VexIQ", "Vex IQ", "Robotics - VexIQ"],
    subjectCodeCandidates: ["VEXIQ", "[ROB] VexIQ"],
  },
  "[ART] Test chuyên sâu": {
    exam_type: "expertise",
    block_code: "ART",
    subject_code: "TEST_CHUY_N_S_U",
    optionLabel: "[ART] Test chuyên sâu",
    specialtyAliases: ["Art", "Test chuyên sâu"],
    subjectCodeCandidates: ["TEST_CHUY_N_S_U", "[ART] Test chuyên sâu"],
  },
  "Kiểm tra quy trình - kỹ năng trải nghiệm": {
    exam_type: "experience",
    block_code: "TRIAL",
    subject_code: "QUY_TR_NH_TRAI_NGHI_M",
    optionLabel: "Kiểm tra quy trình - kỹ năng trải nghiệm",
    specialtyAliases: ["Quy trình quy định", "Quy trình - kỹ năng trải nghiệm"],
    subjectCodeCandidates: ["QUY_TR_NH_TRAI_NGHI_M", "[Trial] Quy Trình Trai nghiệm"],
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
  const start = new Date(startAt);
  const end = new Date(endAt);
  const hhmm = (value: Date) => {
    const h = value.getHours().toString().padStart(2, "0");
    const m = value.getMinutes().toString().padStart(2, "0");
    return `${h}h${m}`;
  };
  return `${hhmm(start)} - ${hhmm(end)}`;
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
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [availableOptions, setAvailableOptions] = useState<Set<string>>(new Set());
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherCenterCode, setTeacherCenterCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    (async () => {
      try {
        const response = await fetch(`/api/teachers?email=${encodeURIComponent(user.email)}`);
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
  }, [user?.email]);

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
    const loadEvents = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: EvaluationEvent[] = raw ? JSON.parse(raw) : [];
        setEvents(parsed.map((event) => ({ ...event, eventType: event.eventType || "exam" })));
      } catch {
        setEvents([]);
      }
    };

    loadEvents();
    window.addEventListener("storage", loadEvents);
    return () => window.removeEventListener("storage", loadEvents);
  }, []);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 9 }, (_, index) => currentYear - 3 + index);
  }, []);

  const calendarCells = useMemo(() => buildCalendarCells(focusDate, view), [focusDate, view]);

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, EvaluationEvent[]>();
    events.forEach((event) => {
      if (event.eventType === "registration") {
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
        const key = formatDateKey(new Date(event.startAt));
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
      const start = getWeekStartSunday(focusDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString("vi-VN")} - ${end.toLocaleDateString("vi-VN")}`;
    }

    return `Tháng ${focusDate.getMonth() + 1}/${focusDate.getFullYear()}`;
  }, [focusDate, view]);

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
    const now = new Date();
    return dateEvents.find(
      (event) =>
        event.eventType === "registration" &&
        now >= new Date(event.startAt) &&
        now <= new Date(event.endAt)
    );
  };

  const registrationEventByDate = (date: Date) => {
    const dateEvents = eventsByDateKey.get(formatDateKey(date)) || [];
    return dateEvents.find((event) => event.eventType === "registration");
  };

  const handleDayClick = (date: Date) => {
    const registrationEvent = registrationEventByDate(date);
    if (!registrationEvent) {
      return;
    }

    const now = new Date();
    const startAt = new Date(registrationEvent.startAt);
    const endAt = new Date(registrationEvent.endAt);

    if (now >= startAt && now <= endAt) {
      setSelectedDate(date);
      setSelectedOptions([]);
      setShowRegisterModal(true);
      return;
    }

    toast.error("Quá hạn đăng ký");
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

    if (!teacherCode.trim()) {
      toast.error("Không xác định được mã giáo viên");
      return;
    }

    const registrationEvent = registrationEventByDate(selectedDate);
    const registrationType = registrationEvent?.registrationTemplate === "supplement" ? "additional" : "official";
    const sourceForm = registrationEvent?.registrationTemplate === "supplement" ? "additional_form" : "main_form";

    const normalized = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const examEvents = events.filter((event) => event.eventType === "exam");

    const submittedOptions: string[] = [];
    const failedOptions: string[] = [];
    const failedDetails: string[] = [];

    try {
      setSubmitting(true);

      for (const option of selectedOptions) {
        const mapped = REGISTER_OPTION_MAP[option];
        if (!mapped) {
          failedOptions.push(option);
          failedDetails.push(`${option}: chưa có mapping dữ liệu`);
          continue;
        }

        const matchedExamEvents = examEvents
          .filter((event) => {
            const eventSpecialty = normalized(event.specialty || "");
            const eventTitle = normalized(event.title || "");
            return mapped.specialtyAliases.some((alias) => {
              const aliasNormalized = normalized(alias);
              return eventSpecialty.includes(aliasNormalized) || eventTitle.includes(aliasNormalized);
            });
          })
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

        const hasActiveSetForOption = availableOptions.has(option);
        if (!hasActiveSetForOption) {
          failedOptions.push(option);
          failedDetails.push(`${option}: chưa có bộ đề active`);
          continue;
        }

        const registrationEnd = registrationEvent ? new Date(registrationEvent.endAt) : null;
        const now = new Date();

        const futureAfterRegistration = matchedExamEvents.filter((event) => {
          const start = new Date(event.startAt);
          if (registrationEnd && start < registrationEnd) return false;
          return start >= now;
        });

        const futureFromNow = matchedExamEvents.filter((event) => new Date(event.startAt) >= now);

        const matchedExamEvent = futureAfterRegistration[0] || futureFromNow[0] || null;

        if (!matchedExamEvent) {
          failedOptions.push(option);
          failedDetails.push(`${option}: chưa có lịch thi kế tiếp hợp lệ`);
          continue;
        }

        const scheduledAt = matchedExamEvent
          ? new Date(matchedExamEvent.startAt)
          : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 21, 0, 0, 0);
        const closeAt = matchedExamEvent
          ? new Date(matchedExamEvent.endAt)
          : new Date(scheduledAt.getTime() + 45 * 60 * 1000);

        const response = await fetch('/api/exam-registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_code: teacherCode,
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
          failedOptions.push(option);
          failedDetails.push(`${option}: ${data?.error || 'lỗi không xác định'}`);
        }
      }
    } finally {
      setSubmitting(false);
    }

    if (submittedOptions.length > 0) {
      toast.success(`Đăng ký thành công ${submittedOptions.length} nội dung`);
      setShowRegisterModal(false);
      setSelectedOptions([]);
    }

    if (failedOptions.length > 0) {
      toast.error(`Không thể đăng ký: ${failedOptions.join(', ')}`);
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
      description="Lịch tổng hợp sự kiện đào tạo và đăng ký kiểm tra (quyền quan sát)"
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
            const dayEvents = eventsByDateKey.get(dateKey) || [];
            const hasRegistrationEvent = Boolean(registrationEventByDate(date));
            const hasActiveRegistration = Boolean(activeRegistrationEventByDate(date));

            return (
              <div
                key={dateKey}
                className={`min-h-28 border-r border-b border-gray-200 p-2 ${
                  isToday
                    ? "bg-yellow-50 border-yellow-300"
                    : inCurrentMonth
                      ? "bg-white"
                      : "bg-gray-50"
                } ${hasRegistrationEvent ? "cursor-pointer hover:bg-blue-50" : ""}`}
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

                  {hasActiveRegistration && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      Đăng ký
                    </span>
                  )}
                  {!hasActiveRegistration && hasRegistrationEvent && (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                      Quá hạn
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => {
                    if (event.eventType === "registration") {
                      return (
                        <div
                          key={event.id}
                          className="py-1 text-center text-[11px] leading-4 font-bold text-red-700 whitespace-pre-line"
                          title={event.title.replace(/\n/g, " ")}
                        >
                          {event.title}
                        </div>
                      );
                    }

                    return (
                      <div key={event.id} className="flex items-start gap-1">
                        <div className="w-18 shrink-0 text-[11px] font-semibold text-blue-700 leading-4">
                          {formatEventTimeRange(event.startAt, event.endAt)}
                        </div>
                        <div className="flex-1 rounded-sm px-1 py-1 text-[11px] leading-4 font-semibold text-center bg-green-200 text-green-900">
                          {event.title}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {showRegisterModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-bold text-gray-900">
                Form đăng ký kiểm tra - {selectedDate.toLocaleDateString("vi-VN")}
              </h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="rounded-md p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
              <p className="text-sm text-gray-700 font-medium">
                Nội dung đăng ký kiểm tra chuyên sâu <span className="text-red-600">*</span>
              </p>
              <p className="text-sm text-gray-500">Các bạn vui lòng chọn ít nhất 1 option</p>

              {REGISTER_OPTIONS.map((option) => (
                <label
                  key={option}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${
                    availableOptions.has(option)
                      ? "border-gray-200 hover:bg-gray-50"
                      : "border-gray-100 bg-gray-50 text-gray-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option)}
                    disabled={!availableOptions.has(option)}
                    onChange={() => toggleOption(option)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <span className={`text-sm ${availableOptions.has(option) ? "text-gray-900" : "text-gray-400"}`}>
                    {option}
                    {!availableOptions.has(option) && " (chưa có đề)"}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => setShowRegisterModal(false)}
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
