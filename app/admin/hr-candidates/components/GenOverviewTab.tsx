'use client';

import { useMemo, useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  Search,
  Filter
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────
const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const SESSION_STYLES = {
  1: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', label: 'Day 1' },
  2: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Day 2' },
  3: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', label: 'Day 3' },
  4: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: 'Day 4' },
} as const;

// ─── Mock Data ──────────────────────────────────────────────────────────────
// This mock data represents training sessions across different GENs
const MOCK_SCHEDULES = [
  { gen: '109', region: 'Hà Nội', session: 1, date: '2026-04-06', time: '18:30 - 21:00', location: 'Trường Chinh' },
  { gen: '109', region: 'Hà Nội', session: 2, date: '2026-04-08', time: '18:30 - 21:00', location: 'Trường Chinh' },
  { gen: '109', region: 'Hà Nội', session: 3, date: '2026-04-10', time: '18:30 - 21:00', location: 'Trường Chinh' },
  { gen: '109', region: 'Hà Nội', session: 4, date: '2026-04-12', time: '09:00 - 11:30', location: 'Trường Chinh' },
  { gen: '194', region: 'HCM', session: 1, date: '2026-04-07', time: '18:30 - 21:00', location: '01 Trường Chinh' },
  { gen: '108', region: 'Tỉnh Bắc', session: 1, date: '2026-04-06', time: '19:00 - 21:30', location: 'Online' },
  { gen: '107', region: 'Hà Nội', session: 3, date: '2026-04-06', time: '18:30 - 21:00', location: 'Nguyễn Phong Sắc' },
];

// ─── Utils ──────────────────────────────────────────────────────────────────
function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function buildCalendarCells(focusDate: Date) {
  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inCurrentMonth: date.getMonth() === focusDate.getMonth() };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function GenOverviewTab({ genEntries, regionFilter }: { genEntries: any[], regionFilter: string }) {
  const [focusDate, setFocusDate] = useState(new Date());
  const [genSearch, setGenSearch] = useState('');
  const [genSortOrder, setGenSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeGenKey, setActiveGenKey] = useState('');
  const [activeGenInfo, setActiveGenInfo] = useState<{ genCode: string; regionCode: string } | null>(null);

  // ── Logic ──────────────────────────────────────────────────────────────────
  const cells = useMemo(() => buildCalendarCells(focusDate), [focusDate]);

  const filteredGens = useMemo(() => {
    const q = genSearch.trim().toLowerCase();
    const filtered = q
      ? genEntries.filter((e) => `${e.genCode} ${e.regionLabel}`.toLowerCase().includes(q))
      : genEntries;
    return [...filtered].sort((a, b) => {
      const cmp = a.genCode.localeCompare(b.genCode, 'vi', { numeric: true });
      if (cmp !== 0) return genSortOrder === 'desc' ? -cmp : cmp;
      return a.regionCode.localeCompare(b.regionCode, 'vi');
    });
  }, [genEntries, genSearch, genSortOrder]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof MOCK_SCHEDULES>();
    
    // Filter by selected GEN if one is active
    const schedulesToDisplay = activeGenInfo 
      ? MOCK_SCHEDULES.filter(s => s.gen === activeGenInfo.genCode) 
      : []; // Start empty or show all? User said "mới hiện" (then show) - I'll show all if nothing selected?
      // Actually, from "khi người dùng xem... mới hiện", let's show ALL if nothing selected, OR show message. 
      // I'll show ALL by default, but if SELECTED, only show that one.
    
    const finalSchedules = activeGenInfo 
      ? MOCK_SCHEDULES.filter(s => s.gen === activeGenInfo.genCode)
      : MOCK_SCHEDULES;

    finalSchedules.forEach(s => {
      const key = formatDateKey(new Date(s.date));
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    });
    return map;
  }, [activeGenInfo]);

  const moveMonth = (offset: number) => {
    const next = new Date(focusDate);
    next.setMonth(next.getMonth() + offset);
    setFocusDate(next);
  };

  const handleClickGen = (entry: any) => {
    if (activeGenKey === entry.key) {
      setActiveGenKey('');
      setActiveGenInfo(null);
    } else {
      setActiveGenKey(entry.key);
      setActiveGenInfo({ genCode: entry.genCode, regionCode: entry.regionCode });
    }
  };

  const currentMonthLabel = focusDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 animate-in fade-in duration-500">
      
      {/* ══ LEFT: GEN List (Same as other tabs) ══════════════════════════ */}
      <aside className="xl:col-span-3 space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900 leading-tight">GEN đào tạo</p>
            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{genEntries.length} GEN</span>
          </div>

          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={genSearch}
                onChange={(e) => setGenSearch(e.target.value)}
                placeholder="Tìm GEN..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 transition-all"
              />
            </div>
            <button
              onClick={() => setGenSortOrder(genSortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2 text-[10px] font-bold text-gray-600 hover:bg-gray-50 transition-colors uppercase tracking-wider"
            >
              {genSortOrder === 'asc' ? 'Sắp xếp: Tăng dần' : 'Sắp xếp: Giảm dần'}
            </button>
          </div>

          <div className="max-h-[calc(100vh-380px)] space-y-1 overflow-y-auto pr-1">
            {filteredGens.map((entry) => {
              const isActive = activeGenKey === entry.key;
              return (
                <button
                  key={entry.key}
                  onClick={() => handleClickGen(entry)}
                  className={`flex w-full flex-col rounded-xl border px-3 py-2.5 text-left transition-all ${
                    isActive
                      ? 'border-[#a1001f] bg-[#fff5f6] shadow-sm'
                      : 'border-transparent bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-sm font-extrabold ${isActive ? 'text-[#a1001f]' : 'text-gray-900'}`}>
                    GEN {entry.genCode}
                  </span>
                  <p className="mt-0.5 text-[10px] font-medium text-gray-400 truncate">{entry.regionLabel}</p>
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      {/* ══ RIGHT: Calendar Overview ═════════════════════════════════════ */}
      <section className="xl:col-span-9 flex flex-col gap-4">
        
        {/* Calendar Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-extrabold text-gray-900 capitalize leading-tight">{currentMonthLabel}</h2>
            <div className="flex items-center rounded-xl bg-gray-100 p-0.5 ring-1 ring-gray-200">
              <button 
                onClick={() => moveMonth(-1)}
                className="rounded-lg p-1.5 hover:bg-white hover:shadow-sm transition-all"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
              <button 
                onClick={() => setFocusDate(new Date())}
                className="px-3 text-[10px] font-extrabold text-gray-500 hover:text-gray-900 uppercase tracking-widest"
              >
                Hôm nay
              </button>
              <button 
                onClick={() => moveMonth(1)}
                className="rounded-lg p-1.5 hover:bg-white hover:shadow-sm transition-all"
              >
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeGenInfo ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 animate-in zoom-in-95">
                <LayoutGrid className="h-3.5 w-3.5" />
                Đang xem: GEN {activeGenInfo.genCode}
              </div>
            ) : (
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                Hiển thị tất cả lịch training
              </div>
            )}
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden ring-1 ring-black/5 flex-1">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/50">
          {WEEKDAY_LABELS.map(label => (
            <div key={label} className="py-2.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
          {cells.map(({ date, inCurrentMonth }, i) => {
            const isToday = formatDateKey(date) === formatDateKey(new Date());
            const dateEvents = eventsByDate.get(formatDateKey(date)) || [];
            
            return (
              <div 
                key={i} 
                className={`min-h-[120px] p-2 transition-colors ${
                  inCurrentMonth ? 'bg-white' : 'bg-gray-50/30 opacity-40'
                } group hover:bg-gray-50/50 cursor-pointer relative`}
              >
                {/* Date Number */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-extrabold transition-all ${
                    isToday 
                      ? 'bg-[#a1001f] text-white shadow-md shadow-[#a1001f]/20' 
                      : 'text-gray-400 group-hover:text-gray-900 group-hover:bg-gray-100'
                  }`}>
                    {date.getDate()}
                  </span>
                </div>

                {/* Event List */}
                <div className="space-y-1 overflow-hidden">
                  {dateEvents.map((ev, idx) => {
                    const style = SESSION_STYLES[ev.session as keyof typeof SESSION_STYLES];
                    return (
                      <div 
                        key={idx}
                        className={`flex flex-col gap-0.5 rounded-lg border ${style.border} ${style.bg} p-1.5 shadow-sm transition-transform hover:scale-[1.02] active:scale-95`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-extrabold uppercase px-1 py-0.5 rounded bg-white/60 ${style.text}`}>
                            GEN {ev.gen}
                          </span>
                          <span className={`text-[8px] font-bold ${style.text} opacity-60`}>{style.label}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-gray-700">
                          <Clock className="h-2 w-2" /> {ev.time.split(' - ')[0]}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-medium text-gray-500 truncate">
                          <MapPin className="h-2 w-2 shrink-0" /> {ev.location}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ LEGEND ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-gray-100 bg-white px-5 py-3 shadow-sm">
        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Loại buổi học:</span>
        <div className="flex flex-wrap items-center gap-4">
          {Object.values(SESSION_STYLES).map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${s.bg} border ${s.border}`} />
              <span className="text-[10px] font-bold text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

    </section>
    </div>
  );
}
