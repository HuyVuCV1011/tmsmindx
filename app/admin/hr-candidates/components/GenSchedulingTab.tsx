'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar, Clock, MapPin, User, Save, Search, LayoutGrid, Info } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────
const SESSIONS = [
  { number: 1, label: 'Buổi 1', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  { number: 2, label: 'Buổi 2', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { number: 3, label: 'Buổi 3', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
  { number: 4, label: 'Buổi 4', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────
type GenEntry = {
  key: string;
  genCode: string;
  count: number;
  regionCode: string;
  regionLabel: string;
  isTeacher4Plus: boolean;
  note: string;
};

type SessionSchedule = {
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  mentor: string;
};

interface GenSchedulingTabProps {
  genEntries: GenEntry[];
  regionFilter: 'all' | 'south' | 'north';
}

// ─── Sort (identical to planner/tracking) ───────────────────────────────────
function sortGenEntries(a: GenEntry, b: GenEntry, order: 'asc' | 'desc') {
  const cmp = a.genCode.localeCompare(b.genCode, 'vi', { numeric: true });
  if (cmp !== 0) return order === 'desc' ? -cmp : cmp;
  return a.regionCode.localeCompare(b.regionCode, 'vi');
}

export default function GenSchedulingTab({ genEntries, regionFilter }: GenSchedulingTabProps) {
  // GEN list state
  const [genSearch, setGenSearch] = useState('');
  const [genSortOrder, setGenSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeGenKey, setActiveGenKey] = useState('');
  const [activeGenInfo, setActiveGenInfo] = useState<{ genCode: string; regionCode: string } | null>(null);

  // Mock schedule state (GenKey -> SessionNumber -> Schedule)
  const [schedules, setSchedules] = useState<Record<string, Record<number, SessionSchedule>>>({});
  const [saving, setSaving] = useState(false);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getSchedule = (genKey: string, sessionNumber: number): SessionSchedule => {
    return schedules[genKey]?.[sessionNumber] ?? {
      date: '',
      startTime: '18:30',
      endTime: '21:00',
      location: '',
      mentor: '',
    };
  };

  const handleUpdate = (sessionNumber: number, field: keyof SessionSchedule, value: string) => {
    if (!activeGenKey) return;
    setSchedules(prev => {
      const genSchedules = { ...(prev[activeGenKey] ?? {}) };
      const sessionSchedule = { ...(genSchedules[sessionNumber] ?? getSchedule(activeGenKey, sessionNumber)) };
      sessionSchedule[field] = value;
      genSchedules[sessionNumber] = sessionSchedule;
      return { ...prev, [activeGenKey]: genSchedules };
    });
  };

  const handleSaveDemo = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Đã lưu bản nháp lịch training (Hệ thống Demo)');
    }, 800);
  };

  // ── Filtered GEN list ─────────────────────────────────────────────────────
  const filteredGens = useMemo(() => {
    const q = genSearch.trim().toLowerCase();
    const filtered = q
      ? genEntries.filter((e) => `${e.genCode} ${e.regionLabel}`.toLowerCase().includes(q))
      : genEntries;
    return [...filtered].sort((a, b) => sortGenEntries(a, b, genSortOrder));
  }, [genEntries, genSearch, genSortOrder]);

  const handleClickGen = (entry: GenEntry) => {
    if (activeGenKey === entry.key) {
      setActiveGenKey('');
      setActiveGenInfo(null);
    } else {
      setActiveGenKey(entry.key);
      setActiveGenInfo({ genCode: entry.genCode, regionCode: entry.regionCode });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      
      {/* ══ LEFT: GEN List ══════════════════════════════════════════════ */}
      <aside className="xl:col-span-4 space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">GEN đích</p>
            <span className="text-xs font-medium text-gray-500">{genEntries.length} GEN</span>
          </div>

          <div className="mb-2 flex items-center gap-2">
            <input
              value={genSearch}
              onChange={(e) => setGenSearch(e.target.value)}
              placeholder="Tìm GEN..."
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
            />
            <button
              onClick={() => setGenSortOrder(genSortOrder === 'asc' ? 'desc' : 'asc')}
              className="inline-flex h-10 shrink-0 items-center rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {genSortOrder === 'asc' ? 'Tăng dần' : 'Giảm dần'}
            </button>
          </div>

          <div className="max-h-[calc(100vh-320px)] space-y-1 overflow-y-auto pr-1">
            {filteredGens.map((entry) => {
              const isActive = activeGenKey === entry.key;
              return (
                <button
                  key={entry.key}
                  onClick={() => handleClickGen(entry)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                    isActive
                      ? 'border-[#a1001f] bg-[#fff5f6] text-[#a1001f]'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="truncate block">{entry.genCode}</span>
                    <p className="truncate text-[11px] text-gray-500 font-normal">{entry.regionLabel}</p>
                  </div>
                  <span className="ml-2 shrink-0 text-xs text-gray-400 font-normal">
                    {entry.count} ứng viên
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      {/* ══ RIGHT: Scheduling Area ══════════════════════════════════════ */}
      <section className="xl:col-span-8 space-y-4">
        {!activeGenKey ? (
          <div className="flex flex-1 min-h-[480px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-400">
            <Calendar className="h-12 w-12 opacity-20" />
            <div>
              <p className="text-sm font-bold text-gray-600">Chọn GEN để xếp lịch</p>
              <p className="mt-1 text-xs text-gray-400">Lịch training bao gồm 4 buổi tiêu chuẩn cho mỗi GEN.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Xếp lịch training: {activeGenInfo?.genCode}</h3>
                <p className="text-xs text-gray-500 mt-1">Khu vực: {genEntries.find(e => e.key === activeGenKey)?.regionLabel}</p>
              </div>
              <button
                onClick={handleSaveDemo}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#a1001f] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#880019] disabled:opacity-50 transition-all shadow-lg shadow-[#a1001f]/20"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu lịch training
              </button>
            </div>

            {/* Session Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SESSIONS.map((session) => {
                const sched = getSchedule(activeGenKey, session.number);
                return (
                  <div key={session.number} className="group relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-[#a1001f]/30 hover:shadow-md">
                    <div className="mb-4 flex items-center justify-between">
                      <div className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${session.bg} ${session.color} ${session.border}`}>
                        <LayoutGrid className="h-3 w-3" />
                        {session.label}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cấu hình buổi học</div>
                    </div>

                    <div className="space-y-3">
                      {/* Date Row */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase">
                            <Calendar className="h-3 w-3" /> Ngày học
                          </label>
                          <input
                            type="date"
                            value={sched.date}
                            onChange={(e) => handleUpdate(session.number, 'date', e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase">
                            <Clock className="h-3 w-3" /> Giờ học
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              value={sched.startTime}
                              onChange={(e) => handleUpdate(session.number, 'startTime', e.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:border-[#a1001f]"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                              type="time"
                              value={sched.endTime}
                              onChange={(e) => handleUpdate(session.number, 'endTime', e.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:border-[#a1001f]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Location & Mentor Row */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase">
                            <MapPin className="h-3 w-3" /> Cơ sở / Địa điểm
                          </label>
                          <input
                            type="text"
                            value={sched.location}
                            placeholder="Tên cơ sở..."
                            onChange={(e) => handleUpdate(session.number, 'location', e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase">
                            <User className="h-3 w-3" /> Người phụ trách
                          </label>
                          <input
                            type="text"
                            value={sched.mentor}
                            placeholder="Mentor / Teacher..."
                            onChange={(e) => handleUpdate(session.number, 'mentor', e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note/Info Section */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 leading-relaxed">
                <p className="font-bold mb-1">Lưu ý khi xếp lịch:</p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>Lịch training sau khi lưu sẽ hiển thị trong trang quản lý của ứng viên.</li>
                  <li>Nếu có thay đổi về mentor hoặc địa điểm, vui lòng cập nhật sớm nhất có thể.</li>
                  <li>Ngày học nên được sắp xếp cách nhau ít nhất 2 ngày để ứng viên ôn bài.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
