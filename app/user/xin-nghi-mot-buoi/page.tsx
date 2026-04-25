'use client'

import Modal from '@/components/Modal'
import { PageHeader } from '@/components/PageHeader'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StepItem, Stepper } from '@/components/ui/stepper'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { toast } from '@/lib/app-toast'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { CAMPUS_LIST, findMatchingCampus, normalizeText } from '@/lib/campus-data'
import { useTeacher } from '@/lib/teacher-context'
import {
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    ChevronDown,
    CircleX,
    Plus,
    RefreshCcw,
    Search,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface LeaveRequest {
  id: number
  teacher_name: string
  lms_code: string
  email: string
  campus: string
  leave_date: string
  reason: string
  class_code?: string
  student_count?: string
  class_time?: string
  leave_session?: string
  has_substitute: boolean
  substitute_teacher?: string
  substitute_email?: string
  class_status?: string
  email_subject?: string
  email_body?: string
  status:
    | 'pending_admin'
    | 'approved_unassigned'
    | 'approved_assigned'
    | 'rejected'
    | 'substitute_confirmed'
  admin_note?: string
  created_at: string
  updated_at: string
}

type StatusVariant = 'warning' | 'info' | 'success' | 'destructive'

const STORAGE_KEY = 'teacher_leave_request_auto_fill_data'
const NORTH_CAMPUS_KEYWORDS = [
  'ha noi',
  'hanoi',
  'bac',
  'hai phong',
  'quang ninh',
  'thai nguyen',
  'nam dinh',
]

const LEAVE_SESSION_OPTIONS = Array.from(
  { length: 14 },
  (_, index) => `Buổi ${index + 1}`,
)

const SELECT_BASE_CLASS =
  'w-full min-w-0 max-w-full min-h-11 appearance-none rounded-lg border border-gray-300 bg-white px-3 py-3 pr-10 text-[16px] text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 sm:text-sm'
const INPUT_BASE_CLASS =
  'w-full min-w-0 max-w-full min-h-11 rounded-lg border border-gray-300 px-3 py-3 text-[16px] text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 sm:text-sm'
const TEXTAREA_BASE_CLASS =
  'w-full min-w-0 max-w-full rounded-lg border border-gray-300 px-3 py-2.5 text-[16px] text-gray-900 shadow-sm outline-none transition-colors focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 sm:text-sm'
/** input[type=time]: bước 1 phút */
const TIME_INPUT_CLASS = `${INPUT_BASE_CLASS} tabular-nums`
const MIN_ADVANCE_HOURS = 72
const MAX_REQUESTS_PER_CLASS = 2

type StatFilter = 'pending' | 'done' | 'rejected'

type CampusOption = {
  label: string
  value: string
  shortCode?: string | null
}

/** Chuẩn hoá "8:0:0" | "08:30" -> "08:30" */
function normalizeHhMm(iso: string): string {
  const parts = iso.split(':').map((p) => parseInt(p, 10))
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToVnSegment(iso: string): string {
  const [hs, ms] = normalizeHhMm(iso).split(':')
  const h = parseInt(hs ?? '0', 10)
  const m = parseInt(ms ?? '0', 10)
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatClassTimeRange(start: string, end: string): string {
  return `${timeToVnSegment(start)} - ${timeToVnSegment(end)}`
}

function timeToMinutes(iso: string): number {
  const [h, m] = normalizeHhMm(iso).split(':').map((x) => parseInt(x, 10))
  return (h || 0) * 60 + (m || 0)
}

function matchesStatFilter(
  status: LeaveRequest['status'],
  filter: StatFilter | null,
): boolean {
  if (!filter) return true
  if (filter === 'pending') return status === 'pending_admin'
  if (filter === 'done') return status === 'substitute_confirmed'
  return status === 'rejected'
}

function getStatusMeta(status: LeaveRequest['status']): {
  label: string
  variant: StatusVariant
} {
  switch (status) {
    case 'pending_admin':
      return { label: 'Chờ TC/Leader duyệt', variant: 'warning' }
    case 'approved_unassigned':
      return { label: 'Đã duyệt - chờ phân GV thay', variant: 'info' }
    case 'approved_assigned':
      return { label: 'Đã gửi cho GV thay thế', variant: 'info' }
    case 'substitute_confirmed':
      return { label: 'GV thay đã xác nhận', variant: 'success' }
    case 'rejected':
      return { label: 'Từ chối', variant: 'destructive' }
    default:
      return { label: status, variant: 'info' }
  }
}

function getWorkflowSteps(status: LeaveRequest['status']): StepItem[] {
  const step1: StepItem = {
    id: 1,
    label: 'Gửi mail xin nghỉ',
    status: 'completed',
  }

  let step2Status: StepItem['status'] = 'current'
  let step3Status: StepItem['status'] = 'upcoming'
  let step4Status: StepItem['status'] = 'upcoming'

  if (status === 'rejected') {
    step2Status = 'error'
    step4Status = 'error'
  } else if (
    status === 'approved_unassigned' ||
    status === 'approved_assigned'
  ) {
    step2Status = 'success'
    step3Status = 'current'
  } else if (status === 'substitute_confirmed') {
    step2Status = 'success'
    step3Status = 'success'
    step4Status = 'success'
  }

  return [
    step1,
    { id: 2, label: 'TC/Leader duyệt', status: step2Status },
    { id: 3, label: 'GV thay thế xác nhận', status: step3Status },
    { id: 4, label: 'Hoàn tất quy trình', status: step4Status },
  ]
}

export default function XinNghiMotBuoiPage() {
  const { user, token } = useAuth()
  const { teacherProfile } = useTeacher()
  const campusPickerRef = useRef<HTMLDivElement | null>(null)

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [campusFilter, setCampusFilter] = useState<string[]>([])
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [showCampusDropdown, setShowCampusDropdown] = useState(false)
  const [campusSearchText, setCampusSearchText] = useState('')
  const [showCampusPicker, setShowCampusPicker] = useState(false)
  const [campusPickerSearchText, setCampusPickerSearchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(
    null,
  )
  const [classTimeStart, setClassTimeStart] = useState<string | null>(null)
  const [classTimeEnd, setClassTimeEnd] = useState<string | null>(null)
  const [statFilter, setStatFilter] = useState<StatFilter | null>(null)

  const campusOptions = useMemo(() => {
    const set = new Set<string>()
    leaveRequests.forEach((item) => {
      if (item.campus) set.add(item.campus)
    })
    return Array.from(set).sort()
  }, [leaveRequests])

  const filteredCampusOptions = useMemo(() => {
    if (!campusSearchText.trim()) return campusOptions
    const searchLower = campusSearchText.toLowerCase()
    return campusOptions.filter((campus) =>
      campus.toLowerCase().includes(searchLower),
    )
  }, [campusOptions, campusSearchText])

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((item) => {
      if (!matchesStatFilter(item.status, statFilter)) {
        return false
      }
      if (campusFilter.length > 0 && !campusFilter.includes(item.campus)) {
        return false
      }
      if (fromDate && new Date(item.leave_date) < new Date(fromDate)) {
        return false
      }
      if (toDate && new Date(item.leave_date) > new Date(toDate)) {
        return false
      }
      return true
    })
  }, [leaveRequests, campusFilter, fromDate, toDate, statFilter])

  const [formData, setFormData] = useState({
    teacher_name: '',
    lms_code: '',
    email: user?.email || '',
    campus: '',
    leave_date: '',
    reason: '',
    class_code: '',
    student_count: '',
    class_time: '',
    leave_session: '',
    has_substitute: false,
    substitute_teacher: '',
    substitute_email: '',
    class_status: '',
  })

  const campusSelectionOptions = useMemo<CampusOption[]>(() => {
    const assignedCenters = user?.assignedCenters ?? []
    const options =
      assignedCenters.length > 0
        ? assignedCenters.map((center) => ({
            label: center.full_name,
            value: center.full_name,
            shortCode: center.short_code,
          }))
        : CAMPUS_LIST.map((label) => ({ label, value: label }))

    return Array.from(
      new Map(options.map((option) => [option.value, option])).values(),
    ).sort((a, b) => normalizeText(a.label).localeCompare(normalizeText(b.label)))
  }, [user?.assignedCenters])

  const filteredCampusSelectionOptions = useMemo(() => {
    const search = normalizeText(campusPickerSearchText)
    if (!search) return campusSelectionOptions

    return campusSelectionOptions.filter((option) => {
      return (
        normalizeText(option.label).includes(search) ||
        normalizeText(option.shortCode ?? '').includes(search)
      )
    })
  }, [campusPickerSearchText, campusSelectionOptions])

  const selectedCampusOption = useMemo(
    () =>
      campusSelectionOptions.find(
        (option) => option.value === formData.campus,
      ),
    [campusSelectionOptions, formData.campus],
  )

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved)
      setFormData((prev) => ({ ...prev, ...parsed }))
    } catch (error) {
      console.error('Error loading leave request cache', error)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        campusPickerRef.current &&
        !campusPickerRef.current.contains(event.target as Node)
      ) {
        setShowCampusPicker(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCampusPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const saveFormDraft = (next: {
    teacher_name: string
    lms_code: string
    email: string
    campus: string
  }) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        teacher_name: next.teacher_name,
        lms_code: next.lms_code,
        email: next.email,
        campus: next.campus,
      }),
    )
  }

  useEffect(() => {
    if (!teacherProfile) {
      setFormData((prev) => ({
        ...prev,
        email: prev.email || user?.email || '',
      }))
      return
    }

    const teacherBranch =
      teacherProfile.branchIn || teacherProfile.branchCurrent || ''
    const matchedCampus = findMatchingCampus(teacherBranch)

    setFormData((prev) => {
      const preservedCampus = campusSelectionOptions.some(
        (option) => option.value === prev.campus,
      )
        ? prev.campus
        : ''
      const matchedCampusAllowed = campusSelectionOptions.some(
        (option) => option.value === matchedCampus,
      )

      const updated = {
        ...prev,
        teacher_name: teacherProfile.name || prev.teacher_name || '',
        lms_code: teacherProfile.code || prev.lms_code || '',
        email:
          teacherProfile.emailMindx ||
          teacherProfile.emailPersonal ||
          prev.email ||
          user?.email ||
          '',
        campus: preservedCampus || (matchedCampusAllowed ? matchedCampus : ''),
      }

      saveFormDraft(updated)

      return updated
    })
  }, [campusSelectionOptions, teacherProfile, user?.email])

  const handleCampusSelect = (campus: string) => {
    setFormData((prev) => {
      const next = { ...prev, campus }
      saveFormDraft(next)
      return next
    })
    setShowCampusPicker(false)
    setCampusPickerSearchText('')
  }

  const fetchLeaveRequests = useCallback(
    async (showRefreshToast = false) => {
      if (!user?.email) return

      try {
        setLoading(true)
        setLoadingError(null)

        const response = await fetch(
          `/api/leave-requests?email=${encodeURIComponent(user.email)}`,
          { headers: authHeaders(token) },
        )
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Không thể tải danh sách yêu cầu')
        }

        setLeaveRequests(data.data || [])
        if (showRefreshToast) toast.success('Đã cập nhật danh sách mới nhất')
      } catch (error: unknown) {
        console.error('Error fetching leave requests:', error)
        const errorMessage =
          error instanceof Error ? error.message : 'Có lỗi khi tải dữ liệu'
        setLoadingError(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    [user?.email, token],
  )

  useEffect(() => {
    if (user?.email) {
      fetchLeaveRequests()
    }
  }, [fetchLeaveRequests, user?.email])

  useEffect(() => {
    if (classTimeStart && classTimeEnd) {
      const next = formatClassTimeRange(classTimeStart, classTimeEnd)
      setFormData((prev) =>
        prev.class_time === next ? prev : { ...prev, class_time: next },
      )
    } else {
      setFormData((prev) =>
        prev.class_time === '' ? prev : { ...prev, class_time: '' },
      )
    }
  }, [classTimeStart, classTimeEnd])

  const inferredRegion = useMemo(() => {
    const normalizedCampus = formData.campus.toLowerCase()
    const isNorthernCampus = NORTH_CAMPUS_KEYWORDS.some((keyword) =>
      normalizedCampus.includes(keyword),
    )
    return isNorthernCampus ? 'mien_bac' : 'mien_nam'
  }, [formData.campus])

  const hasSubstitute =
    formData.has_substitute && formData.substitute_teacher.trim().length > 0

  const toLine =
    inferredRegion === 'mien_nam'
      ? 'TC/TE, CS cơ sở xin nghỉ'
      : 'TC/TE, TC, CS cơ sở xin nghỉ'
  const ccLine = 'Leader, TEGL'

  const subjectLine = `[MindX - ${formData.campus || 'Tên Cơ Sở'}] V/v xin nghỉ 1 buổi dạy`

  const leaveDateDisplay = useMemo(() => {
    if (!formData.leave_date) return '[ngày/tháng/năm]'
    return new Date(formData.leave_date).toLocaleDateString('vi-VN')
  }, [formData.leave_date])

  const emailBody = useMemo(() => {
    return `Kính gửi:

Em là ${formData.teacher_name || '[Họ tên giáo viên đầy đủ]'} hiện đang là giáo viên tại cơ sở ${formData.campus || '[Tên Cơ Sở]'}, hôm nay em viết email này xin được nghỉ vào ngày ${leaveDateDisplay}.

Vì lý do ${formData.reason || '[nêu lý do]'}. 

Thông tin lớp học cụ thể như sau:

Mã lớp: ${formData.class_code || '[Mã lớp học]'}. 
Số học viên: ${formData.student_count || '[Số lượng học viên của lớp]'}. 
Thời gian học: ${formData.class_time || '[Giờ Thứ, Ngày]'}. 
Buổi học: ${formData.leave_session || '[Buổi học xin nghỉ]'}. 
Giáo viên thay thế: ${formData.has_substitute ? formData.substitute_teacher || '[Nhập tên giáo viên thay thế]' : ''}. 
Tình hình lớp học: ${formData.class_status || '[Nêu tình hình của lớp, có học viên nào cần lưu ý hay đặc biệt không]'}. 

${
  hasSubstitute
    ? 'Trên đây là thông tin lớp mà em xin nghỉ, mong phía chuyên môn cơ sở xem xét và xác nhận giúp em. Em xin cảm ơn!'
    : 'Trên đây là thông tin lớp mà em xin nghỉ, vì chưa tìm được giáo viên thay nên em nhờ phía chuyên môn hỗ trợ tìm giáo viên giúp em cho buổi học trên. Em xin cảm ơn!'
}

Trân trọng,

${formData.teacher_name || '[Họ Và Tên]'}`
  }, [
    formData.teacher_name,
    formData.campus,
    formData.reason,
    formData.class_code,
    formData.student_count,
    formData.class_time,
    formData.leave_session,
    formData.class_status,
    formData.has_substitute,
    formData.substitute_teacher,
    hasSubstitute,
    leaveDateDisplay,
  ])

  const pendingCount = useMemo(
    () =>
      leaveRequests.filter((item) => item.status === 'pending_admin').length,
    [leaveRequests],
  )
  const doneCount = useMemo(
    () =>
      leaveRequests.filter((item) => item.status === 'substitute_confirmed')
        .length,
    [leaveRequests],
  )
  const rejectedCount = useMemo(
    () => leaveRequests.filter((item) => item.status === 'rejected').length,
    [leaveRequests],
  )
  const totalCount = leaveRequests.length

  const handleChange = (
    field: keyof typeof formData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const resetFormForNew = () => {
    setFormData((prev) => ({
      ...prev,
      leave_date: '',
      reason: '',
      class_code: '',
      student_count: '',
      class_time: '',
      leave_session: '',
      has_substitute: false,
      substitute_teacher: '',
      substitute_email: '',
      class_status: '',
    }))
    setClassTimeStart(null)
    setClassTimeEnd(null)
    setShowCampusPicker(false)
    setCampusPickerSearchText('')
  }

  const validateForm = () => {
    if (
      !formData.teacher_name ||
      !formData.lms_code ||
      !formData.email ||
      !formData.campus ||
      !formData.leave_date ||
      !formData.reason
    ) {
      return 'Vui lòng điền đầy đủ các trường bắt buộc.'
    }

    const classCodeTrim = formData.class_code.trim()
    if (!classCodeTrim) {
      return 'Vui lòng nhập mã lớp (tối đa 2 yêu cầu cho mỗi mã lớp).'
    }

    const sameClassCount = leaveRequests.filter(
      (r) =>
        r.class_code &&
        r.class_code.trim().toLowerCase() === classCodeTrim.toLowerCase(),
    ).length
    if (sameClassCount >= MAX_REQUESTS_PER_CLASS) {
      return `Mỗi mã lớp chỉ được tạo tối đa ${MAX_REQUESTS_PER_CLASS} yêu cầu. Bạn đã đạt giới hạn cho mã lớp này.`
    }

    if (!classTimeStart || !classTimeEnd) {
      return 'Vui lòng chọn đủ giờ bắt đầu và giờ kết thúc (giờ và phút).'
    }

    if (timeToMinutes(classTimeEnd) <= timeToMinutes(classTimeStart)) {
      return 'Giờ kết thúc phải sau giờ bắt đầu.'
    }

    if (!formData.leave_session.trim()) {
      return 'Vui lòng chọn buổi học xin nghỉ.'
    }

    if (formData.reason.trim().length < 10) {
      return 'Lý do xin nghỉ cần rõ ràng hơn (tối thiểu 10 ký tự).'
    }

    const leaveDateMs = new Date(`${formData.leave_date}T00:00:00`).getTime()
    const diffHours = (leaveDateMs - Date.now()) / (1000 * 60 * 60)
    if (diffHours < MIN_ADVANCE_HOURS) {
      return `Ngày xin nghỉ cần cách thời điểm hiện tại tối thiểu ${MIN_ADVANCE_HOURS} giờ.`
    }

    if (formData.has_substitute) {
      if (
        !formData.substitute_teacher.trim() ||
        !formData.substitute_email.trim()
      ) {
        return 'Nếu đã tích giáo viên thay thế, cần nhập đầy đủ tên và email giáo viên thay.'
      }
      const emailValid = /\S+@\S+\.\S+/.test(formData.substitute_email.trim())
      if (!emailValid) {
        return 'Email giáo viên thay thế chưa đúng định dạng.'
      }
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          ...formData,
          email_subject: subjectLine,
          email_body: emailBody,
          substitute_teacher: formData.has_substitute
            ? formData.substitute_teacher
            : '',
          substitute_email: formData.has_substitute
            ? formData.substitute_email
            : '',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(
          'Tạo mail xin nghỉ thành công. Yêu cầu đã vào quy trình duyệt.',
        )
        setShowModal(false)
        resetFormForNew()
        fetchLeaveRequests()
      } else {
        toast.error(`Lỗi: ${data.error}`)
      }
    } catch (error) {
      console.error('Error creating leave request:', error)
      toast.error('Có lỗi xảy ra khi tạo yêu cầu xin nghỉ')
    } finally {
      setSubmitting(false)
    }
  }

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`Đã copy ${label}`)
    } catch {
      toast.error(`Không thể copy ${label}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-10 w-72 animate-pulse rounded bg-gray-200" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <TableSkeleton rows={6} columns={5} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          title="Xin Nghỉ Một Buổi Dạy"
          actions={
            <div className="flex gap-2">
              <Button
                size="lg"
                variant="outline"
                onClick={() => fetchLeaveRequests(true)}
                className="h-10 border-[#f3b4bd] text-[#a1001f] shadow-sm hover:bg-[#a1001f]/5"
              >
                <RefreshCcw className="mr-1.5 h-4 w-4" />
                Làm mới
              </Button>
              <Button
                size="lg"
                onClick={() => {
                  resetFormForNew()
                  setShowCampusPicker(false)
                  setShowModal(true)
                }}
                className="whitespace-nowrap border-2 border-[#a1001f] bg-[#a1001f] text-white shadow-md hover:bg-[#8a001a]"
              >
                <Plus className="mr-2 h-5 w-5" />
                Tạo mail xin nghỉ
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setStatFilter(null)}
            aria-pressed={statFilter === null}
            className={`rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
              statFilter === null
                ? 'border-slate-500 bg-slate-100 shadow-md ring-2 ring-slate-300'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'
            }`}
          >
            <p className="text-xs font-medium text-slate-700">Tất cả</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {totalCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatFilter((prev) => (prev === 'pending' ? null : 'pending'))
            }
            aria-pressed={statFilter === 'pending'}
            className={`rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 ${
              statFilter === 'pending'
                ? 'border-amber-500 bg-amber-100 shadow-md ring-2 ring-amber-300'
                : 'border-amber-200 bg-amber-50 hover:bg-amber-100/80'
            }`}
          >
            <p className="text-xs font-medium text-amber-700">Chờ duyệt</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">
              {pendingCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatFilter((prev) => (prev === 'done' ? null : 'done'))
            }
            aria-pressed={statFilter === 'done'}
            className={`rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${
              statFilter === 'done'
                ? 'border-emerald-500 bg-emerald-100 shadow-md ring-2 ring-emerald-300'
                : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80'
            }`}
          >
            <p className="text-xs font-medium text-emerald-700">Đã hoàn tất</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">
              {doneCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() =>
              setStatFilter((prev) => (prev === 'rejected' ? null : 'rejected'))
            }
            aria-pressed={statFilter === 'rejected'}
            className={`rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 ${
              statFilter === 'rejected'
                ? 'border-rose-500 bg-rose-100 shadow-md ring-2 ring-rose-300'
                : 'border-rose-200 bg-rose-50 hover:bg-rose-100/80'
            }`}
          >
            <p className="text-xs font-medium text-rose-700">Bị từ chối</p>
            <p className="mt-1 text-2xl font-bold text-rose-900">
              {rejectedCount}
            </p>
          </button>
        </div>

        {/* Bộ lọc nâng cao */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="relative w-full md:w-auto">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Cơ sở
            </label>
            <button
              type="button"
              onClick={() => setShowCampusDropdown(!showCampusDropdown)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 md:min-w-45"
            >
              <span className="truncate">
                {campusFilter.length === 0
                  ? 'Tất cả'
                  : `${campusFilter.length} cơ sở`}
              </span>
              <svg
                className="w-4 h-4 ml-2 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showCampusDropdown && (
              <div className="absolute left-0 right-0 z-10 mt-1 flex max-h-80 w-full flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg md:left-auto md:right-auto md:min-w-60">
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    placeholder="Tìm kiếm cơ sở..."
                    value={campusSearchText}
                    onChange={(e) => setCampusSearchText(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="p-2 border-b border-gray-200 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCampusFilter(filteredCampusOptions)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampusFilter([])}
                    className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Bỏ chọn
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredCampusOptions.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                      Không tìm thấy cơ sở
                    </div>
                  ) : (
                    filteredCampusOptions.map((campus) => (
                      <label
                        key={campus}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={campusFilter.includes(campus)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCampusFilter([...campusFilter, campus])
                            } else {
                              setCampusFilter(
                                campusFilter.filter((c) => c !== campus),
                              )
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{campus}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="w-fit md:w-auto">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Từ ngày
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm md:w-auto"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate || undefined}
            />
          </div>
          <div className="w-fit md:w-auto">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Đến ngày
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm md:w-auto"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || undefined}
            />
          </div>
          {(campusFilter.length > 0 ||
            fromDate ||
            toDate ||
            statFilter !== null) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCampusFilter([])
                setFromDate('')
                setToDate('')
                setStatFilter(null)
              }}
            >
              Xoá lọc
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Danh sách yêu cầu xin nghỉ
            </h2>
            <p className="text-sm text-gray-600">
              Tổng: {filteredRequests.length} yêu cầu
            </p>
          </div>

          {loadingError && (
            <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:mx-6">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Không thể tải dữ liệu</p>
                <p className="mt-0.5">{loadingError}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchLeaveRequests()}
              >
                Thử lại
              </Button>
            </div>
          )}

          {filteredRequests.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-600">
              Không có yêu cầu nào phù hợp bộ lọc.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead>Ngày nghỉ</TableHead>
                      <TableHead>Cơ sở</TableHead>
                      <TableHead>Mã lớp</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((item) => {
                      const statusMeta = getStatusMeta(item.status)
                      return (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-blue-50/40"
                          onClick={() => setSelectedRequest(item)}
                        >
                          <TableCell>
                            {new Date(item.created_at).toLocaleDateString(
                              'vi-VN',
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(item.leave_date).toLocaleDateString(
                              'vi-VN',
                            )}
                          </TableCell>
                          <TableCell>{item.campus}</TableCell>
                          <TableCell>{item.class_code || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={statusMeta.variant}>
                              {statusMeta.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-gray-200 lg:hidden">
                {filteredRequests.map((item) => {
                  const statusMeta = getStatusMeta(item.status)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full p-4 text-left hover:bg-gray-50"
                      onClick={() => setSelectedRequest(item)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.campus}
                        </p>
                        <Badge variant={statusMeta.variant}>
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">
                        Ngày nghỉ:{' '}
                        {new Date(item.leave_date).toLocaleDateString('vi-VN')}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        Mã lớp: {item.class_code || '-'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowCampusPicker(false)
          setCampusPickerSearchText('')
          setShowModal(false)
        }}
        title="Tạo mail xin nghỉ 1 buổi"
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5 pb-2 sm:pb-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Quy định nhanh</p>
            <div className="mt-2 space-y-1 text-[13px]">
              <p className="flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" />
                Báo nghỉ trước tối thiểu {MIN_ADVANCE_HOURS} giờ.
              </p>
              <p className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Mỗi mã lớp tối đa {MAX_REQUESTS_PER_CLASS} yêu cầu; cung cấp đủ
                thông tin lớp để admin phân GV thay nhanh.
              </p>
              <p className="flex items-center gap-1.5">
                <CircleX className="h-4 w-4" />
                Nếu có GV thay sẵn, cần nhập đủ tên và email.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 [&>div]:min-w-0">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Ngày xin nghỉ *
              </label>
              <input
                required
                type="date"
                value={formData.leave_date}
                onChange={(e) => handleChange('leave_date', e.target.value)}
                className={`${INPUT_BASE_CLASS} appearance-none`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Lý do xin nghỉ *
              </label>
              <textarea
                required
                rows={3}
                value={formData.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                className={TEXTAREA_BASE_CLASS}
              />
            </div>

            <div ref={campusPickerRef} className="relative md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Cơ sở *
              </label>
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !showCampusPicker
                  setShowCampusPicker(nextOpen)
                  if (nextOpen) {
                    setCampusPickerSearchText('')
                  }
                }}
                className={`${SELECT_BASE_CLASS} flex items-center justify-between text-left`}
                aria-expanded={showCampusPicker}
                aria-haspopup="listbox"
              >
                <span className="min-w-0 truncate">
                  {selectedCampusOption?.label || formData.campus || 'Chọn cơ sở'}
                </span>
                <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-gray-400" />
              </button>
              <p className="mt-1.5 text-xs text-gray-500">
                Chỉ hiển thị các cơ sở bạn được phân công. Gõ để tìm nhanh.
              </p>

              {showCampusPicker && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
                  <div className="border-b border-gray-100 p-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={campusPickerSearchText}
                        onChange={(e) => setCampusPickerSearchText(e.target.value)}
                        placeholder="Tìm kiếm cơ sở..."
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 pl-10 text-sm outline-none transition focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/20"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto p-2">
                    {filteredCampusSelectionOptions.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-gray-500">
                        Không tìm thấy cơ sở phù hợp.
                      </div>
                    ) : (
                      filteredCampusSelectionOptions.map((option) => {
                        const isSelected = option.value === formData.campus

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleCampusSelect(option.value)}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                              isSelected ? 'bg-[#a1001f]/5 ring-1 ring-[#a1001f]/10' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {option.label}
                              </p>
                              {option.shortCode ? (
                                <p className="mt-0.5 text-xs text-gray-500">
                                  {option.shortCode}
                                </p>
                              ) : null}
                            </div>
                            {isSelected ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : null}
                          </button>
                        )
                      })
                    )}
                  </div>

                  {formData.campus && (
                    <div className="border-t border-gray-100 p-2">
                      <button
                        type="button"
                        onClick={() => handleCampusSelect('')}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                      >
                        Xóa lựa chọn cơ sở
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Mã lớp *
              </label>
              <input
                required
                type="text"
                value={formData.class_code}
                onChange={(e) => handleChange('class_code', e.target.value)}
                className={INPUT_BASE_CLASS}
                placeholder="Nhập đúng mã lớp (giới hạn theo quy định)"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Số học viên
              </label>
              <input
                type="text"
                value={formData.student_count}
                onChange={(e) => handleChange('student_count', e.target.value)}
                className={INPUT_BASE_CLASS}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Thời gian học *
              </label>
              <p className="mb-3 text-xs text-gray-500">
                Dùng định dạng 24 giờ (00:00 - 23:59). Mobile sẽ mở bánh xe giờ/phút.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label
                    htmlFor="class-time-start"
                    className="mb-1.5 block text-xs font-medium text-gray-600"
                  >
                    Giờ bắt đầu
                  </label>
                  <input
                    id="class-time-start"
                    type="time"
                    step={60}
                    lang="en-GB"
                    value={classTimeStart ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setClassTimeStart(v ? v.slice(0, 5) : null)
                    }}
                    className={TIME_INPUT_CLASS}
                    aria-label="Giờ và phút bắt đầu"
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="class-time-end"
                    className="mb-1.5 block text-xs font-medium text-gray-600"
                  >
                    Giờ kết thúc
                  </label>
                  <input
                    id="class-time-end"
                    type="time"
                    step={60}
                    lang="en-GB"
                    value={classTimeEnd ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setClassTimeEnd(v ? v.slice(0, 5) : null)
                    }}
                    className={TIME_INPUT_CLASS}
                    aria-label="Giờ và phút kết thúc"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Buổi học xin nghỉ *
              </label>
              <div className="relative">
                <select
                  required
                  value={formData.leave_session}
                  onChange={(e) =>
                    handleChange('leave_session', e.target.value)
                  }
                  className={SELECT_BASE_CLASS}
                >
                  <option value="">Chọn buổi học</option>
                  {LEAVE_SESSION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.has_substitute}
                  onChange={(e) => {
                    const checked = e.target.checked
                    handleChange('has_substitute', checked)
                    if (!checked) {
                      handleChange('substitute_teacher', '')
                      handleChange('substitute_email', '')
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Giáo viên thay thế (tích nếu đã có)
              </label>
            </div>
            {formData.has_substitute && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Tên giáo viên thay thế *
                  </label>
                  <input
                    type="text"
                    value={formData.substitute_teacher}
                    onChange={(e) =>
                      handleChange('substitute_teacher', e.target.value)
                    }
                    className={INPUT_BASE_CLASS}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Email giáo viên thay thế *
                  </label>
                  <input
                    type="email"
                    value={formData.substitute_email}
                    onChange={(e) =>
                      handleChange('substitute_email', e.target.value)
                    }
                    className={INPUT_BASE_CLASS}
                  />
                </div>
              </>
            )}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Tình hình lớp học
              </label>
              <textarea
                rows={3}
                value={formData.class_status}
                onChange={(e) => handleChange('class_status', e.target.value)}
                className={TEXTAREA_BASE_CLASS}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-gray-800">
                Mẫu mail sẽ gửi
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyText('nội dung mail', emailBody)}
                className="w-full sm:w-auto border-[#a1001f]/30 text-[#a1001f] hover:border-[#a1001f]/50 hover:bg-[#a1001f]/5"
              >
                Copy nội dung
              </Button>
            </div>
            <p className="text-sm">
              <span className="font-medium">To:</span> {toLine}
            </p>
            <p className="text-sm">
              <span className="font-medium">CC:</span> {ccLine}
            </p>
            <p className="text-sm">
              <span className="font-medium">Tiêu đề:</span> {subjectLine}
            </p>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700 sm:max-h-52 sm:text-sm">
              {emailBody}
            </pre>
          </div>

          <div className="flex justify-end border-t border-gray-200 pt-5">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto sm:min-w-60 justify-center bg-[#a1001f] px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-[#8a001a]"
            >
              {submitting ? 'Đang tạo...' : 'Tạo yêu cầu xin nghỉ'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title={
          selectedRequest
            ? `Chi tiết yêu cầu #${selectedRequest.id}`
            : 'Chi tiết yêu cầu'
        }
        maxWidth="3xl"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 sm:text-base">
                Chi tiết yêu cầu xin nghỉ
              </h3>
              <Stepper steps={getWorkflowSteps(selectedRequest.status)} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Giáo viên</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRequest.teacher_name}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Mã LMS</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRequest.lms_code}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Email</p>
                <p className="text-sm font-medium text-gray-900 break-all">
                  {selectedRequest.email}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Ngày nghỉ</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(selectedRequest.leave_date).toLocaleDateString(
                    'vi-VN',
                  )}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Trạng thái</p>
                <p className="text-sm font-medium text-gray-900">
                  {getStatusMeta(selectedRequest.status).label}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Mã lớp</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRequest.class_code || '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Buổi học xin nghỉ</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRequest.leave_session || '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Thời gian học</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRequest.class_time || '-'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Giáo viên thay thế</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedRequest.substitute_teacher ||
                  selectedRequest.substitute_email
                    ? `${selectedRequest.substitute_teacher || '-'} (${selectedRequest.substitute_email || '-'})`
                    : 'Chưa có'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                <p className="text-xs text-gray-600">Lý do</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {selectedRequest.reason}
                </p>
              </div>
              {selectedRequest.class_status && (
                <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                  <p className="text-xs text-gray-600">Tình hình lớp</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedRequest.class_status}
                  </p>
                </div>
              )}
              {selectedRequest.admin_note && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
                  <p className="text-xs text-amber-800">Ghi chú từ TC/Leader</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">
                    {selectedRequest.admin_note}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
