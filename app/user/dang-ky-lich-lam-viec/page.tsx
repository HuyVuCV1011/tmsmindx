'use client'

import { Card } from '@/components/Card'
import { PageContainer } from '@/components/PageContainer'
import { useAuth } from '@/lib/auth-context'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const HOUR_OPTIONS = Array.from({length: 15}, (_, i) => `${String(i+7).padStart(2,'0')}:00`)
const LS_KEY = 'tps_lich_ranh'

type CenterOption = { id: number; region: string; short_code: string; full_name: string }

type LichRanh = {
  date: string
  batDau: string
  ketThuc: string
  coSo: string[]
  coSoLinhHoat: string[]
  userName?: string
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function isSameDate(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m-1, d)
}
function toInputDate(date: Date) { return formatDateKey(date) }

// Build 42-cell month grid (6 rows × 7 cols, starting Monday)
function buildMonthCells(focusDate: Date) {
  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
  const gridStart = new Date(monthStart)
  const day = monthStart.getDay()
  gridStart.setDate(monthStart.getDate() + (day === 0 ? -6 : 1 - day))
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + i)
    return { date, inCurrentMonth: date.getMonth() === focusDate.getMonth() }
  })
}

function load(): LichRanh[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function save(data: LichRanh[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {}
}

export default function DangKyLichLamViecPage() {
  const { user } = useAuth()
  const [focusDate, setFocusDate] = useState(() => new Date())
  const [lichRanhList, setLichRanhList] = useState<LichRanh[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [centers, setCenters] = useState<CenterOption[]>([])
  const [userRegion, setUserRegion] = useState<string | null>(null)

  const [batDau, setBatDau] = useState('08:00')
  const [ketThuc, setKetThuc] = useState('12:00')
  const [coSoChon, setCoSoChon] = useState<string[]>([])
  const [coSoLinhHoat, setCoSoLinhHoat] = useState<string[]>([])
  const [lapLich, setLapLich] = useState(false)
  const [lapTu, setLapTu] = useState('')
  const [lapDen, setLapDen] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => { setLichRanhList(load()) }, [])

  useEffect(() => {
    if (!user?.email) return
    ;(async () => {
      try {
        const res = await fetch(`/api/centers-by-user?email=${encodeURIComponent(user.email)}`)
        const data = await res.json()
        if (res.ok && data.success) {
          setCenters(data.centers || [])
          setUserRegion(data.region || null)
        }
      } catch {}
    })()
  }, [user?.email])
  const monthCells = useMemo(() => buildMonthCells(focusDate), [focusDate])

  const periodLabel = useMemo(() =>
    focusDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
  , [focusDate])

  const stepMonth = (delta: number) => {
    setFocusDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const openForm = (date: Date) => {
    setSelectedDate(date)
    const key = formatDateKey(date)
    const existing = lichRanhList.find(l => l.date === key)
    if (existing) {
      setBatDau(existing.batDau); setKetThuc(existing.ketThuc)
      setCoSoChon(existing.coSo); setCoSoLinhHoat(existing.coSoLinhHoat || [])
    } else {
      setBatDau('08:00'); setKetThuc('12:00'); setCoSoChon([]); setCoSoLinhHoat([])
    }
    setLapLich(false)
    setLapTu(toInputDate(date))
    setLapDen(toInputDate(date))
    setFormError('')
  }

  const toggleCoSo = (cs: string) =>
    setCoSoChon(prev => prev.includes(cs) ? prev.filter(x => x!==cs) : [...prev, cs])

  const toggleCoSoLinhHoat = (cs: string) =>
    setCoSoLinhHoat(prev => prev.includes(cs) ? prev.filter(x => x!==cs) : [...prev, cs])

  const handleSave = () => {
    if (!batDau || !ketThuc) { setFormError('Vui lòng chọn giờ bắt đầu và kết thúc.'); return }
    if (batDau >= ketThuc) { setFormError('Giờ kết thúc phải sau giờ bắt đầu.'); return }
    if (coSoChon.length === 0) { setFormError('Vui lòng chọn ít nhất một cơ sở.'); return }

    if (lapLich) {
      if (!lapTu || !lapDen) { setFormError('Vui lòng chọn ngày bắt đầu và kết thúc.'); return }
      if (lapTu > lapDen) { setFormError('Ngày kết thúc phải sau ngày bắt đầu.'); return }
      if (!selectedDate) return

      const targetDayOfWeek = selectedDate.getDay()
      const dates: string[] = []
      const cur = parseDateKey(lapTu)
      const end = parseDateKey(lapDen)
      while (cur.getDay() !== targetDayOfWeek) cur.setDate(cur.getDate() + 1)
      while (cur <= end) {
        dates.push(formatDateKey(cur))
        cur.setDate(cur.getDate() + 7)
      }

      const newEntries: LichRanh[] = dates.map(date => ({
        date, batDau, ketThuc, coSo: coSoChon, coSoLinhHoat,
        userName: user?.displayName || user?.email || ''
      }))
      const updated = [...lichRanhList.filter(l => !dates.includes(l.date)), ...newEntries]
      setLichRanhList(updated); save(updated)
    } else {
      if (!selectedDate) return
      const key = formatDateKey(selectedDate)
      const entry: LichRanh = { date: key, batDau, ketThuc, coSo: coSoChon, coSoLinhHoat, userName: user?.displayName || user?.email || '' }
      const updated = [...lichRanhList.filter(l => l.date !== key), entry]
      setLichRanhList(updated); save(updated)
    }
    setSelectedDate(null)
  }

  const handleDelete = (date: Date) => {
    const key = formatDateKey(date)
    const updated = lichRanhList.filter(l => l.date !== key)
    setLichRanhList(updated); save(updated)
  }

  return (
    <PageContainer title="Đăng ký lịch làm việc" description="">
      <Card className="overflow-hidden" padding="sm">
        <div className="px-4 py-3 border-b border-gray-200 bg-white text-center">
          <h2 className="text-2xl font-bold text-gray-900">Đăng ký lịch rảnh</h2>
          <p className="mt-1 text-sm text-gray-500">Bấm vào ngày để đăng ký giờ rảnh của bạn</p>
        </div>

        {/* Month nav */}
        <div className="px-4 py-2 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-700" />
            <span className="text-sm font-semibold text-gray-700 capitalize">{periodLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => stepMonth(-1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setFocusDate(new Date())} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Hôm nay</button>
            <button onClick={() => stepMonth(1)} className="rounded-md border border-gray-300 bg-white p-2 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-7 border-l border-t border-gray-200 bg-white">
          {WEEKDAY_LABELS.map(label => (
            <div key={label} className="h-10 border-r border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 flex items-center justify-center">{label}</div>
          ))}
          {monthCells.map(({ date, inCurrentMonth }) => {
            const isToday = isSameDate(date, new Date())
            const key = formatDateKey(date)
            const entry = lichRanhList.find(l => l.date === key)
            const isPast = startOfDay(date) < startOfDay(new Date())
            return (
              <div
                key={key}
                onClick={() => !isPast && inCurrentMonth && openForm(date)}
                className={`min-h-24 flex flex-col border-r border-b border-gray-200 p-1.5 transition-colors
                  ${!inCurrentMonth ? 'bg-gray-50 opacity-40 cursor-default' : ''}
                  ${inCurrentMonth && isPast ? 'bg-gray-50 cursor-not-allowed opacity-60' : ''}
                  ${inCurrentMonth && !isPast ? 'cursor-pointer hover:bg-[#a1001f]/5' : ''}
                  ${isToday ? '!bg-yellow-50' : ''}
                  ${entry && inCurrentMonth ? 'ring-1 ring-inset ring-[#a1001f]/30' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  {isToday
                    ? <span className="rounded-full bg-[#a1001f] px-1.5 py-0.5 text-xs font-bold text-white">{date.getDate()}</span>
                    : <span className={`text-xs font-semibold ${inCurrentMonth ? 'text-gray-700' : 'text-gray-400'}`}>{date.getDate()}</span>
                  }
                  {entry && inCurrentMonth && !isPast && (
                    <button onClick={e => { e.stopPropagation(); handleDelete(date) }} className="rounded p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {entry && inCurrentMonth && (
                  <div className="mt-0.5 rounded bg-[#a1001f]/10 px-1.5 py-1 text-[10px] text-[#a1001f]">
                    <p className="font-semibold">{entry.batDau}–{entry.ketThuc}</p>
                    <p className="mt-0.5 truncate text-[#a1001f]/80">{entry.coSo.join(', ')}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Modal form */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedDate(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-2xl bg-[#a1001f] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-white">Đăng ký lịch rảnh</h3>
                <p className="text-xs text-white/80 mt-0.5">
                  {selectedDate.toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })}
                </p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="rounded-md p-1 text-white/80 hover:text-white hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bắt đầu giờ rảnh</label>
                <select value={batDau} onChange={e => setBatDau(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 outline-none">
                  {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Kết thúc giờ rảnh</label>
                <select value={ketThuc} onChange={e => setKetThuc(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 outline-none">
                  {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Cơ sở ưu tiên</label>
                <p className="text-[11px] text-gray-400 mb-3">Ưu tiên chọn cơ sở thuận tiện để đảm bảo di chuyển kịp thời giữa các ca dạy liền kề.</p>
                {centers.length === 0 ? (
                  <p className="text-xs text-gray-400">Đang tải danh sách cơ sở...</p>
                ) : (() => {
                  const regions = Array.from(new Set(centers.map(c => c.region)))
                  // Cột trái: region của user, cột phải: region còn lại
                  const leftRegion = userRegion && regions.includes(userRegion) ? userRegion : regions[0]
                  const rightRegions = regions.filter(r => r !== leftRegion)
                  const leftCenters = centers.filter(c => c.region === leftRegion)
                  const rightCenters = centers.filter(c => rightRegions.includes(c.region))
                  const renderCheckbox = (c: CenterOption) => {
                    const disabled = coSoLinhHoat.includes(c.short_code)
                    return (
                      <label key={c.short_code} className={`flex items-center gap-2 select-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="checkbox" checked={coSoChon.includes(c.short_code)} disabled={disabled} onChange={() => toggleCoSo(c.short_code)}
                          className="h-4 w-4 rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f] cursor-pointer flex-shrink-0" />
                        <span className="text-sm text-gray-800">{c.full_name}</span>
                      </label>
                    )
                  }
                  return (
                    <div className="grid grid-cols-2 gap-x-6">
                      <div className="flex flex-col gap-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{leftRegion}</p>
                        {leftCenters.map(renderCheckbox)}
                      </div>
                      <div className="flex flex-col gap-y-3">
                        {rightRegions.map((region, ri) => (
                          <div key={region} className={`flex flex-col gap-y-3 ${ri > 0 ? 'mt-2' : ''}`}>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{region}</p>
                            {centers.filter(c => c.region === region).map(renderCheckbox)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cơ sở linh hoạt</label>
                <p className="text-[11px] text-gray-400 mb-3">Cơ sở bạn có thể hỗ trợ nếu cần.</p>
                {centers.length === 0 ? (
                  <p className="text-xs text-gray-400">Đang tải danh sách cơ sở...</p>
                ) : (() => {
                  const regions = Array.from(new Set(centers.map(c => c.region)))
                  const leftRegion = userRegion && regions.includes(userRegion) ? userRegion : regions[0]
                  const rightRegions = regions.filter(r => r !== leftRegion)
                  const leftCenters = centers.filter(c => c.region === leftRegion)
                  const renderCheckbox = (c: CenterOption) => {
                    const disabled = coSoChon.includes(c.short_code)
                    return (
                      <label key={c.short_code} className={`flex items-center gap-2 select-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="checkbox" checked={coSoLinhHoat.includes(c.short_code)} disabled={disabled} onChange={() => toggleCoSoLinhHoat(c.short_code)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer flex-shrink-0" />
                        <span className="text-sm text-gray-800">{c.full_name}</span>
                      </label>
                    )
                  }
                  return (
                    <div className="grid grid-cols-2 gap-x-6">
                      <div className="flex flex-col gap-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{leftRegion}</p>
                        {leftCenters.map(renderCheckbox)}
                      </div>
                      <div className="flex flex-col gap-y-3">
                        {rightRegions.map((region, ri) => (
                          <div key={region} className={`flex flex-col gap-y-3 ${ri > 0 ? 'mt-2' : ''}`}>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{region}</p>
                            {centers.filter(c => c.region === region).map(renderCheckbox)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={lapLich} onChange={e => setLapLich(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]" />
                  <span className="text-xs font-semibold text-gray-700">Lặp lịch theo khoảng ngày</span>
                </label>
                {lapLich && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Từ ngày</label>
                      <input type="date" value={lapTu} onChange={e => setLapTu(e.target.value)} min={toInputDate(new Date())}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Đến ngày</label>
                      <input type="date" value={lapDen} onChange={e => setLapDen(e.target.value)} min={lapTu || toInputDate(new Date())}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 outline-none" />
                    </div>
                    {lapTu && lapDen && lapTu <= lapDen && (() => {
                      const targetDay = selectedDate.getDay()
                      const cur = parseDateKey(lapTu)
                      const end = parseDateKey(lapDen)
                      while (cur.getDay() !== targetDay) cur.setDate(cur.getDate() + 1)
                      let count = 0; const temp = new Date(cur)
                      while (temp <= end) { count++; temp.setDate(temp.getDate() + 7) }
                      const dayNames = ['CN','T2','T3','T4','T5','T6','T7']
                      return count > 0
                        ? <p className="text-[11px] text-[#a1001f] font-medium">Sẽ set {count} tuần ({dayNames[targetDay]} hàng tuần từ {lapTu} đến {lapDen})</p>
                        : <p className="text-[11px] text-orange-500 font-medium">Không có ngày phù hợp trong khoảng này.</p>
                    })()}
                  </div>
                )}
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button onClick={() => setSelectedDate(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Hủy</button>
              <button onClick={handleSave} className="rounded-lg bg-[#a1001f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#870019]">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}