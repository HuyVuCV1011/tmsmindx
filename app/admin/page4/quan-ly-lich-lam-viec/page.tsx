'use client'

import { PageContainer } from '@/components/PageContainer'
import { CalendarDays, ChevronLeft, ChevronRight, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

type KhungGio = { label: string; from: string; to: string }
const KHUNG_GIO: KhungGio[] = [
  { label: '9:00 – 12:00', from: '09:00', to: '12:00' },
  { label: '14:00 – 18:00', from: '14:00', to: '18:00' },
  { label: '18:00 – 21:00', from: '18:00', to: '21:00' },
]

type Mentor = { ma_gv: string; teacher_name: string; gio_bat_dau: string; gio_ket_thuc: string; khoi_final: string | null }

function KhoiBadge({ khoi }: { khoi: string | null }) {
  if (!khoi) return null
  const k = khoi.toLowerCase()
  if (k.includes('robot')) return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-yellow-100 text-yellow-700">Robotics</span>
  if (k.includes('cod')) return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700">Coding</span>
  if (k.includes('art') || k.includes('x-art')) return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600">X-Art</span>
  return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500">{khoi}</span>
}
type CenterData = {
  short_code: string
  full_name: string
  region: string
  uu_tien: Mentor[]
  linh_hoat: Mentor[]
  total: number
}

// Cache key → data
type CellKey = string // `${date}_${from}_${to}`
type CellData = CenterData[]

// Region groups — HCM 4 trên, HCM 1 dưới (theo yêu cầu)
const REGION_ORDER = ['HCM 4', 'HCM 1', 'HCM 3', 'HCM 2', 'HN 1', 'HN 2', 'TỈNH NAM', 'TỈNH BẮC', 'TỈNH TRUNG', 'ONLINE']

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function getWeekStartMonday(date: Date) {
  const d = startOfDay(date); const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d
}
function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type DetailModal = {
  date: Date
  khung: KhungGio
  center: CenterData
}

export default function QuanLyLichLamViecPage() {
  const [focusDate, setFocusDate] = useState(() => new Date())
  const [cache, setCache] = useState<Record<CellKey, CellData>>({})
  const [loading, setLoading] = useState<Record<CellKey, boolean>>({})
  const [detail, setDetail] = useState<DetailModal | null>(null)

  const weekStart = useMemo(() => getWeekStartMonday(focusDate), [focusDate])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
  }), [weekStart])

  const periodLabel = useMemo(() => {
    const end = new Date(weekStart); end.setDate(weekStart.getDate() + 6)
    return `${weekStart.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`
  }, [weekStart])

  const stepWeek = (delta: number) => {
    const next = new Date(focusDate); next.setDate(next.getDate() + delta * 7); setFocusDate(next)
  }

  const cellKey = (date: Date, khung: KhungGio) => `${formatDateKey(date)}_${khung.from}_${khung.to}`

  const fetchCell = useCallback(async (date: Date, khung: KhungGio) => {
    const key = cellKey(date, khung)
    if (cache[key] !== undefined || loading[key]) return
    setLoading(prev => ({ ...prev, [key]: true }))
    try {
      const res = await fetch(`/api/admin/lich-lam-viec?date=${formatDateKey(date)}&from=${khung.from}&to=${khung.to}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setCache(prev => ({ ...prev, [key]: data.data || [] }))
      }
    } catch {}
    finally { setLoading(prev => ({ ...prev, [key]: false })) }
  }, [cache, loading])

  // Fetch tất cả cells khi tuần thay đổi
  useEffect(() => {
    weekDays.forEach(date => {
      KHUNG_GIO.forEach(khung => fetchCell(date, khung))
    })
  }, [weekStart])

  const getCellData = (date: Date, khung: KhungGio): CellData => cache[cellKey(date, khung)] || []

  // Group centers theo region, sort theo REGION_ORDER
  const groupByRegion = (centers: CenterData[]) => {
    const groups: Record<string, CenterData[]> = {}
    centers.forEach(c => {
      if (!groups[c.region]) groups[c.region] = []
      groups[c.region].push(c)
    })
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = REGION_ORDER.indexOf(a)
      const bi = REGION_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }

  return (
    <PageContainer title="Quản lý lịch làm việc" maxWidth="full">
      <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-gray-700" />
            <span className="text-sm font-semibold text-gray-700">{periodLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => stepWeek(-1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setFocusDate(new Date())} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Hôm nay</button>
            <button onClick={() => stepWeek(1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse table-fixed text-sm h-full">
            <colgroup>
              <col className="w-28" />
              {weekDays.map((_, i) => <col key={i} />)}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-r border-gray-200">Khung giờ</th>
                {weekDays.map((date, i) => {
                  const isToday = isSameDate(date, new Date())
                  return (
                    <th key={i} className={`px-2 py-2 text-center text-xs font-semibold border-r border-gray-200 ${isToday ? 'bg-[#a1001f]/5 text-[#a1001f]' : 'text-gray-600'}`}>
                      <div>{WEEKDAY_LABELS[i]}</div>
                      <div className={`mt-0.5 text-sm font-bold ${isToday ? 'text-[#a1001f]' : 'text-gray-800'}`}>{date.getDate()}/{date.getMonth() + 1}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {KHUNG_GIO.map(khung => (
                <tr key={khung.label} className="border-b border-gray-200 h-1/3">
                  <td className="px-3 py-3 border-r border-gray-200 bg-gray-50 align-top">
                    <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{khung.label}</span>
                  </td>
                  {weekDays.map((date, i) => {
                    const centers = getCellData(date, khung)
                    const key = cellKey(date, khung)
                    const isLoading = loading[key]
                    const regionGroups = groupByRegion(centers)

                    return (
                      <td key={i} className="px-2 py-2 border-r border-gray-200 align-top">
                        {isLoading ? (
                          <span className="text-[10px] text-gray-300">...</span>
                        ) : centers.length === 0 ? (
                          <span className="text-[11px] text-gray-300">—</span>
                        ) : (
                          <div className="space-y-2">
                            {regionGroups.map(([region, regionCenters]) => (
                              <div key={region}>
                                <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">{region}</p>
                                <div className="space-y-1">
                                  {regionCenters.map(center => (
                                    <button
                                      key={center.short_code}
                                      onClick={() => setDetail({ date, khung, center })}
                                      className="w-full flex items-center justify-between gap-1 rounded-lg bg-[#a1001f]/8 border border-[#a1001f]/20 px-2 py-1 text-left hover:bg-[#a1001f]/15 transition-colors"
                                    >
                                      <span className="text-[11px] font-semibold text-[#a1001f] truncate">{center.full_name}</span>
                                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[#a1001f]/80 flex-shrink-0">
                                        <Users className="h-3 w-3" />{center.uu_tien.length}
                                        {center.linh_hoat.length > 0 && <span className="text-gray-400">+{center.linh_hoat.length}</span>}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-2xl bg-[#a1001f] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-white">{detail.center.full_name}</h3>
                <p className="text-xs text-white/80 mt-0.5">
                  {detail.khung.label} · {detail.date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-md p-1 text-white/80 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Ưu tiên */}
              {detail.center.uu_tien.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                    Cơ sở ưu tiên ({detail.center.uu_tien.length})
                  </p>
                  <ul className="space-y-1.5">
                    {detail.center.uu_tien.map((m, i) => (
                      <li key={m.ma_gv} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800">
                        <span className="h-6 w-6 rounded-full bg-[#a1001f]/10 text-[#a1001f] text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="font-medium">{m.teacher_name}</span>
                        <KhoiBadge khoi={m.khoi_final} />
                        <span className="ml-auto text-xs text-gray-400 italic">{m.gio_bat_dau?.slice(0, 5)} – {m.gio_ket_thuc?.slice(0, 5)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Linh hoạt */}
              {detail.center.linh_hoat.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                    Khác — Linh hoạt ({detail.center.linh_hoat.length})
                  </p>
                  <ul className="space-y-1.5">
                    {detail.center.linh_hoat.map((m, i) => (
                      <li key={m.ma_gv} className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-600">
                        <span className="h-6 w-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span>{m.teacher_name}</span>
                        <KhoiBadge khoi={m.khoi_final} />
                        <span className="ml-auto text-xs text-gray-400 italic">{m.gio_bat_dau?.slice(0, 5)} – {m.gio_ket_thuc?.slice(0, 5)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.center.uu_tien.length === 0 && detail.center.linh_hoat.length === 0 && (
                <p className="text-sm text-gray-400">Không có mentor nào.</p>
              )}
            </div>

            <div className="border-t border-gray-200 px-5 py-3 flex justify-end">
              <button onClick={() => setDetail(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
