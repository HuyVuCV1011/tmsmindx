'use client'

import { PageContainer } from '@/components/PageContainer'
import { CalendarDays, ChevronLeft, ChevronRight, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const CO_SO_LIST = ['TK', 'PXL', 'PVT', 'TL', 'TT', 'TC', 'LBB']
const LS_KEY = 'tps_lich_ranh'

type LichRanh = {
  date: string
  batDau: string
  ketThuc: string
  coSo: string[]
  userName?: string
}

type KhungGio = { label: string; from: string; to: string }

const KHUNG_GIO: KhungGio[] = [
  { label: '9:00 – 12:00', from: '09:00', to: '12:00' },
  { label: '14:00 – 18:00', from: '14:00', to: '18:00' },
  { label: '18:00 – 21:00', from: '18:00', to: '21:00' },
]

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function isSameDate(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function getWeekStartMonday(date: Date) {
  const d = startOfDay(date); const day = d.getDay()
  d.setDate(d.getDate() + (day===0 ? -6 : 1-day)); return d
}
function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function overlapsKhung(l: LichRanh, k: KhungGio) { return l.batDau < k.to && l.ketThuc > k.from }

type CellModal = { date: Date; khung: KhungGio; items: { coSo: string; mentors: string[] }[] }
type DetailModal = { date: Date; khung: KhungGio; coSo: string; mentors: string[] }

export default function QuanLyLichLamViecPage() {
  const [focusDate, setFocusDate] = useState(() => new Date())
  const [lichRanhList, setLichRanhList] = useState<LichRanh[]>([])
  const [cellModal, setCellModal] = useState<CellModal | null>(null)
  const [detail, setDetail] = useState<DetailModal | null>(null)

  useEffect(() => {
    try { setLichRanhList(JSON.parse(localStorage.getItem(LS_KEY) || '[]')) } catch {}
  }, [])

  const weekStart = useMemo(() => getWeekStartMonday(focusDate), [focusDate])
  const weekDays = useMemo(() => Array.from({length:7}, (_,i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate()+i); return d
  }), [weekStart])

  const periodLabel = useMemo(() => {
    const end = new Date(weekStart); end.setDate(weekStart.getDate()+6)
    return `${weekStart.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`
  }, [weekStart])

  const stepWeek = (delta: number) => {
    const next = new Date(focusDate); next.setDate(next.getDate()+delta*7); setFocusDate(next)
  }

  const getByDateKhungCoSo = (date: Date, khung: KhungGio, coSo: string) =>
    lichRanhList.filter(l => l.date===formatDateKey(date) && l.coSo.includes(coSo) && overlapsKhung(l, khung))

  const getCoSoCounts = (date: Date, khung: KhungGio) => {
    const result: {coSo: string; count: number; mentors: string[]}[] = []
    for (const cs of CO_SO_LIST) {
      const items = getByDateKhungCoSo(date, khung, cs)
      if (items.length > 0) result.push({ coSo: cs, count: items.length, mentors: items.map(l => l.userName || l.date) })
    }
    return result
  }

  const PREVIEW_LIMIT = 3

  return (
    <PageContainer title="Quản lý lịch làm việc" maxWidth="full">
      <div className="flex flex-col" style={{ height: 'calc(90vh - 64px)' }}>
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

        {/* Table — chiếm toàn bộ chiều cao còn lại */}
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
                      <div className={`mt-0.5 text-sm font-bold ${isToday ? 'text-[#a1001f]' : 'text-gray-800'}`}>{date.getDate()}/{date.getMonth()+1}</div>
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
                    const items = getCoSoCounts(date, khung)
                    const preview = items.slice(0, PREVIEW_LIMIT)
                    const hasMore = items.length > PREVIEW_LIMIT
                    return (
                      <td key={i} className="px-2 py-2 border-r border-gray-200 align-top">
                        {items.length > 0 ? (
                          <div className="space-y-1">
                            {preview.map(({ coSo, count, mentors }) => (
                              <button
                                key={coSo}
                                onClick={() => setDetail({ date, khung, coSo, mentors })}
                                className="w-full flex items-center justify-between gap-1 rounded-lg bg-[#a1001f]/8 border border-[#a1001f]/20 px-2 py-1 text-left hover:bg-[#a1001f]/15 transition-colors"
                              >
                                <span className="text-xs font-bold text-[#a1001f]">{coSo}</span>
                                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[#a1001f]/80">
                                  <Users className="h-3 w-3" />{count}
                                </span>
                              </button>
                            ))}
                            {hasMore && (
                              <button
                                onClick={() => setCellModal({ date, khung, items: items.map(x => ({ coSo: x.coSo, mentors: x.mentors })) })}
                                className="w-full rounded-lg border border-dashed border-gray-300 px-2 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                              >
                                +{items.length - PREVIEW_LIMIT} cơ sở khác
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-300">—</span>
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

      {/* Cell modal — xem tất cả cơ sở trong 1 ô */}
      {cellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCellModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-2xl bg-[#a1001f] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-white">{cellModal.khung.label}</h3>
                <p className="text-xs text-white/80 mt-0.5">{cellModal.date.toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })}</p>
              </div>
              <button onClick={() => setCellModal(null)} className="rounded-md p-1 text-white/80 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-2">
              {cellModal.items.map(({ coSo, mentors }) => (
                <button
                  key={coSo}
                  onClick={() => { setDetail({ date: cellModal.date, khung: cellModal.khung, coSo, mentors }); setCellModal(null) }}
                  className="w-full flex items-center justify-between rounded-lg border border-[#a1001f]/20 bg-[#a1001f]/5 px-3 py-2 hover:bg-[#a1001f]/10 transition-colors"
                >
                  <span className="text-sm font-bold text-[#a1001f]">{coSo}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#a1001f]/80"><Users className="h-3.5 w-3.5" />{mentors.length} mentor</span>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-200 px-5 py-3 flex justify-end">
              <button onClick={() => setCellModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal — danh sách mentor */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-2xl bg-[#a1001f] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-white">{detail.coSo} — {detail.khung.label}</h3>
                <p className="text-xs text-white/80 mt-0.5">{detail.date.toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-md p-1 text-white/80 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Mentor khả dụng ({detail.mentors.length})</p>
              {detail.mentors.length === 0 ? (
                <p className="text-sm text-gray-400">Không có mentor nào.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.mentors.map((name, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800">
                      <span className="h-6 w-6 rounded-full bg-[#a1001f]/10 text-[#a1001f] text-xs font-bold flex items-center justify-center">{i+1}</span>
                      {name}
                    </li>
                  ))}
                </ul>
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
