"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

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

function getWeekStartMonday(date: Date) {
  const current = startOfDay(date);
  const start = new Date(current);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(current.getDate() + mondayOffset);
  return start;
}

export default function QuanLyLichLamViecPage() {
  const [focusDate, setFocusDate] = useState(() => new Date());

  const weekStart = useMemo(() => getWeekStartMonday(focusDate), [focusDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + index);
      return d;
    });
  }, [weekStart]);

  const periodLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString("vi-VN")} – ${end.toLocaleDateString("vi-VN")}`;
  }, [weekStart]);

  const stepWeek = (delta: number) => {
    const next = new Date(focusDate);
    next.setDate(next.getDate() + delta * 7);
    setFocusDate(next);
  };

  const goToday = () => setFocusDate(new Date());

  return (
    <PageContainer title="Quản lý lịch làm việc" maxWidth="full">
      <Card className="overflow-hidden" padding="sm">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Danh sách đăng ký lịch làm việc</h2>
        </div>

        <div className="px-4 py-2 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-700" />
            <span className="text-sm font-semibold text-gray-700">{periodLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => stepWeek(-1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
              aria-label={"Tuần trước"}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => stepWeek(1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
              aria-label="Tuần sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-l border-t border-gray-200 bg-white">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="h-10 border-r border-b border-gray-200 bg-gray-50 text-xs md:text-sm font-semibold text-gray-600 flex items-center justify-center"
            >
              {label}
            </div>
          ))}
          {weekDays.map((date) => {
            const isToday = isSameDate(startOfDay(date), startOfDay(new Date()));
            const weekdayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
            return (
              <div
                key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                className={`min-h-32 md:min-h-40 flex flex-col border-r border-b border-gray-200 p-2 ${
                  isToday ? "bg-yellow-50 border-yellow-300" : "bg-white"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-1">
                  {isToday ? (
                    <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-gray-900">
                      Hôm nay {date.getDate()}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-gray-700">{date.getDate()}</span>
                  )}
                  <span className="text-[10px] font-medium text-gray-400 md:hidden">
                    {WEEKDAY_LABELS[weekdayIndex]}
                  </span>
                </div>
                <div className="flex-1" />
              </div>
            );
          })}
        </div>
      </Card>
    </PageContainer>
  );
}
