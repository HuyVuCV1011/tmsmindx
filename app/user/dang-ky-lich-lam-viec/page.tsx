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

function buildMonthCells(focusDate: Date) {
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

export default function DangKyLichLamViecPage() {
  const [focusDate, setFocusDate] = useState(() => new Date());

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 9 }, (_, index) => currentYear - 3 + index);
  }, []);

  const calendarCells = useMemo(() => buildMonthCells(focusDate), [focusDate]);

  const periodLabel = useMemo(
    () => `Tháng ${focusDate.getMonth() + 1}/${focusDate.getFullYear()}`,
    [focusDate]
  );

  const stepMonth = (delta: number) => {
    const next = new Date(focusDate);
    next.setMonth(next.getMonth() + delta);
    setFocusDate(next);
  };

  const goToday = () => setFocusDate(new Date());

  return (
    <PageContainer title="Đăng ký lịch làm việc" maxWidth="full">
      <Card className="overflow-hidden" padding="sm">
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
              type="button"
              onClick={() => stepMonth(-1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
              aria-label={"Tháng trước"}
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
              onClick={() => stepMonth(1)}
              className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"
              aria-label="Tháng sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-2 text-sm font-semibold text-gray-700 border-b border-gray-200 bg-gray-50">
          {periodLabel}
        </div>

        <div className="grid grid-cols-7 border-l border-t border-gray-200">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="h-10 border-r border-b border-gray-200 bg-gray-50 text-xs md:text-sm font-semibold text-gray-600 flex items-center justify-center"
            >
              {label}
            </div>
          ))}

          {calendarCells.map(({ date, inCurrentMonth }) => {
            const isToday = isSameDate(startOfDay(date), startOfDay(new Date()));

            return (
              <div
                key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                className={`min-h-20 md:min-h-28 flex flex-col border-r border-b border-gray-200 p-1.5 md:p-2 ${
                  isToday
                    ? "bg-yellow-50 border-yellow-300"
                    : inCurrentMonth
                      ? "bg-white"
                      : "bg-gray-50"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  {isToday ? (
                    <span className="inline-flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full bg-yellow-300 text-xs md:text-sm font-bold text-yellow-900">
                      {date.getDate()}
                    </span>
                  ) : (
                    <span
                      className={`text-xs md:text-sm font-medium ${
                        inCurrentMonth ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  )}
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
