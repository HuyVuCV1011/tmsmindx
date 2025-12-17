"use client";

import { Briefcase, Calendar, Clock, Mail, MapPin, Search, TrendingUp, User, UserCheck } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

interface TeacherAvailability {
  timestamp: string;
  email: string;
  name: string;
  mainSubject: string;
  subjects: string;
  mainBranch: string;
  branches: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  notes: string;
}

interface TestRecord {
  area: string;
  name: string;
  email: string;
  subject?: string;
  branch: string;
  code: string;
  type: string;
  teachingLevel?: string;
  month: string;
  year: string;
  batch: string;
  time: string;
  exam?: string;
  correct: string;
  score: string;
  emailExplanation: string;
  processing: string;
  date: string;
  isCountedInAverage: boolean;
}

interface MonthlyAverage {
  month: string;
  average: number;
  count: number;
  records: TestRecord[];
}

interface Teacher {
  stt: string;
  name: string;
  code: string;
  emailMindx: string;
  emailPersonal: string;
  status: string;
  branchIn: string;
  programIn: string;
  branchCurrent: string;
  programCurrent: string;
  manager: string;
  responsible: string;
  position: string;
  startDate: string;
  onboardBy: string;
}

// Memoized InfoItem component
const InfoItem = memo(({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => {
  return (
    <div className="flex items-start gap-2 p-2 rounded border border-gray-200">
      <div className="text-gray-600 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-600">{label}</div>
        <div className="text-sm font-medium text-gray-900 truncate">{value}</div>
      </div>
    </div>
  );
});
InfoItem.displayName = 'InfoItem';

// Fetcher function with caching and compression
const fetcher = async (url: string) => {
  const res = await fetch(url, { 
    next: { revalidate: 60 }, // Cache 60s
    headers: { 
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=60'
    }
  });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function Page1() {
  const [searchCode, setSearchCode] = useState("");
  const [submitCode, setSubmitCode] = useState("");
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("12");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedTableYear, setSelectedTableYear] = useState("2025");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMonth, setModalMonth] = useState<string | null>(null);
  const [modalType, setModalType] = useState<"expertise" | "experience" | null>(null);
  const [modalRecords, setModalRecords] = useState<TestRecord[]>([]);
  const [availabilityPeriod, setAvailabilityPeriod] = useState<"week" | "month" | "year">("month");
  
  // Load last searched code from localStorage
  useEffect(() => {
    const lastCode = localStorage.getItem('lastSearchCode');
    if (lastCode) {
      setSearchCode(lastCode);
    }
  }, []);

  // SWR với auto caching và revalidation
  const { data: teacherData, isLoading: isLoadingTeacher } = useSWR(
    submitCode ? `/api/teachers?code=${submitCode}` : null,
    fetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 60000 // Dedupe requests trong 60s
    }
  );

  const teacher = teacherData?.teacher || null;

  // Only load scores after teacher is loaded
  const { data: expertiseDataRes, isLoading: isLoadingExpertise } = useSWR(
    teacher ? `/api/rawdata?code=${submitCode}` : null,
    fetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 60000
    }
  );

  const { data: experienceDataRes, isLoading: isLoadingExperience } = useSWR(
    teacher ? `/api/rawdata-experience?code=${submitCode}` : null,
    fetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 60000
    }
  );

  const expertiseData = expertiseDataRes?.monthlyData || [];
  const experienceData = experienceDataRes?.monthlyData || [];
  const scoresLoaded = !isLoadingExpertise && !isLoadingExperience;

  // Fetch availability data - dynamic date range based on period
  const { fromDate: availabilityFromDate, toDate: availabilityToDate } = useMemo(() => {
    const date = new Date();
    const today = date.toISOString().split('T')[0];
    const fromDate = new Date();
    
    if (availabilityPeriod === 'week') {
      // Get start of current week (Sunday)
      const dayOfWeek = date.getDay();
      fromDate.setDate(date.getDate() - dayOfWeek);
    } else if (availabilityPeriod === 'month') {
      // Get start of current month
      fromDate.setDate(1);
    } else {
      // Get start of current year
      fromDate.setMonth(0);
      fromDate.setDate(1);
    }
    
    return {
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: today
    };
  }, [availabilityPeriod]);

  // Load availability AFTER scores are loaded - filter by teacher name on server side
  // This allows UI to render first, then load availability data later
  const { data: availabilityDataRes, isLoading: isLoadingAvailabilityData } = useSWR(
    (teacher && scoresLoaded) ? `/api/availability?fromDate=${availabilityFromDate}&toDate=${availabilityToDate}&teacherName=${encodeURIComponent(teacher.name || '')}` : null,
    fetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 60000
    }
  );

  const availabilityRecords = useMemo(() => {
    if (!availabilityDataRes?.teachers || !teacher) return [];
    // Additional client-side filter for email matching (backup)
    const records = availabilityDataRes.teachers.filter((t: TeacherAvailability) => {
      const emailMatch = t.email?.toLowerCase() === teacher.emailMindx?.toLowerCase() || 
                         t.email?.toLowerCase() === teacher.emailPersonal?.toLowerCase();
      const nameMatch = t.name?.toLowerCase().includes(teacher.name?.toLowerCase()) || 
                        teacher.name?.toLowerCase().includes(t.name?.toLowerCase());
      return emailMatch || nameMatch;
    });
    
    console.log('🔍 Availability Records:', {
      totalTeachers: availabilityDataRes.teachers.length,
      filteredRecords: records.length,
      teacherEmail: teacher.emailMindx,
      teacherName: teacher.name,
      sampleRecord: records[0]
    });
    
    return records;
  }, [availabilityDataRes, teacher]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modalOpen) {
        setModalOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [modalOpen]);

  // Handle teacher data errors
  useEffect(() => {
    if (teacherData && teacherData.error) {
      setError(teacherData.error);
    } else if (submitCode && !isLoadingTeacher && teacherData && !teacher) {
      setError("Không tìm thấy giáo viên với mã này");
    } else if (teacher) {
      setError("");
    }
  }, [teacherData, teacher, submitCode, isLoadingTeacher]);

  // Debounce search for better performance
  useEffect(() => {
    if (!searchCode.trim()) return;
    
    const timer = setTimeout(() => {
      // Auto-search after 500ms of no typing
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchCode]);

  const handleSearch = useCallback(() => {
    if (!searchCode.trim()) {
      setError("Vui lòng nhập mã giáo viên");
      return;
    }
    setError("");
    const trimmedCode = searchCode.trim();
    setSubmitCode(trimmedCode);
    // Save to localStorage for quick access
    localStorage.setItem('lastSearchCode', trimmedCode);
  }, [searchCode]);

  const getScoreForMonth = useCallback((data: MonthlyAverage[], month: string): string => {
    const found = data.find(d => d.month === month);
    return found ? found.average.toFixed(1) : "N/A";
  }, []);

  const openModal = useCallback((month: string, type: "expertise" | "experience") => {
    const data = type === "expertise" ? expertiseData : experienceData;
    const monthData = data.find((d: MonthlyAverage) => d.month === month);
    
    if (monthData && monthData.records.length > 0) {
      setModalMonth(month);
      setModalType(type);
      setModalRecords(monthData.records);
      setModalOpen(true);
    }
  }, [expertiseData, experienceData]);

  // Memoize tính toán điểm để tránh re-calculate
  const expertiseScore = useMemo(() => {
    const currentMonth = parseInt(selectedMonth);
    const currentYear = parseInt(selectedYear);
    const scores: number[] = [];
    
    for (let i = 0; i < 6; i++) {
      let month = currentMonth - i;
      let year = currentYear;
      
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      
      const monthKey = `${month}/${year}`;
      const score = getScoreForMonth(expertiseData, monthKey);
      
      if (score !== "N/A") {
        scores.push(parseFloat(score));
      }
    }
    
    return scores.length > 0 ? Math.max(...scores).toFixed(1) : "N/A";
  }, [selectedMonth, selectedYear, expertiseData, getScoreForMonth]);

  const experienceScore = useMemo(() => {
    const currentMonth = parseInt(selectedMonth);
    const currentYear = parseInt(selectedYear);
    const scores: number[] = [];
    
    for (let i = 0; i < 6; i++) {
      let month = currentMonth - i;
      let year = currentYear;
      
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      
      const monthKey = `${month}/${year}`;
      const score = getScoreForMonth(experienceData, monthKey);
      
      if (score !== "N/A") {
        scores.push(parseFloat(score));
      }
    }
    
    return scores.length > 0 ? Math.max(...scores).toFixed(1) : "N/A";
  }, [selectedMonth, selectedYear, experienceData, getScoreForMonth]);

  // Memoize highlighted months
  const highlightedMonths = useMemo(() => {
    const currentMonth = parseInt(selectedMonth);
    const currentYear = parseInt(selectedYear);
    const months: string[] = [];
    
    for (let i = 0; i < 6; i++) {
      let month = currentMonth - i;
      let year = currentYear;
      
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      
      months.push(`${month}/${year}`);
    }
    
    return months;
  }, [selectedMonth, selectedYear]);

  // Calculate detailed availability statistics with time slot analysis
  const availabilityStats = useMemo(() => {
    if (availabilityRecords.length === 0) return null;

    const DAYS = [
      { key: 'monday' as const, label: 'Thứ 2', short: 'T2' },
      { key: 'tuesday' as const, label: 'Thứ 3', short: 'T3' },
      { key: 'wednesday' as const, label: 'Thứ 4', short: 'T4' },
      { key: 'thursday' as const, label: 'Thứ 5', short: 'T5' },
      { key: 'friday' as const, label: 'Thứ 6', short: 'T6' },
      { key: 'saturday' as const, label: 'Thứ 7', short: 'T7' },
      { key: 'sunday' as const, label: 'Chủ nhật', short: 'CN' },
    ];
    const TIME_SLOTS = ['Sáng', 'Chiều', 'Tối'] as const;
    
    const dayCount: Record<string, number> = {};
    const timeSlotCount: Record<string, number> = { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 };
    const periodData: { label: string; count: number }[] = [];
    
    // Create availability matrix for heatmap
    type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    type TimeSlot = 'Sáng' | 'Chiều' | 'Tối';
    const availabilityMatrix: Record<DayKey, Record<TimeSlot, number>> = {
      monday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      tuesday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      wednesday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      thursday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      friday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      saturday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      sunday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
    };

    DAYS.forEach(day => { dayCount[day.key] = 0; });

    // Group records by period and count slots
    const recordsByPeriod = new Map<string, number>();
    
    availabilityRecords.forEach((record: TeacherAvailability) => {
      // Parse record date
      const [datePart] = record.timestamp.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const recordDate = new Date(year, month - 1, day);
      
      // Count total available slots in this record
      let recordSlotCount = 0;
      
      DAYS.forEach(({ key: dayKey }) => {
        const availability = record[dayKey as keyof TeacherAvailability] as string;
        if (availability && availability !== 'Bận') {
          dayCount[dayKey]++;
          
          // Count by time slot and build matrix
          TIME_SLOTS.forEach(slot => {
            if (availability.includes(slot)) {
              timeSlotCount[slot as TimeSlot]++;
              availabilityMatrix[dayKey as DayKey][slot as TimeSlot]++;
              recordSlotCount++;
            }
          });
        }
      });
      
      // Determine period key based on filter selection
      let periodKey = '';
      const now = new Date();
      const recordMonth = recordDate.getMonth();
      const recordYear = recordDate.getFullYear();
      const nowMonth = now.getMonth();
      const nowYear = now.getFullYear();
      
      if (availabilityPeriod === 'week') {
        // Only include records in current week
        const nowWeekStart = new Date(now);
        nowWeekStart.setDate(now.getDate() - now.getDay());
        nowWeekStart.setHours(0, 0, 0, 0);
        
        if (recordDate >= nowWeekStart && recordDate <= now) {
          const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
          periodKey = `${dayNames[recordDate.getDay()]} (${day}/${month})`;
        }
      } else if (availabilityPeriod === 'month') {
        // Only include records in current month
        if (recordMonth === nowMonth && recordYear === nowYear) {
          // Group by week of month
          const weekOfMonth = Math.floor((day - 1) / 7) + 1;
          periodKey = `Tuần ${weekOfMonth}`;
        }
      } else {
        // Only include records in current year
        if (recordYear === nowYear) {
          const displayMonth = recordMonth + 1; // 1-based month
          periodKey = `T${displayMonth}/${recordYear}`;
        }
      }
      
      if (periodKey) {
        recordsByPeriod.set(periodKey, (recordsByPeriod.get(periodKey) || 0) + recordSlotCount);
      }
    });

    // Convert to array and sort
    const entries = Array.from(recordsByPeriod.entries()).map(([label, count]) => ({ label, count }));
    
    if (availabilityPeriod === 'week') {
      // Sort by day of week (CN, T2, T3, ...)
      entries.sort((a, b) => {
        const dayOrder = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const aDay = a.label.split(' ')[0];
        const bDay = b.label.split(' ')[0];
        return dayOrder.indexOf(aDay) - dayOrder.indexOf(bDay);
      });
    } else if (availabilityPeriod === 'month') {
      // Sort by week number
      entries.sort((a, b) => {
        const aNum = parseInt(a.label.replace('Tuần ', ''));
        const bNum = parseInt(b.label.replace('Tuần ', ''));
        return aNum - bNum;
      });
    } else {
      // Sort by month
      entries.sort((a, b) => {
        const [aMonth, aYear] = a.label.replace('T', '').split('/').map(Number);
        const [bMonth, bYear] = b.label.replace('T', '').split('/').map(Number);
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
      });
    }
    
    periodData.push(...entries);

    // Find most available day and time
    const mostAvailableDay = Object.entries(dayCount).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const mostAvailableTime = Object.entries(timeSlotCount).reduce((a, b) => a[1] > b[1] ? a : b)[0];

    const totalRegistrations = availabilityRecords.length;
    const avgPerPeriod = availabilityPeriod === 'week' ? Math.round(totalRegistrations / 7) :
                          availabilityPeriod === 'month' ? Math.round((totalRegistrations / 30) * 7) :
                          Math.round(totalRegistrations / 12);

    // Calculate total slots across all records
    const totalSlots = Object.values(timeSlotCount).reduce((sum, count) => sum + count, 0);
    
    const stats = {
      totalRegistrations,
      dayCount,
      timeSlotCount,
      periodData,
      mostAvailableDay,
      mostAvailableTime,
      avgPerPeriod,
      availabilityMatrix,
      totalSlots,
      DAYS,
      TIME_SLOTS,
    };
    
    // Debug logging
    if (periodData.length === 0) {
      console.warn('⚠️ No availability data:', {
        period: availabilityPeriod,
        totalRecords: availabilityRecords.length,
        dateRange: { from: availabilityFromDate, to: availabilityToDate }
      });
    }
    
    return stats;
  }, [availabilityRecords, availabilityPeriod, availabilityFromDate, availabilityToDate]);

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4">
      <div className="space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="border-b border-gray-900 pb-2 sm:pb-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tìm kiếm giáo viên</h1>
          <p className="text-xs text-gray-600 mt-1">Nhập mã giáo viên để xem thông tin chi tiết</p>
        </div>

        {/* Search Box */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Nhập mã giáo viên (ví dụ: datpt1, tramhlb)"
              className="w-full px-3 py-2 text-sm border border-gray-900 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
              autoFocus
            />
            {isLoadingTeacher && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"></div>
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoadingTeacher}
            className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-w-[100px]"
          >
            <Search className="h-4 w-4" />
            {isLoadingTeacher ? "Đang tìm..." : "Tìm"}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!submitCode && !error && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 sm:p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Tìm kiếm giáo viên</h3>
              <p className="text-xs sm:text-sm text-gray-600 max-w-md">
                Nhập mã giáo viên vào ô tìm kiếm phía trên để xem thông tin chi tiết, điểm đánh giá và hiệu suất làm việc
              </p>
            </div>
          </div>
        )}

        {/* Loading Teacher */}
        {isLoadingTeacher && submitCode && (
          <div className="border border-gray-300 rounded-lg p-6 sm:p-8 bg-white">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-gray-200"></div>
                <div className="absolute top-0 h-12 w-12 animate-spin rounded-full border-4 border-gray-900 border-t-transparent"></div>
              </div>
              <div className="text-center">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Đang tải thông tin giáo viên...</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Bước 1/3: Tìm kiếm dữ liệu giáo viên</p>
              </div>
            </div>
          </div>
        )}

        {/* Teacher Info */}
        {teacher && (
          <div className="border border-gray-900 rounded-lg overflow-hidden animate-fadeIn">
            {/* Header Card */}
            <div className="bg-gray-900 text-white p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white text-gray-900 flex items-center justify-center font-bold text-base sm:text-lg shrink-0">
                  {teacher.name.split(" ").pop()?.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-bold truncate">{teacher.name}</h2>
                  <p className="text-xs opacity-90">{teacher.code}</p>
                </div>
                <div className="shrink-0">
                  <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                    teacher.status === "Active" 
                      ? "bg-green-500 text-white" 
                      : "bg-gray-500 text-white"
                  }`}>
                    {teacher.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                {teacher.emailMindx && teacher.emailMindx !== "N/A" && (
                  <InfoItem icon={<Mail className="h-4 w-4" />} label="Email MindX" value={teacher.emailMindx} />
                )}
                {teacher.emailPersonal && teacher.emailPersonal !== "N/A" && (
                  <InfoItem icon={<Mail className="h-4 w-4" />} label="Email cá nhân" value={teacher.emailPersonal} />
                )}
                {teacher.branchCurrent && teacher.branchCurrent !== "N/A" && (
                  <InfoItem icon={<MapPin className="h-4 w-4" />} label="Chi nhánh hiện tại" value={teacher.branchCurrent} />
                )}
                {teacher.programCurrent && teacher.programCurrent !== "N/A" && (
                  <InfoItem icon={<Briefcase className="h-4 w-4" />} label="Program" value={teacher.programCurrent} />
                )}
                {teacher.position && teacher.position !== "N/A" && (
                  <InfoItem icon={<User className="h-4 w-4" />} label="Vị trí" value={teacher.position} />
                )}
                {teacher.startDate && teacher.startDate !== "N/A" && (
                  <InfoItem icon={<Calendar className="h-4 w-4" />} label="Ngày vào" value={teacher.startDate} />
                )}
                {teacher.manager && teacher.manager !== "N/A" && (
                  <InfoItem icon={<UserCheck className="h-4 w-4" />} label="Người quản lý" value={teacher.manager} />
                )}
                {teacher.responsible && teacher.responsible !== "N/A" && (
                  <InfoItem icon={<UserCheck className="h-4 w-4" />} label="Người phụ trách" value={teacher.responsible} />
                )}
              </div>

              {/* Additional Info */}
              <div className="pt-3 border-t border-gray-200">
                <h3 className="text-xs font-bold text-gray-900 mb-2">Thông tin ban đầu</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="text-xs">
                    <span className="text-gray-600">Chi nhánh đầu vào:</span>
                    <span className="ml-2 font-medium">{teacher.branchIn}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Program đầu vào:</span>
                    <span className="ml-2 font-medium">{teacher.programIn}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Onboard bởi:</span>
                    <span className="ml-2 font-medium">{teacher.onboardBy}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* Loading Scores */}
        {teacher && (isLoadingExpertise || isLoadingExperience) && (
          <div className="border border-gray-300 rounded-lg p-6 sm:p-8 bg-white">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-gray-200"></div>
                <div className="absolute top-0 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              </div>
              <div className="text-center">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Đang tải Điểm Đánh Giá...</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Bước 2/3 - Lấy dữ liệu chuyên môn & kỹ năng (song song)</p>
              </div>
            </div>
          </div>
        )}

        {/* Score Summary */}
        {teacher && scoresLoaded && (expertiseData.length > 0 || experienceData.length > 0) && (
          <div className="border border-gray-900 rounded-lg p-3 sm:p-4 animate-fadeIn">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tháng</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-900 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Năm</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-900 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Chuyên môn</label>
                <div className="px-4 py-2 bg-gray-900 text-white rounded text-center">
                  <span className="text-lg font-bold">{expertiseScore}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Quy trình & Kỹ năng trải nghiệm</label>
                <div className="px-4 py-2 bg-gray-900 text-white rounded text-center">
                  <span className="text-lg font-bold">{experienceScore}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Metrics */}
        {teacher && scoresLoaded && (expertiseData.length > 0 || experienceData.length > 0) && (
          <div className="border border-gray-900 rounded-lg overflow-hidden mt-3 sm:mt-4 animate-fadeIn">
            <div className="bg-gray-900 text-white p-2 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Các chỉ số theo tháng</h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs">Năm:</label>
                <select
                  value={selectedTableYear}
                  onChange={(e) => setSelectedTableYear(e.target.value)}
                  className="px-2 py-1 text-xs bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-white flex-1 sm:flex-initial"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
            </div>
            <div className="p-2 sm:p-4 overflow-x-auto -mx-2 sm:mx-0">
              {(() => {
                const months = Array.from({ length: 12 }, (_, i) => `${i + 1}/${selectedTableYear}`);

                return (
                  <table className="w-full text-[10px] sm:text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-900">
                        <th className="text-left py-1.5 sm:py-2 px-1.5 sm:px-2 font-bold text-gray-900 min-w-[100px] sticky left-0 bg-white z-10">Chỉ tiêu</th>
                        {months.map((month) => (
                          <th key={month} className={`text-center py-1.5 sm:py-2 px-1 sm:px-2 min-w-[50px] sm:min-w-[60px] ${
                            highlightedMonths.includes(month) ? "bg-blue-50" : ""
                          }`}>
                            <div className="font-medium text-gray-700 whitespace-nowrap">T{month.split('/')[0]}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 sticky left-0 bg-white z-10">
                          <div className="font-medium text-gray-900 text-[10px] sm:text-xs">CM Chuyên sâu</div>
                        </td>
                        {months.map((month) => {
                          const score = getScoreForMonth(expertiseData, month);
                          const scoreValue = score === "N/A" ? 0 : parseFloat(score);
                          return (
                            <td key={month} className={`text-center py-1.5 sm:py-2 px-1 sm:px-2 ${
                              highlightedMonths.includes(month) ? "bg-blue-50" : ""
                            }`}>
                              <span 
                                onClick={() => score !== "N/A" && openModal(month, "expertise")}
                                className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                                  score === "N/A"
                                    ? "bg-gray-200 text-gray-700" 
                                    : scoreValue >= 4 
                                      ? "bg-green-100 text-green-800 cursor-pointer hover:bg-green-200" 
                                      : "bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200"
                                }`}>
                                {score}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 sticky left-0 bg-white z-10">
                          <div className="font-medium text-gray-900 text-[10px] sm:text-xs">KN - QT Trải nghiệm</div>
                        </td>
                        {months.map((month) => {
                          const score = getScoreForMonth(experienceData, month);
                          const scoreValue = score === "N/A" ? 0 : parseFloat(score);
                          return (
                            <td key={month} className={`text-center py-1.5 sm:py-2 px-1 sm:px-2 ${
                              highlightedMonths.includes(month) ? "bg-blue-50" : ""
                            }`}>
                              <span 
                                onClick={() => score !== "N/A" && openModal(month, "experience")}
                                className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                                  score === "N/A"
                                    ? "bg-gray-200 text-gray-700" 
                                    : scoreValue >= 4 
                                      ? "bg-green-100 text-green-800 cursor-pointer hover:bg-green-200" 
                                      : "bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200"
                                }`}>
                                {score}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
              <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row gap-1.5 sm:gap-4 text-[10px] sm:text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-green-100 border border-green-200 rounded flex-shrink-0"></span>
                  <span>≥ 4.0 điểm</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-yellow-100 border border-yellow-200 rounded flex-shrink-0"></span>
                  <span>3.0 - 3.9 điểm</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-gray-200 border border-gray-300 rounded flex-shrink-0"></span>
                  <span>N/A (Chưa có dữ liệu)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Availability Performance Analysis - Show skeleton while loading */}
        {teacher && (
          <div className="border border-gray-900 rounded-lg overflow-hidden mt-3 sm:mt-4 animate-fadeIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                  <div>
                    <h3 className="text-base sm:text-lg font-bold">Phân tích hiệu suất làm việc</h3>
                    <p className="text-xs sm:text-sm opacity-90 mt-0.5">
                      Xu hướng đăng ký lịch rảnh theo khung giờ
                    </p>
                  </div>
                </div>
                
                {/* Period Filter */}
                <div className="flex gap-1 sm:gap-2">
                  {[
                    { value: 'week', label: 'Tuần' },
                    { value: 'month', label: 'Tháng' },
                    { value: 'year', label: 'Năm' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setAvailabilityPeriod(value as any)}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-medium transition-all ${
                        availabilityPeriod === value
                          ? 'bg-white text-blue-600 shadow-md'
                          : 'bg-white/20 hover:bg-white/30 text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-white space-y-4">
              {isLoadingAvailabilityData ? (
                /* Loading Skeleton */
                <>
                  {/* Summary Stats Skeleton */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="bg-gray-100 rounded-lg p-2 sm:p-3 animate-pulse">
                        <div className="h-6 sm:h-8 bg-gray-300 rounded mb-2"></div>
                        <div className="h-3 sm:h-4 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Heatmap Skeleton */}
                  <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                    <div className="h-4 bg-gray-300 rounded w-48 mb-3 animate-pulse"></div>
                    <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  
                  {/* Charts Skeleton */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                      <div className="h-4 bg-gray-300 rounded w-32 mb-3 animate-pulse"></div>
                      <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                      <div className="h-4 bg-gray-300 rounded w-32 mb-3 animate-pulse"></div>
                      <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-gray-500 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      Đang tải dữ liệu hiệu suất làm việc...
                    </div>
                  </div>
                </>
              ) : !availabilityStats || availabilityStats.totalSlots === 0 ? (
                /* No Data Message */
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Chưa có dữ liệu lịch rảnh trong khoảng thời gian này</p>
                </div>
              ) : (
                /* Actual Data */
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-lg p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-blue-600">{availabilityStats.totalSlots}</div>
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Tổng slots rảnh</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-white border border-green-200 rounded-lg p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-green-600">
                        {availabilityStats.DAYS.find(d => d.key === availabilityStats.mostAvailableDay)?.short || 'N/A'}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Ngày ưa thích</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-lg p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-purple-600">{availabilityStats.mostAvailableTime}</div>
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Khung giờ ưa thích</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-200 rounded-lg p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-orange-600">
                        {availabilityStats.totalRegistrations}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Lần đăng ký</div>
                    </div>
                  </div>

              {/* Heatmap - Availability Matrix */}
              <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Bản đồ nhiệt - Phân bố theo ngày & khung giờ
                </h4>
                
                <div className="overflow-x-auto">
                  <div className="min-w-[500px]">
                    {/* Header */}
                    <div className="grid grid-cols-8 gap-1 mb-1">
                      <div className="text-xs text-gray-600 font-medium"></div>
                      {availabilityStats.DAYS.map(day => (
                        <div key={day.key} className="text-xs text-gray-600 font-medium text-center">
                          {day.short}
                        </div>
                      ))}
                    </div>
                    
                    {/* Rows */}
                    {availabilityStats.TIME_SLOTS.map(slot => {
                      const maxCount = Math.max(
                        ...availabilityStats.DAYS.flatMap(d => {
                          const dayKey = d.key as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
                          return availabilityStats.TIME_SLOTS.map(s => {
                            const timeSlot = s as 'Sáng' | 'Chiều' | 'Tối';
                            return availabilityStats.availabilityMatrix[dayKey][timeSlot];
                          });
                        }),
                        1
                      );
                      
                      return (
                        <div key={slot} className="grid grid-cols-8 gap-1 mb-1">
                          <div className="text-xs text-gray-600 font-medium flex items-center">
                            {slot}
                          </div>
                          {availabilityStats.DAYS.map(day => {
                            const dayKey = day.key as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
                            const timeSlot = slot as 'Sáng' | 'Chiều' | 'Tối';
                            const count = availabilityStats.availabilityMatrix[dayKey][timeSlot];
                            const intensity = count / maxCount;
                            
                            let bgColor = 'bg-gray-100';
                            if (intensity > 0.75) bgColor = 'bg-blue-600';
                            else if (intensity > 0.5) bgColor = 'bg-blue-500';
                            else if (intensity > 0.25) bgColor = 'bg-blue-400';
                            else if (intensity > 0) bgColor = 'bg-blue-300';
                            
                            return (
                              <div 
                                key={`${day.key}-${slot}`}
                                className={`${bgColor} rounded p-2 text-center text-xs font-bold transition-all hover:scale-105 cursor-pointer relative group ${
                                  intensity > 0.5 ? 'text-white' : 'text-gray-900'
                                }`}
                              >
                                {count}
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                  {day.label} {slot}: {count} lần
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    
                    {/* Legend */}
                    <div className="mt-4 flex items-center gap-3 text-xs">
                      <span className="text-gray-600 font-medium">Cường độ:</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 bg-gray-100 rounded border border-gray-300"></div>
                          <span>0</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 bg-blue-300 rounded"></div>
                          <span>Ít</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 bg-blue-400 rounded"></div>
                          <span>TB</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 bg-blue-500 rounded"></div>
                          <span>Nhiều</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 bg-blue-600 rounded"></div>
                          <span>Rất nhiều</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bar Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* By Day */}
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white">
                  <h4 className="text-sm font-bold text-gray-900 mb-3">Phân bố theo ngày</h4>
                  <div className="flex items-end justify-between gap-2 h-48">
                    {availabilityStats.DAYS.map(day => {
                      const count = availabilityStats.dayCount[day.key] || 0;
                      const maxDay = Math.max(...availabilityStats.DAYS.map(d => availabilityStats.dayCount[d.key] || 0), 1);
                      const heightPercent = (count / maxDay) * 100;
                      const displayHeight = Math.max(heightPercent, 8);
                      
                      return (
                        <div key={day.key} className="flex-1 flex flex-col items-center gap-2 group">
                          <div className="relative w-full flex flex-col justify-end" style={{ height: '100%' }}>
                            <div 
                              className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-300 hover:from-blue-700 hover:to-blue-500 hover:scale-105 relative cursor-pointer shadow-md"
                              style={{ height: `${displayHeight}%`, minHeight: '20px' }}
                            >
                              {/* Count inside bar */}
                              {count > 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                                  {count}
                                </div>
                              )}
                              
                              {/* Tooltip */}
                              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                {day.label}: {count} lần
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-900 font-bold">{day.short}</div>
                            <div className="text-[10px] text-gray-500">{count}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* By Time Slot */}
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white">
                  <h4 className="text-sm font-bold text-gray-900 mb-3">Phân bố theo khung giờ</h4>
                  <div className="flex items-end justify-around gap-4 h-48">
                    {availabilityStats.TIME_SLOTS.map((slot, idx) => {
                      const count = availabilityStats.timeSlotCount[slot] || 0;
                      const maxSlot = Math.max(...availabilityStats.TIME_SLOTS.map(s => availabilityStats.timeSlotCount[s] || 0), 1);
                      const heightPercent = (count / maxSlot) * 100;
                      const displayHeight = Math.max(heightPercent, 8);
                      const colors = ['from-amber-500 to-amber-400', 'from-blue-500 to-blue-400', 'from-indigo-600 to-indigo-500'];
                      const textColors = ['text-amber-600', 'text-blue-600', 'text-indigo-600'];
                      
                      return (
                        <div key={slot} className="flex-1 flex flex-col items-center gap-2 max-w-32 group">
                          <div className="relative w-full flex flex-col justify-end" style={{ height: '100%' }}>
                            <div 
                              className={`w-full bg-gradient-to-t ${colors[idx]} rounded-t transition-all duration-300 hover:scale-105 relative cursor-pointer shadow-md`}
                              style={{ height: `${displayHeight}%`, minHeight: '20px' }}
                            >
                              {/* Count inside bar */}
                              {count > 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
                                  {count}
                                </div>
                              )}
                              
                              {/* Tooltip */}
                              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                {slot}: {count} lần
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className={`text-sm font-bold ${textColors[idx]}`}>{slot}</div>
                            <div className="text-[10px] text-gray-500">{count} lần</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Insights */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Nhận xét xu hướng
                </h4>
                <div className="space-y-1 text-xs sm:text-sm text-gray-700">
                  <p>• Giáo viên thường rảnh nhất vào <strong className="text-blue-700">
                    {availabilityStats.DAYS.find(d => d.key === availabilityStats.mostAvailableDay)?.label}
                  </strong></p>
                  <p>• Khung giờ ưa thích: <strong className="text-blue-700">{availabilityStats.mostAvailableTime}</strong></p>
                  <p>• Tổng cộng đã đăng ký <strong className="text-blue-700">{availabilityStats.totalSlots} slots</strong> trong {availabilityStats.totalRegistrations} lần đăng ký</p>
                  <p>• Trung bình: <strong className="text-blue-700">{(availabilityStats.totalSlots / availabilityStats.totalRegistrations).toFixed(1)} slots/lần</strong></p>
                </div>
              </div>
              </>
              )}
            </div>
          </div>
        )}

        {/* Modal - Chi tiết bài test */}
        {modalOpen && modalMonth && modalType && (
          <div 
            className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4"
            onClick={() => setModalOpen(false)}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full sm:max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`${modalType === "expertise" ? "bg-gradient-to-r from-blue-600 to-blue-800" : "bg-gradient-to-r from-purple-600 to-purple-800"} text-white px-3 sm:px-6 py-3 sm:py-5 flex items-center justify-between gap-2`}>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-xl font-bold truncate">
                    Test T{modalMonth}
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 sm:mt-2">
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold w-fit ${
                      modalType === "expertise" ? "bg-blue-500" : "bg-purple-500"
                    }`}>
                      {modalType === "expertise" ? "Chuyên môn" : "Kỹ năng"}
                    </span>
                    <p className={`text-xs sm:text-sm ${modalType === "expertise" ? "text-blue-100" : "text-purple-100"}`}>
                      <span className="font-semibold">{modalRecords.length}</span> bài • 
                      <span className="font-semibold"> {modalRecords.filter(r => r.isCountedInAverage).length}</span> tính điểm
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setModalOpen(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1.5 sm:p-2 transition-all flex-shrink-0"
                  title="Đóng"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(95vh-150px)] sm:max-h-[calc(90vh-220px)] bg-gray-50 overflow-x-auto">
                <table className="w-full text-xs sm:text-sm bg-white min-w-[600px]">
                  <thead className="bg-gradient-to-b from-gray-100 to-gray-50 border-b-2 border-gray-300 sticky top-0 z-10">
                    <tr>
                      <th className="text-left py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700 w-10 sm:w-16">STT</th>
                      <th className="text-left py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700">{modalType === "expertise" ? "Bộ môn" : "Khối"}</th>
                      {modalType === "expertise" && <th className="text-left py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700">Đề</th>}
                      <th className="text-center py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700 w-16 sm:w-24">Cđ</th>
                      <th className="text-center py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700 w-16 sm:w-24">Điểm</th>
                      <th className="text-left py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700">Email</th>
                      <th className="text-center py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700 w-20 sm:w-32">Tính</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRecords.map((record, index) => (
                      <tr key={index} className={`border-b border-gray-200 transition-colors ${
                        !record.isCountedInAverage ? "bg-red-50" : "hover:bg-blue-50"
                      }`}>
                        <td className="py-2 sm:py-4 px-2 sm:px-4 text-gray-500 font-medium text-center">{index + 1}</td>
                        <td className="py-2 sm:py-4 px-2 sm:px-4 font-semibold text-gray-900">{modalType === "expertise" ? record.subject : record.teachingLevel}</td>
                        {modalType === "expertise" && <td className="py-2 sm:py-4 px-2 sm:px-4 text-gray-600">{record.exam}</td>}
                        <td className="text-center py-2 sm:py-4 px-2 sm:px-4 font-medium text-gray-700">{record.correct}</td>
                        <td className="text-center py-2 sm:py-4 px-2 sm:px-4">
                          <span className={`inline-block px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold text-xs sm:text-base whitespace-nowrap ${
                            parseFloat(record.score.replace(",", ".")) >= 4 
                              ? "bg-green-100 text-green-700" 
                              : parseFloat(record.score.replace(",", ".")) >= 3 
                                ? "bg-yellow-100 text-yellow-700" 
                                : "bg-red-100 text-red-700"
                          }`}>
                            {record.score}
                          </span>
                        </td>
                        <td className="py-2 sm:py-4 px-2 sm:px-4">
                          {record.emailExplanation ? (
                            <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-orange-50 text-orange-700 rounded-md text-[10px] sm:text-xs font-medium truncate max-w-[150px] sm:max-w-full">
                              <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                              </svg>
                              <span className="truncate">{record.emailExplanation}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs sm:text-sm">-</span>
                          )}
                        </td>
                        <td className="text-center py-2 sm:py-4 px-2 sm:px-4">
                          {record.isCountedInAverage ? (
                            <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-3 py-1 sm:py-1.5 bg-green-100 text-green-800 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                              <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span className="hidden sm:inline">Tính</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-3 py-1 sm:py-1.5 bg-red-100 text-red-800 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                              <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              <span className="hidden sm:inline">Không</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-b from-gray-50 to-gray-100 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 text-[10px] sm:text-xs text-gray-600">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Tính:</strong> Đưa vào TB</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Không:</strong> Điểm 0 + email GT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
                    <span><strong>Nền đỏ:</strong> Bài test không được tính</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
