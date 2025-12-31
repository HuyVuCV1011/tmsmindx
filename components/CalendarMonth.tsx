"use client";
import React, { useState } from "react";

const getCurrentMonthYear = () => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
};

const CalendarMonth = () => {
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  // Placeholder: Hiển thị lịch tháng hiện tại
  return (
    <div className="calendar-widget">
      <div className="flex items-center gap-2 mb-2">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded px-2 py-1">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{`Tháng ${m}`}</option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded px-2 py-1">
          {[currentYear - 1, currentYear, currentYear + 1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div style={{background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, minHeight: 200}}>
        <span>Lịch hoạt động tháng {month}/{year}</span>
      </div>
    </div>
  );
};

export default CalendarMonth;
