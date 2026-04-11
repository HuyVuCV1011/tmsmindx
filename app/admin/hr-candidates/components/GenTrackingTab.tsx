'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BarChart2, CheckSquare2, Loader2, RefreshCw, Save, Search, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { HrCandidateRow } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────
const SESSIONS = [
  { number: 1, label: 'Buổi 1' },
  { number: 2, label: 'Buổi 2' },
  { number: 3, label: 'Buổi 3' },
  { number: 4, label: 'Buổi 4' },
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

// attendance record per candidate: { [sessionNumber]: { attendance, score } }
type SessionRecord = { attendance: boolean; score: string };
type CandidateRecord = Record<number, SessionRecord>;
// draft map: candidateKey → CandidateRecord
type DraftMap = Record<string, CandidateRecord>;

interface GenTrackingTabProps {
  genEntries: GenEntry[];
  regionFilter: 'all' | 'south' | 'north';
  activeGenKey: string;
  activeGenInfo: { genCode: string; regionCode: string } | null;
  onSelectGen: (entry: GenEntry) => void;
}

// ─── Sort (identical to planner) ─────────────────────────────────────────────
function sortGenEntries(a: GenEntry, b: GenEntry, order: 'asc' | 'desc') {
  const cmp = a.genCode.localeCompare(b.genCode, 'vi', { numeric: true });
  if (cmp !== 0) return order === 'desc' ? -cmp : cmp;
  return a.regionCode.localeCompare(b.regionCode, 'vi');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scoreClass(score: string): string {
  if (!score) return 'border-gray-200 bg-gray-50 text-gray-400';
  const n = Number(score);
  if (n >= 8) return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (n >= 6) return 'border-amber-300 bg-amber-50 text-amber-700';
  return 'border-red-300 bg-red-50 text-red-700';
}

function attendBadgeClass(count: number) {
  if (count === 0) return 'bg-red-100 text-red-600 border-red-200';
  if (count < SESSIONS.length) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function initRecord(): SessionRecord {
  return { attendance: false, score: '' };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function GenTrackingTab({ 
  genEntries, 
  regionFilter,
  activeGenKey,
  activeGenInfo,
  onSelectGen
}: GenTrackingTabProps) {
  const { user } = useAuth();

  // Candidate list
  const [candidates, setCandidates] = useState<HrCandidateRow[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Draft: unsaved edits (candidateKey → sessionNumber → { attendance, score })
  const [drafts, setDrafts] = useState<DraftMap>({});
  // Original data: for dirty checking (candidateKey → sessionNumber → { attendance, score })
  const [originalData, setOriginalData] = useState<DraftMap>({});
  // Dirty set: candidateKeys with unsaved changes
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Candidate search
  const [candidateSearch, setCandidateSearch] = useState('');

  // ── Reset when region changes ───────────────────────────────────────────
  useEffect(() => {
    setCandidates([]);
    setDrafts({});
    setOriginalData({});
    setDirtyKeys(new Set());
  }, [regionFilter]);

  // ── Fetch candidates for selected GEN ─────────────────────────────────
  const fetchCandidates = useCallback(
    async (genCode: string, regionCode: string) => {
      if (!user?.email || !genCode) return;
      setLoadingCandidates(true);
      setDrafts({});
      setDirtyKeys(new Set());

      try {
        const params = new URLSearchParams({
          requestEmail: user.email,
          gen: genCode,
          region: regionCode, // Use the specific region from the entry
          status: 'assigned',
          pageSize: '200',
        });

        // Fetch candidates and attendance records in parallel
        const [candidatesRes, attendanceRes] = await Promise.all([
          fetch(`/api/hr/candidates?${params.toString()}`, { cache: 'no-store' }),
          fetch(`/api/hr/gen-attendance?requestEmail=${encodeURIComponent(user.email)}&gen=${encodeURIComponent(genCode)}`, { cache: 'no-store' }),
        ]);

        const candidatesData = await candidatesRes.json();
        if (!candidatesRes.ok) throw new Error(candidatesData.error || 'Không thể tải ứng viên.');

        const fetchedCandidates: HrCandidateRow[] = candidatesData.rows || [];
        setCandidates(fetchedCandidates);

        // Load saved attendance records into draft state
        if (attendanceRes.ok) {
          const attendanceData = await attendanceRes.json();
          const savedRecords: Record<string, Record<number, { attendance: boolean; score: number | null }>> =
            attendanceData.records || {};

          const initialDrafts: DraftMap = {};
          for (const candidate of fetchedCandidates) {
            const saved = savedRecords[candidate.candidateKey] || {};
            const record: CandidateRecord = {};
            for (const session of SESSIONS) {
              record[session.number] = {
                attendance: saved[session.number]?.attendance ?? false,
                score: saved[session.number]?.score !== null && saved[session.number]?.score !== undefined
                  ? String(saved[session.number].score)
                  : '',
              };
            }
            initialDrafts[candidate.candidateKey] = record;
          }
          setDrafts(initialDrafts);
          setOriginalData(JSON.parse(JSON.stringify(initialDrafts))); // Deep copy for original ref
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Lỗi không xác định');
      } finally {
        setLoadingCandidates(false);
      }
    },
    [user?.email, regionFilter]
  );

  useEffect(() => {
    if (activeGenInfo) {
      fetchCandidates(activeGenInfo.genCode, activeGenInfo.regionCode);
    }
  }, [activeGenInfo, fetchCandidates]);

  // ── Get or init draft for a candidate / session ────────────────────────
  const getRecord = (candidateKey: string, sessionNumber: number): SessionRecord => {
    return drafts[candidateKey]?.[sessionNumber] ?? initRecord();
  };

  // ── Handle cell change ─────────────────────────────────────────────────
  const handleChange = (
    candidateKey: string,
    sessionNumber: number,
    field: 'attendance' | 'score',
    value: boolean | string
  ) => {
    // 1. Calculate the new candidate record
    const currentCandidateDraft = { ...(drafts[candidateKey] ?? {}) };
    const currentSessionDraft = { ...(currentCandidateDraft[sessionNumber] ?? initRecord()) };
    
    // @ts-expect-error dynamic field
    currentSessionDraft[field] = value;
    currentCandidateDraft[sessionNumber] = currentSessionDraft;

    // 2. Compare with original data to see if it's actually dirty
    const originalCandidate = originalData[candidateKey] ?? {};
    let isDifferent = false;
    
    // Check all sessions for this candidate
    for (const session of SESSIONS) {
      const d = currentCandidateDraft[session.number] || initRecord();
      const o = originalCandidate[session.number] || initRecord();
      if (d.attendance !== o.attendance || d.score !== o.score) {
        isDifferent = true;
        break;
      }
    }

    // 3. Update states
    setDrafts((prev) => ({ ...prev, [candidateKey]: currentCandidateDraft }));
    
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      if (isDifferent) {
        next.add(candidateKey);
      } else {
        next.delete(candidateKey);
      }
      return next;
    });
  };

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user?.email || dirtyKeys.size === 0 || !activeGenInfo) return;
    setSaving(true);

    try {
      const records: Array<{ candidateKey: string; sessionNumber: number; attendance: boolean; score: number | null }> = [];
      for (const candidateKey of dirtyKeys) {
        const rec = drafts[candidateKey];
        if (!rec) continue;
        for (const session of SESSIONS) {
          const s = rec[session.number] ?? initRecord();
          records.push({
            candidateKey,
            sessionNumber: session.number,
            attendance: s.attendance,
            score: s.score === '' ? null : Number(s.score),
          });
        }
      }

      const res = await fetch('/api/hr/gen-attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestEmail: user.email, genCode: activeGenInfo.genCode, records }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu thất bại.');

      toast.success(`Đã lưu ${dirtyKeys.size} ứng viên thành công.`);
      
      // Update originalData to reflect saved state
      setOriginalData((prev) => {
        const next = { ...prev };
        for (const key of dirtyKeys) {
          if (drafts[key]) {
            next[key] = JSON.parse(JSON.stringify(drafts[key]));
          }
        }
        return next;
      });
      
      setDirtyKeys(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };


  // ── Filtered candidates ────────────────────────────────────────────────
  const filteredCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      [c.name, c.email, c.candidateCode, c.desiredCampus].join(' ').toLowerCase().includes(q)
    );
  }, [candidates, candidateSearch]);

  // ── Stats for header pills ─────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalAttendance = 0;
    let scoredCount = 0;
    let scoreSum = 0;
    for (const candidate of candidates) {
      const rec = drafts[candidate.candidateKey];
      if (!rec) continue;
      for (const s of SESSIONS) {
        if (rec[s.number]?.attendance) totalAttendance++;
        const sc = rec[s.number]?.score;
        if (sc && sc !== '') { scoredCount++; scoreSum += Number(sc); }
      }
    }
    return {
      avgAttendance: candidates.length > 0 ? (totalAttendance / (candidates.length * SESSIONS.length)) : 0,
      avgScore: scoredCount > 0 ? scoreSum / scoredCount : null,
    };
  }, [candidates, drafts]);

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {/* ══ RIGHT: Candidate Table ════════════════════════════════════════ */}
      <section className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">

        {/* Empty state */}
        {!activeGenKey ? (
          <div className="flex flex-1 min-h-[480px] flex-col items-center justify-center gap-3 p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100">
              <Users className="h-10 w-10 text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-600">Chọn một GEN để bắt đầu</p>
              <p className="mt-1 text-xs text-gray-400">Nhấn vào một mã GEN bên trái để xem danh sách ứng viên</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="border-b border-gray-200 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left: title + stats */}
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-gray-900">{activeGenInfo?.genCode}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {filteredCandidates.length} ứng viên • 4 buổi học
                    </p>
                  </div>
                  {/* Stats pills – only show when we have data */}
                  {candidates.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <CheckSquare2 className="h-3 w-3" />
                        Điểm danh: {Math.round(stats.avgAttendance * 100)}%
                      </span>
                      {stats.avgScore !== null && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                          <BarChart2 className="h-3 w-3" />
                          Điểm TB: {stats.avgScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      placeholder="Tìm ứng viên..."
                      className="rounded-xl border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 w-44"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => activeGenInfo && fetchCandidates(activeGenInfo.genCode, activeGenInfo.regionCode)}
                    disabled={loadingCandidates || !activeGenInfo}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    title="Làm mới"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingCandidates ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || dirtyKeys.size === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#a1001f] px-4 py-2 text-sm font-bold text-white hover:bg-[#880019] disabled:opacity-40 transition-all"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {dirtyKeys.size > 0 ? `Lưu (${dirtyKeys.size})` : 'Lưu'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Table ───────────────────────────────────────────────── */}
            <div className="overflow-x-auto flex-1">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {/* Sticky candidate col */}
                    <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[210px] border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                      Ứng viên
                    </th>
                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[90px]">
                      Mã UV
                    </th>
                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[75px] text-center">
                      Đ.danh
                    </th>

                    {/* 4 fixed session columns */}
                    {SESSIONS.map((s) => (
                      <th
                        key={s.number}
                        className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[140px]"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[#a1001f]">{s.label}</span>
                          <span className="text-[10px] normal-case font-normal text-gray-400">
                            Điểm danh + Điểm
                          </span>
                        </div>
                      </th>
                    ))}

                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 min-w-[80px] text-center">
                      Điểm TB
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {loadingCandidates ? (
                    <tr>
                      <td colSpan={SESSIONS.length + 4} className="py-20 text-center">
                        <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="h-5 w-5 animate-spin text-[#a1001f]" />
                          Đang tải danh sách ứng viên...
                        </div>
                      </td>
                    </tr>
                  ) : filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={SESSIONS.length + 4} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <Users className="h-8 w-8 opacity-40" />
                          <p className="text-sm font-medium">Không có ứng viên nào trong GEN này.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((candidate) => {
                      const isDirty = dirtyKeys.has(candidate.candidateKey);
                      const rec = drafts[candidate.candidateKey] ?? {};

                      // Compute per-row stats from draft
                      const attendCount = SESSIONS.filter((s) => rec[s.number]?.attendance).length;
                      const scores = SESSIONS.map((s) => rec[s.number]?.score).filter(
                        (sc) => sc !== undefined && sc !== ''
                      );
                      const avgScore =
                        scores.length > 0
                          ? scores.reduce((sum, sc) => sum + Number(sc), 0) / scores.length
                          : null;

                      return (
                        <tr
                          key={candidate.candidateKey}
                          className={`relative group transition-colors ${
                            isDirty ? 'bg-amber-50/60' : 'hover:bg-gray-50/60'
                          }`}
                        >
                          {/* Candidate info - Changed bg-inherit to bg-white/amber-50 to fix transparency */}
                          <td className={`sticky left-0 z-20 px-4 py-2.5 align-middle border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] transition-colors ${
                            isDirty 
                              ? 'bg-[#fffbeb] group-hover:bg-[#fef3c7]' 
                              : 'bg-white group-hover:bg-gray-50'
                          }`}>
                            {/* Dirty indicator moved inside the sticky cell */}
                            {isDirty && (
                              <div className="absolute left-0 top-0 h-full w-1 bg-amber-400" aria-hidden />
                            )}
                            <p className="text-sm font-semibold text-gray-900 leading-tight truncate max-w-[185px]">
                              {candidate.name || 'Chưa có tên'}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[185px] mt-0.5">
                              {candidate.email}
                            </p>
                            {candidate.desiredCampus && (
                              <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                📍 {candidate.desiredCampus}
                              </p>
                            )}
                          </td>

                          {/* Code */}
                          <td className="px-3 py-2.5 align-middle">
                            <span className="inline-flex rounded-lg border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">
                              {candidate.candidateCode || '—'}
                            </span>
                          </td>

                          {/* Attendance summary */}
                          <td className="px-3 py-2.5 align-middle text-center">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${attendanceBadgeClass(attendCount)}`}
                            >
                              {attendCount}/{SESSIONS.length}
                            </span>
                          </td>

                          {/* 4 session columns */}
                          {SESSIONS.map((session) => {
                            const r = rec[session.number] ?? initRecord();
                            return (
                              <td 
                                key={session.number} 
                                className={`px-3 py-2 align-middle border-r border-gray-100 transition-colors ${
                                  r.attendance ? 'bg-amber-50' : ''
                                }`}
                              >
                                <div className="flex flex-col gap-1.5">
                                  {/* Attendance checkbox */}
                                  <label className="flex cursor-pointer select-none items-center gap-2 group">
                                    <div className="relative shrink-0">
                                      <input
                                        type="checkbox"
                                        checked={r.attendance}
                                        onChange={(e) =>
                                          handleChange(candidate.candidateKey, session.number, 'attendance', e.target.checked)
                                        }
                                        className="sr-only"
                                      />
                                      <div
                                        className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all ${
                                          r.attendance
                                            ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-200'
                                            : 'bg-white border-gray-300 group-hover:border-emerald-400'
                                        }`}
                                      >
                                        {r.attendance && (
                                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                    </div>
                                    <span
                                      className={`text-xs font-semibold transition-colors ${
                                        r.attendance ? 'text-emerald-700' : 'text-gray-400 group-hover:text-gray-600'
                                      }`}
                                    >
                                      {r.attendance ? 'Có mặt' : 'Vắng'}
                                    </span>
                                  </label>

                                  {/* Score input */}
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.5}
                                    value={r.score}
                                    placeholder="Điểm (0–10)"
                                    onChange={(e) =>
                                      handleChange(candidate.candidateKey, session.number, 'score', e.target.value)
                                    }
                                    className={`w-full rounded-lg border px-2 py-1 text-xs font-bold outline-none transition-all focus:ring-2 ${scoreClass(r.score)} focus:ring-blue-100`}
                                  />
                                </div>
                              </td>
                            );
                          })}

                          {/* Avg score */}
                          <td className="px-3 py-2.5 align-middle text-center">
                            {avgScore !== null ? (
                              <span
                                className={`text-sm font-extrabold ${
                                  avgScore >= 8
                                    ? 'text-emerald-700'
                                    : avgScore >= 6
                                      ? 'text-amber-600'
                                      : 'text-red-600'
                                }`}
                              >
                                {avgScore.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// correct export for attendBadgeClass referenced inline in JSX
function attendanceBadgeClass(count: number) {
  if (count === 0) return 'bg-gray-100 text-gray-400 border-gray-200';
  if (count < SESSIONS.length) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}
