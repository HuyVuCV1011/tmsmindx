'use client'

import { Card } from '@/components/Card'
import { PageContainer } from '@/components/PageContainer'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/primitives/icon'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const HOUR_OPTIONS = Array.from({length: 15}, (_, i) => `${String(i+7).padStart(2,'0')}:00`)

type CenterOption = { id: number; region: string; short_code: string; full_name: string }

type LichRanhSlot = {
  id: number
  date: string
  batDau: string
  ketThuc: string
  coSo: string[]
  linhHoat: boolean
}

// Group slots theo ngày
type LichRanhByDate = Record<string, LichRanhSlot[]>

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

export default function DangKyLichLamViecPage() {
  const { user } = useAuth()
  const [focusDate, setFocusDate] = useState(() => new Date())
  const [lichRanhByDate, setLichRanhByDate] = useState<LichRanhByDate>({})
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewDate, setViewDate] = useState<Date | null>(null) // xem danh sách slot
  const [centers, setCenters] = useState<CenterOption[]>([])
  const [userRegion, setUserRegion] = useState<string | null>(null)
  const [maGv, setMaGv] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null)

  // Form state
  const [batDau, setBatDau] = useState('08:00')
  const [ketThuc, setKetThuc] = useState('12:00')
  const [coSoChon, setCoSoChon] = useState<string[]>([])
  const [linhHoat, setLinhHoat] = useState(false)
  const [lapLich, setLapLich] = useState(false)
  const [lapTu, setLapTu] = useState('')
  const [lapDen, setLapDen] = useState('')
  const [kieuLap, setKieuLap] = useState<'ngay' | 'tuan'>('tuan')
  const [formError, setFormError] = useState('')

  // Fetch teacher code
  useEffect(() => {
    if (!user?.email) return
    ;(async () => {
      try {
        const res = await fetch(`/api/teachers/info?email=${encodeURIComponent(user.email)}`)
        const data = await res.json()
        if (data?.teacher?.code) setMaGv(data.teacher.code)
        else setMaGv(user.email.split('@')[0] || '')
      } catch { setMaGv(user.email.split('@')[0] || '') }
    })()
  }, [user?.email])

  // Fetch centers by user region
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

  // Fetch lịch rảnh từ DB theo tháng
  const fetchLichRanh = async (date: Date) => {
    if (!maGv) return
    const thang = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
    try {
      const res = await fetch(`/api/dangky-lich-lam?ma_gv=${encodeURIComponent(maGv)}&thang=${thang}`)
      const data = await res.json()
      if (res.ok && data.success) {
        const byDate: LichRanhByDate = {}
        ;(data.data || []).forEach((row: any) => {
          const ngay = typeof row.ngay === 'string' ? row.ngay.slice(0, 10) : ''
          if (!byDate[ngay]) byDate[ngay] = []
          byDate[ngay].push({
            id: row.id,
            date: ngay,
            batDau: row.gio_bat_dau?.slice(0, 5),
            ketThuc: row.gio_ket_thuc?.slice(0, 5),
            coSo: row.co_so_uu_tien || [],
            linhHoat: row.linh_hoat || false,
          })
        })
        setLichRanhByDate(byDate)
      }
    } catch {}
  }

  useEffect(() => { if (maGv) fetchLichRanh(focusDate) }, [maGv, focusDate])

  const monthCells = useMemo(() => buildMonthCells(focusDate), [focusDate])
  const periodLabel = useMemo(() =>
    focusDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
  , [focusDate])

  const stepMonth = (delta: number) =>
    setFocusDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))

  const openForm = (date: Date) => {
    setSelectedDate(date)
    setBatDau('08:00'); setKetThuc('12:00'); setCoSoChon([]); setLinhHoat(false)
    setLapLich(false); setLapTu(toInputDate(date)); setLapDen(toInputDate(date))
    setKieuLap('tuan'); setFormError('')
    setEditingSlotId(null)
  }

  const openEditForm = (slot: LichRanhSlot) => {
    const date = parseDateKey(slot.date)
    setSelectedDate(date)
    setBatDau(slot.batDau); setKetThuc(slot.ketThuc)
    setCoSoChon(slot.coSo); setLinhHoat(slot.linhHoat)
    setLapLich(false); setLapTu(slot.date); setLapDen(slot.date)
    setKieuLap('tuan'); setFormError('')
    setEditingSlotId(slot.id)
  }

  const toggleCoSo = (cs: string) =>
    setCoSoChon(prev => prev.includes(cs) ? prev.filter(x => x!==cs) : [...prev, cs])

  // Tính danh sách ngày cần lưu
  const buildDates = (): string[] => {
    if (!lapLich || !lapTu || !lapDen || !selectedDate) return selectedDate ? [formatDateKey(selectedDate)] : []
    const dates: string[] = []
    const cur = parseDateKey(lapTu)
    const end = parseDateKey(lapDen)
    if (kieuLap === 'ngay') {
      while (cur <= end) { dates.push(formatDateKey(cur)); cur.setDate(cur.getDate() + 1) }
    } else {
      const targetDay = selectedDate.getDay()
      while (cur.getDay() !== targetDay) cur.setDate(cur.getDate() + 1)
      while (cur <= end) { dates.push(formatDateKey(cur)); cur.setDate(cur.getDate() + 7) }
    }
    return dates
  }

  const handleSave = async () => {
    if (!batDau || !ketThuc) { setFormError('Vui lòng chọn giờ bắt đầu và kết thúc.'); return }
    if (batDau >= ketThuc) { setFormError('Giờ kết thúc phải sau giờ bắt đầu.'); return }
    if (coSoChon.length === 0) { setFormError('Vui lòng chọn ít nhất một cơ sở.'); return }
    if (lapLich && (!lapTu || !lapDen)) { setFormError('Vui lòng chọn ngày bắt đầu và kết thúc.'); return }
    if (lapLich && lapTu > lapDen) { setFormError('Ngày kết thúc phải sau ngày bắt đầu.'); return }
    if (!maGv) { setFormError('Chưa xác định được mã giáo viên.'); return }

    const dates = buildDates()
    if (dates.length === 0) { setFormError('Không có ngày hợp lệ.'); return }

    setSaving(true)
    try {
      // Nếu đang edit: xóa slot cũ trước
      if (editingSlotId !== null) {
        await fetch(`/api/dangky-lich-lam?id=${editingSlotId}`, { method: 'DELETE' })
      }
      // Chạy tuần tự để tránh race condition khi merge overlap cùng ngày
      for (const ngay of dates) {
        const res = await fetch('/api/dangky-lich-lam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ma_gv: maGv, ngay, gio_bat_dau: batDau, gio_ket_thuc: ketThuc,
            co_so_uu_tien: coSoChon, linh_hoat: linhHoat,
            lap_lai_tu_ngay: lapLich ? lapTu : null,
            lap_lai_den_ngay: lapLich ? lapDen : null,
            kieu_lap: lapLich ? kieuLap : null,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || 'Lỗi khi lưu')
      }
      await fetchLichRanh(focusDate)
      setSelectedDate(null)
      setEditingSlotId(null)
    } catch (e: any) { setFormError(e.message || 'Lỗi khi lưu, vui lòng thử lại.') }
    finally { setSaving(false) }
  }

  const handleDeleteSlot = async (id: number, date: string) => {
    try {
      await fetch(`/api/dangky-lich-lam?id=${id}`, { method: 'DELETE' })
      setLichRanhByDate(prev => {
        const slots = (prev[date] || []).filter(s => s.id !== id)
        if (slots.length === 0) { const next = {...prev}; delete next[date]; return next }
        return { ...prev, [date]: slots }
      })
    } catch {}
  }

  // Show skeleton while loading initial data
  if (!maGv || centers.length === 0) {
    return <PageSkeleton variant="default" itemCount={4} showHeader={true} />
  }

  return (
    <PageContainer title="Đăng ký lịch làm việc" description="">
      <Card className="overflow-hidden" padding="sm">
        {/* Month nav */}
        <div className="px-4 py-2 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-700" />
            <span className="text-sm font-semibold text-gray-700 capitalize">{periodLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => stepMonth(-1)}>
              <Icon icon={ChevronLeft} size="sm" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFocusDate(new Date())}>
              Hôm nay
            </Button>
            <Button variant="outline" size="icon" onClick={() => stepMonth(1)}>
              <Icon icon={ChevronRight} size="sm" />
            </Button>
          </div>
        </div>

        {/* Month grid — cố định chiều cao, không scroll */}
        <div className="grid grid-cols-7 border-l border-t border-gray-200 bg-white" style={{ height: 'calc(100vh - 108px)' }}>
          {WEEKDAY_LABELS.map(label => (
            <div key={label} className="h-9 border-r border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 flex items-center justify-center">{label}</div>
          ))}
          {monthCells.map(({ date, inCurrentMonth }) => {
            const isToday = isSameDate(date, new Date())
            const key = formatDateKey(date)
            const slots = lichRanhByDate[key] || []
            const hasSlots = slots.length > 0
            const isPast = startOfDay(date) < startOfDay(new Date())

            // Màu nền nhạt cho từng slot (timeline style)
            const SLOT_BG = [
              'bg-[#a1001f]/8',
              'bg-blue-50',
              'bg-emerald-50',
              'bg-violet-50',
            ]
            const SLOT_TEXT = [
              'text-[#a1001f]',
              'text-blue-700',
              'text-emerald-700',
              'text-violet-700',
            ]
            const SLOT_ICON_BG = [
              'bg-[#a1001f]',
              'bg-blue-500',
              'bg-emerald-500',
              'bg-violet-500',
            ]
            return (
              <div
                key={key}
                onClick={() => inCurrentMonth && !isPast && openForm(date)}
                className={`flex flex-col border-r border-b border-gray-200 p-1 overflow-hidden
                  ${!inCurrentMonth ? 'bg-gray-50 opacity-30 cursor-default' : ''}
                  ${inCurrentMonth && isPast ? 'bg-gray-50 opacity-50 cursor-default' : ''}
                  ${inCurrentMonth && !isPast ? 'cursor-pointer hover:bg-gray-50/60' : ''}
                  ${isToday ? '!bg-yellow-50' : ''}
                `}
                style={{ height: 'calc((100vh - 108px - 36px) / 6)' }}
              >
                {/* Date number */}
                <div className="mb-1">
                  {isToday
                    ? <span className="rounded-full bg-[#a1001f] w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white">{date.getDate()}</span>
                    : <span className={`text-[11px] font-semibold ${inCurrentMonth && !isPast ? 'text-gray-700' : 'text-gray-400'}`}>{date.getDate()}</span>
                  }
                </div>

                {/* Timeline slots */}
                {inCurrentMonth && !isPast && hasSlots && (
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {slots.map((slot, idx) => (
                      <div
                        key={slot.id}
                        onClick={e => e.stopPropagation()}
                        className="relative flex items-center rounded-lg px-2 py-1.5 bg-[#a1001f]/8"
                      >
                        <span className="flex-1 text-[12px] font-bold leading-none text-[#a1001f]">
                          {slot.batDau} – {slot.ketThuc}
                        </span>
                        <div className="ml-auto relative z-10 flex gap-1">
                          <Button
                            variant="default"
                            size="icon-sm"
                            onClick={e => { e.stopPropagation(); openEditForm(slot) }}
                          >
                            <Icon icon={Pencil} size="xs" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            onClick={e => { e.stopPropagation(); handleDeleteSlot(slot.id, slot.date) }}
                          >
                            <Icon icon={Trash2} size="xs" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Modal xem danh sách slot */}
      {viewDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewDate(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-2xl bg-[#a1001f] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-white">Lịch rảnh đã đăng ký</h3>
                <p className="text-xs text-white/80 mt-0.5">{viewDate.toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })}</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setViewDate(null)}>
                <Icon icon={X} size="sm" />
              </Button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {(lichRanhByDate[formatDateKey(viewDate)] || []).map(slot => (
                <div key={slot.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">{slot.batDau} – {slot.ketThuc}</p>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteSlot(slot.id, slot.date)}>
                      <Icon icon={X} size="sm" />
                    </Button>
                  </div>
                  {slot.coSo.length > 0 && (() => {
                    // Group theo region, userRegion hiển thị trên
                    const byRegion: Record<string, { full_name: string; short_code: string }[]> = {}
                    slot.coSo.forEach(sc => {
                      const center = centers.find(c => c.short_code === sc)
                      const region = center?.region || 'other'
                      if (!byRegion[region]) byRegion[region] = []
                      byRegion[region].push({ full_name: center?.full_name || sc, short_code: sc })
                    })
                    // Sắp xếp: userRegion lên đầu
                    const sortedRegions = Object.keys(byRegion).sort((a, b) => {
                      if (a === userRegion) return -1
                      if (b === userRegion) return 1
                      return a.localeCompare(b)
                    })
                    return (
                      <div className="mt-2 space-y-2">
                        {sortedRegions.map(region => (
                          <div key={region}>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">{region}</p>
                            <div className="flex flex-wrap gap-1">
                              {byRegion[region].map(c => (
                                <span key={c.short_code} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${region === userRegion ? 'bg-blue-100 text-blue-700' : 'bg-[#a1001f]/10 text-[#a1001f]'}`}>
                                  {c.full_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  {slot.linhHoat && <p className="mt-2 text-xs text-gray-400 italic">Linh hoạt</p>}
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 px-5 py-3 flex justify-between">
              <Button variant="ghost" onClick={() => { setViewDate(null); openForm(viewDate) }}>
                + Thêm slot
              </Button>
              <Button variant="outline" onClick={() => setViewDate(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal form đăng ký */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedDate(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-2xl bg-[#a1001f] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-white">{editingSlotId ? 'Chỉnh sửa lịch rảnh' : 'Đăng ký lịch rảnh'}</h3>
                <p className="text-xs text-white/80 mt-0.5">
                  {selectedDate.toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setSelectedDate(null)}>
                <Icon icon={X} size="sm" />
              </Button>
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
                    const disabled = false
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

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={linhHoat} onChange={e => setLinhHoat(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-700">Linh hoạt</span>
                <span className="text-xs text-gray-400">(Có thể hỗ trợ cơ sở khác nếu cần)</span>
              </label>

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
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">Kiểu lặp</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="kieu_lap" value="ngay" checked={kieuLap === 'ngay'} onChange={() => setKieuLap('ngay')}
                            className="h-4 w-4 text-[#a1001f] focus:ring-[#a1001f]" />
                          <span className="text-sm text-gray-700">Theo ngày</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="kieu_lap" value="tuan" checked={kieuLap === 'tuan'} onChange={() => setKieuLap('tuan')}
                            className="h-4 w-4 text-[#a1001f] focus:ring-[#a1001f]" />
                          <span className="text-sm text-gray-700">Theo tuần</span>
                        </label>
                      </div>
                    </div>
                    {lapTu && lapDen && lapTu <= lapDen && (() => {
                      const dates = buildDates()
                      const dayNames = ['CN','T2','T3','T4','T5','T6','T7']
                      if (kieuLap === 'ngay') {
                        return <p className="text-[11px] text-[#a1001f] font-medium">Sẽ set lịch cho {dates.length} ngày (từ {lapTu} đến {lapDen})</p>
                      }
                      const targetDay = selectedDate?.getDay() ?? 1
                      return dates.length > 0
                        ? <p className="text-[11px] text-[#a1001f] font-medium">Sẽ set {dates.length} tuần ({dayNames[targetDay]} hàng tuần từ {lapTu} đến {lapDen})</p>
                        : <p className="text-[11px] text-orange-500 font-medium">Không có ngày phù hợp trong khoảng này.</p>
                    })()}
                  </div>
                )}
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <Button variant="outline" onClick={() => setSelectedDate(null)}>
                Hủy
              </Button>
              <Button variant="default" onClick={handleSave} disabled={saving} loading={saving}>
                Lưu
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}