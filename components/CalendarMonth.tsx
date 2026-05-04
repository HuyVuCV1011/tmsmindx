"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useMemo, useState } from "react";

type CalendarView = "day" | "week" | "month";

interface PersonalCalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  type?: "work" | "meeting" | "training" | "personal";
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DAY_TIMELINE_START_HOUR = 5;
const DAY_TIMELINE_END_HOUR = 22;
const DAY_TIMELINE_ROW_HEIGHT = 56;

const DEMO_EVENTS: PersonalCalendarEvent[] = [
  {
    id: "1",
    title: "Họp team tuần",
    startAt: "2026-05-06T09:00:00",
    endAt: "2026-05-06T10:00:00",
    type: "meeting",
  },
  {
    id: "2",
    title: "Chuẩn bị học liệu",
    startAt: "2026-05-08T14:00:00",
    endAt: "2026-05-08T16:00:00",
    type: "work",
  },
  {
    id: "3",
    title: "Onboarding nội bộ",
    startAt: "2026-05-14T08:30:00",
    endAt: "2026-05-14T10:00:00",
    type: "training",
  },
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

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeRange(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const hhmm = (value: Date) =>
    `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  return `${hhmm(start)} - ${hhmm(end)}`;
}

function getEventChipClass(type: PersonalCalendarEvent["type"]) {
  switch (type) {
    case "meeting":
      return "bg-blue-100 text-blue-900 border-blue-200";
    case "training":
      return "bg-violet-100 text-violet-900 border-violet-200";
    case "personal":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "work":
    default:
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
  }
}

function getEventDotClass(type: PersonalCalendarEvent["type"]) {
  switch (type) {
    case "meeting":
      return "bg-blue-500";
    case "training":
      return "bg-violet-500";
    case "personal":
      return "bg-amber-500";
    case "work":
    default:
      return "bg-emerald-500";
  }
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
  const diff = monthStartDay === 0 ? -6 : 1 - monthStartDay;
  gridStart.setDate(monthStart.getDate() + diff);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inCurrentMonth: date.getMonth() === focusDate.getMonth() };
  });
}

const CalendarMonth = () => {
  const now = useMemo(() => new Date(), []);
  const [view, setView] = useState<CalendarView>("month");
  const [focusDate, setFocusDate] = useState(now);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(now));

  const calendarCells = useMemo(
    () => buildCalendarCells(focusDate, view),
    [focusDate, view],
  );

  const dayTimelineHours = useMemo(
    () =>
      Array.from(
        { length: DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR + 1 },
        (_, index) => DAY_TIMELINE_START_HOUR + index,
      ),
    [],
  );

  const visibleEventsByDateKey = useMemo(() => {
    const map = new Map<string, PersonalCalendarEvent[]>();
    DEMO_EVENTS.forEach((event) => {
      const dateKey = formatDateKey(new Date(event.startAt));
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, []);

  const selectedDayEvents = useMemo(() => {
    return visibleEventsByDateKey.get(formatDateKey(selectedDate)) || [];
  }, [selectedDate, visibleEventsByDateKey]);

  const periodLabel = useMemo(() => {
    if (view === "day") {
      return selectedDate.toLocaleDateString("vi-VN", {
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
  }, [focusDate, selectedDate, view]);

  const stepDate = (amount: number) => {
    const next = new Date(focusDate);

    if (view === "day") {
      next.setDate(next.getDate() + amount);
      setSelectedDate(startOfDay(next));
    } else if (view === "week") {
      next.setDate(next.getDate() + amount * 7);
      setSelectedDate(startOfDay(next));
    } else {
      next.setMonth(next.getMonth() + amount);
      setSelectedDate(startOfDay(next));
    }

    setFocusDate(next);
  };

  const dayTimelineEvents = useMemo(() => {
    const dayKey = formatDateKey(view === "day" ? focusDate : selectedDate);
    return visibleEventsByDateKey.get(dayKey) || [];
  }, [focusDate, selectedDate, view, visibleEventsByDateKey]);

  const dayTimelineEventsByHour = useMemo(() => {
    const grouped: Record<number, PersonalCalendarEvent[]> = {};
    dayTimelineHours.forEach((hour) => {
      grouped[hour] = [];
    });

    dayTimelineEvents.forEach((event) => {
      const hour = Math.max(
        DAY_TIMELINE_START_HOUR,
        Math.min(new Date(event.startAt).getHours(), DAY_TIMELINE_END_HOUR),
      );
      grouped[hour].push(event);
    });

    return grouped;
  }, [dayTimelineEvents, dayTimelineHours]);

  const weekDates = useMemo(
    () => buildCalendarCells(focusDate, "week").map((cell) => cell.date),
    [focusDate],
  );

  const weekTimelineEventsByDateHour = useMemo(() => {
    const grouped: Record<string, Record<number, PersonalCalendarEvent[]>> = {};

    weekDates.forEach((date) => {
      const dateKey = formatDateKey(date);
      grouped[dateKey] = {};
      dayTimelineHours.forEach((hour) => {
        grouped[dateKey][hour] = [];
      });

      const eventsOfDay = visibleEventsByDateKey.get(dateKey) || [];
      eventsOfDay.forEach((event) => {
        const hour = Math.max(
          DAY_TIMELINE_START_HOUR,
          Math.min(new Date(event.startAt).getHours(), DAY_TIMELINE_END_HOUR),
        );
        grouped[dateKey][hour].push(event);
      });
    });

    return grouped;
  }, [dayTimelineHours, visibleEventsByDateKey, weekDates]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex items-center gap-3 text-slate-700">
            <CalendarDays className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-500">Tháng</p>
              <p className="text-xl font-bold text-slate-900">{periodLabel}</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-2xl text-slate-900">
              Lịch Cá Nhân
            </p>
          </div>

          <div className="flex justify-start lg:justify-end">
            <div className="flex items-center gap-2">
              <button
                onClick={() => stepDate(-1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                aria-label="Thời gian trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setFocusDate(startOfDay(now))}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
              >
                Hôm nay
              </button>
              <button
                onClick={() => stepDate(1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                aria-label="Thời gian sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {([
              ["day", "Ngày"],
              ["week", "Tuần"],
              ["month", "Tháng"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setView(value)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  view === value
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 sm:px-6">
        {periodLabel}
      </div>

      {view === "day" ? (
        <div className="grid gap-0 border-t border-gray-200 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-white">
            <div className="grid grid-cols-[64px_1fr]">
              <div className="border-r border-gray-200 bg-gray-50/80">
                {dayTimelineHours.map((hour) => (
                  <div
                    key={`day-label-${hour}`}
                    className="relative"
                    style={{ height: `${DAY_TIMELINE_ROW_HEIGHT}px` }}
                  >
                    <span className="absolute top-1 right-2 text-xs font-medium text-gray-500">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              <div className="relative" style={{ minHeight: `${dayTimelineHours.length * DAY_TIMELINE_ROW_HEIGHT}px` }}>
                {dayTimelineHours.map((hour) => {
                  const hourEvents = dayTimelineEventsByHour[hour] || [];
                  const expandedHeight =
                    hourEvents.length > 0
                      ? Math.max(DAY_TIMELINE_ROW_HEIGHT, hourEvents.length * 34)
                      : DAY_TIMELINE_ROW_HEIGHT;

                  return (
                    <div
                      key={`day-slot-${hour}`}
                      className="border-t border-gray-200 px-2 py-1.5"
                      style={{ minHeight: `${expandedHeight}px` }}
                    >
                      <div className="space-y-1.5">
                        {hourEvents.length === 0 ? (
                          <p className="text-xs text-gray-400">Không có lịch</p>
                        ) : (
                          hourEvents.map((event) => (
                            <div
                              key={event.id}
                              className={`rounded-xl border-l-4 px-3 py-2 text-left shadow-sm ${getEventChipClass(event.type)}`}
                            >
                              <p className="text-[11px] font-semibold leading-4">
                                {formatTimeRange(event.startAt, event.endAt)}
                              </p>
                              <p className="mt-0.5 text-sm font-bold leading-5">
                                {event.title}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="border-t border-gray-200 bg-slate-50 px-4 py-4 lg:border-l lg:border-t-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Hôm nay
              </p>
              <h4 className="mt-1 text-lg font-bold text-slate-900">
                {formatDateLabel(view === "day" ? focusDate : selectedDate)}
              </h4>
              <div className="mt-4 space-y-3">
                {selectedDayEvents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    Chưa có lịch cá nhân trong ngày này.
                  </div>
                ) : (
                  selectedDayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-start gap-2">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${getEventDotClass(event.type)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {event.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatTimeRange(event.startAt, event.endAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : view === "week" ? (
        <div className="overflow-hidden border-t border-gray-200 bg-white">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {weekDates.map((date) => {
              const key = formatDateKey(date);
              const isToday = isSameDate(startOfDay(date), startOfDay(now));
              const weekdayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(startOfDay(date))}
                  className={`border-r border-gray-200 px-2 py-2 text-center transition-colors ${isSameDate(date, selectedDate) ? "bg-slate-100" : "bg-white hover:bg-gray-50"}`}
                >
                  <p className="text-[11px] font-semibold text-gray-500">
                    {WEEKDAY_LABELS[weekdayIndex]}
                  </p>
                  <p
                    className={`mt-1 text-sm font-bold ${isToday ? "text-slate-900" : "text-gray-700"}`}
                  >
                    {String(date.getDate()).padStart(2, "0")}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-7">
            {weekDates.map((date) => {
              const dateKey = formatDateKey(date);
              const dayEvents = visibleEventsByDateKey.get(dateKey) || [];

              return (
                <div key={dateKey} className="min-h-48 border-r border-gray-200 p-2">
                  <div className="space-y-2">
                    {dayEvents.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-400">
                        Trống
                      </div>
                    ) : (
                      dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold shadow-sm ${getEventChipClass(event.type)}`}
                        >
                          <p className="text-[11px] font-semibold opacity-80">
                            {formatTimeRange(event.startAt, event.endAt)}
                          </p>
                          <p className="mt-0.5 leading-4">{event.title}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border-t border-gray-200 bg-white">
          <div className="grid grid-cols-7 border-l border-t border-gray-200">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="h-10 border-r border-b border-gray-200 bg-gray-50 text-xs sm:text-sm font-semibold text-gray-600 flex items-center justify-center"
              >
                {label}
              </div>
            ))}

            {calendarCells.map(({ date, inCurrentMonth }) => {
              const isToday = isSameDate(startOfDay(date), startOfDay(now));
              const dateKey = formatDateKey(date);
              const dayEvents = visibleEventsByDateKey.get(dateKey) || [];

              return (
                <button
                  key={dateKey}
                  type="button"
                  className={`min-h-24 flex flex-col border-r border-b border-gray-200 p-1.5 text-left transition ${isToday ? "bg-slate-50" : inCurrentMonth ? "bg-white hover:bg-slate-50" : "bg-gray-50 text-gray-400"}`}
                  onClick={() => setSelectedDate(startOfDay(date))}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-slate-900 text-white" : inCurrentMonth ? "text-slate-900" : "text-gray-400"}`}
                    >
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`rounded-md border px-1.5 py-1 text-[11px] font-semibold leading-4 ${getEventChipClass(event.type)}`}
                      >
                        <p className="line-clamp-2">{event.title}</p>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[11px] font-semibold text-gray-500">
                        +{dayEvents.length - 3} sự kiện khác
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarMonth;
