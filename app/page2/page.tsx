"use client";

import { Calendar, Filter, User, X } from "lucide-react";
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

interface AvailabilityCount {
  count: number;
  teachers: TeacherAvailability[];
}

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type TimeSlot = 'Sáng' | 'Chiều' | 'Tối';

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'monday', label: 'Thứ 2', short: 'T2' },
  { key: 'tuesday', label: 'Thứ 3', short: 'T3' },
  { key: 'wednesday', label: 'Thứ 4', short: 'T4' },
  { key: 'thursday', label: 'Thứ 5', short: 'T5' },
  { key: 'friday', label: 'Thứ 6', short: 'T6' },
  { key: 'saturday', label: 'Thứ 7', short: 'T7' },
  { key: 'sunday', label: 'Chủ nhật', short: 'CN' },
];

const TIME_SLOTS: TimeSlot[] = ['Sáng', 'Chiều', 'Tối'];

const PROGRAMS = ['Tất cả', 'Coding', 'Robotics', 'Art'];

const REGIONS = {
  'Tất cả': [],
  'HCM01': ['1. Phan Văn Trị', '2. Quang Trung', '3. Tô Ký', '4. Phan Xích Long'],
  'HCM04': ['5.Trường Chinh', '6. Tây Thạnh', '7. Lũy Bán Bích', '8. Tên Lửa'],
};

const REGION_OPTIONS = ['Tất cả', 'HCM01', 'HCM04'];

// Fetcher với cache
const fetcher = async (url: string) => {
  const res = await fetch(url, {
    next: { revalidate: 60 },
    headers: { 'Accept-Encoding': 'gzip, deflate' }
  });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

// Memoized cell component
const CalendarCell = memo(({ 
  count, 
  teachers, 
  day, 
  timeSlot, 
  onTeacherClick 
}: { 
  count: number; 
  teachers: TeacherAvailability[]; 
  day: string; 
  timeSlot: TimeSlot;
  onTeacherClick: (teacher: TeacherAvailability, day: string, timeSlot: TimeSlot) => void;
}) => {
  const bgColor = count === 0 ? 'bg-gray-100' : 
                  count <= 2 ? 'bg-yellow-50' :
                  count <= 5 ? 'bg-green-50' :
                  'bg-blue-50';

  return (
    <td className={`border border-gray-300 p-1.5 sm:p-2 align-top ${bgColor}`}>
      {count === 0 ? (
        <div className="text-center text-gray-400 text-[10px] sm:text-xs py-1 sm:py-2">Không có</div>
      ) : (
        <div className="space-y-0.5 sm:space-y-1">
          <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-1 sm:mb-2">
            {count} GV
          </div>
          {teachers.map((teacher, idx) => (
            <button
              key={`${teacher.email}-${idx}`}
              onClick={() => onTeacherClick(teacher, day, timeSlot)}
              className="w-full text-left px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-white hover:bg-blue-100 border border-gray-200 rounded transition-colors duration-150 hover:shadow-sm"
            >
              <div className="font-medium text-gray-900 truncate">{teacher.name}</div>
              <div className="text-gray-600 text-[9px] sm:text-[10px] truncate">{teacher.mainBranch}</div>
            </button>
          ))}
        </div>
      )}
    </td>
  );
});
CalendarCell.displayName = 'CalendarCell';

export default function Page2() {
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('Tất cả');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    teacher: TeacherAvailability;
    day: string;
    timeSlot: TimeSlot;
  } | null>(null);

  // Date range state - mặc định 10 ngày gần nhất
  const today = useMemo(() => new Date(), []);
  const defaultFromDate = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 10);
    return date.toISOString().split('T')[0];
  }, [today]);
  const defaultToDate = useMemo(() => today.toISOString().split('T')[0], [today]);
  
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);

  // Build API URL với date params
  const apiUrl = useMemo(() => {
    return `/api/availability?fromDate=${fromDate}&toDate=${toDate}`;
  }, [fromDate, toDate]);

  // Fetch data với SWR
  const { data, error, isLoading } = useSWR<{ 
    teachers: TeacherAvailability[]; 
    totalRecords: number;
    fromDate: string;
    toDate: string;
  }>(
    apiUrl,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const teachers = data?.teachers || [];

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [modalOpen]);

  // Filter teachers theo program và region
  const filteredTeachers = useMemo(() => {
    let filtered = teachers;
    
    // Filter by program - if any programs selected
    if (selectedPrograms.length > 0) {
      filtered = filtered.filter(t => 
        selectedPrograms.some(program => 
          t.mainSubject.includes(program) || t.subjects.includes(program)
        )
      );
    }
    
    // Filter by region
    if (selectedRegion !== 'Tất cả') {
      const regionBranches = REGIONS[selectedRegion as keyof typeof REGIONS];
      filtered = filtered.filter(t => {
        // Check if teacher's main branch or any available branch is in the region
        const branches = [t.mainBranch, ...t.branches.split(',').map(b => b.trim())];
        return branches.some(branch => 
          regionBranches.some(rb => branch.includes(rb) || rb.includes(branch))
        );
      });
    }
    
    return filtered;
  }, [teachers, selectedPrograms, selectedRegion]);

  // Calculate availability counts
  const availabilityMatrix = useMemo(() => {
    const matrix: Record<DayKey, Record<TimeSlot, AvailabilityCount>> = {
      monday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      tuesday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      wednesday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      thursday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      friday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      saturday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      sunday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
    };

    filteredTeachers.forEach(teacher => {
      DAYS.forEach(({ key }) => {
        const availability = teacher[key];
        if (!availability || availability === 'Bận') return;

        TIME_SLOTS.forEach(slot => {
          if (availability.includes(slot)) {
            matrix[key][slot].count++;
            matrix[key][slot].teachers.push(teacher);
          }
        });
      });
    });

    return matrix;
  }, [filteredTeachers]);

  const handleTeacherClick = useCallback((teacher: TeacherAvailability, day: string, timeSlot: TimeSlot) => {
    setModalData({ teacher, day, timeSlot });
    setModalOpen(true);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg font-medium">Lỗi tải dữ liệu</p>
          <p className="text-gray-600 mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Lịch Rảnh Giáo Viên</h1>
        </div>
        <p className="text-sm sm:text-base text-gray-600">Xem số lượng giáo viên rảnh theo khung giờ và chương trình</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <span className="text-sm sm:text-base text-gray-700 font-medium">Khoảng thời gian:</span>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <label className="text-sm text-gray-600">Từ ngày:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate}
              className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <label className="text-sm text-gray-600">Đến ngày:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate}
              className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => {
              const newToDate = new Date().toISOString().split('T')[0];
              const newFromDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              setFromDate(newFromDate);
              setToDate(newToDate);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            10 ngày gần nhất
          </button>
        </div>
      </div>

      {/* Region and Program Filters */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4 sm:mb-6">
        {/* Region Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-sm sm:text-base text-gray-700 font-medium">Khu vực:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {REGION_OPTIONS.map(region => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedRegion === region
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
          {selectedRegion !== 'Tất cả' && (
            <div className="text-xs text-gray-600 bg-purple-50 px-3 py-1 rounded-full">
              {REGIONS[selectedRegion as keyof typeof REGIONS].join(', ')}
            </div>
          )}
        </div>
        
        {/* Program Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-3 sm:pt-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-sm sm:text-base text-gray-700 font-medium">Chương trình:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROGRAMS.map(program => {
              const isSelected = selectedPrograms.includes(program);
              return (
                <button
                  key={program}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedPrograms(selectedPrograms.filter(p => p !== program));
                    } else {
                      setSelectedPrograms([...selectedPrograms, program]);
                    }
                  }}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {program}
                </button>
              );
            })}
            {selectedPrograms.length > 0 && (
              <button
                onClick={() => setSelectedPrograms([])}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
          <div className="w-full sm:w-auto text-sm text-gray-600 sm:ml-auto">
            Tổng: <span className="font-bold text-gray-900">{filteredTeachers.length}</span> giáo viên
            {selectedPrograms.length > 0 && (
              <span className="text-blue-600 ml-2 block sm:inline">({selectedPrograms.join(', ')})</span>
            )}
          </div>
        </div>
      </div>

      {/* Calendar */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm sm:text-base">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
                  <th className="border border-blue-700 p-2 sm:p-3 text-left sticky left-0 bg-blue-700 z-10 text-xs sm:text-sm">
                    Khung giờ
                  </th>
                  {DAYS.map(day => (
                    <th key={day.key} className="border border-blue-700 p-2 sm:p-3 text-center min-w-24 sm:min-w-32">
                      <div className="font-bold text-xs sm:text-sm">{day.label}</div>
                      <div className="text-[10px] sm:text-xs font-normal opacity-90">({day.short})</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(slot => (
                  <tr key={slot}>
                    <td className="border border-gray-300 p-2 sm:p-3 font-semibold bg-gray-50 sticky left-0 z-10 text-xs sm:text-sm">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-600"></div>
                        <span className="whitespace-nowrap">{slot}</span>
                      </div>
                    </td>
                    {DAYS.map(day => (
                      <CalendarCell
                        key={`${day.key}-${slot}`}
                        count={availabilityMatrix[day.key][slot].count}
                        teachers={availabilityMatrix[day.key][slot].teachers}
                        day={day.label}
                        timeSlot={slot}
                        onTeacherClick={handleTeacherClick}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow-md p-3 sm:p-4">
        <h3 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Chú thích màu sắc:</h3>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 border border-gray-300 rounded flex-shrink-0"></div>
            <span className="text-xs sm:text-sm text-gray-700">Không có GV</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-100 border border-gray-300 rounded flex-shrink-0"></div>
            <span className="text-xs sm:text-sm text-gray-700">1-2 GV</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 border border-gray-300 rounded flex-shrink-0"></div>
            <span className="text-xs sm:text-sm text-gray-700">3-5 GV</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 border border-gray-300 rounded flex-shrink-0"></div>
            <span className="text-xs sm:text-sm text-gray-700">6+ GV</span>
          </div>
        </div>
      </div>

      {/* Modal - Teacher Detail */}
      {modalOpen && modalData && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-3 sm:px-6 py-3 sm:py-5 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <User className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-base sm:text-xl font-bold truncate">{modalData.teacher.name}</h3>
                  <p className="text-xs sm:text-sm opacity-90 truncate">
                    {modalData.day} - {modalData.timeSlot}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 sm:p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-auto max-h-[calc(95vh-100px)] sm:max-h-[calc(90vh-140px)] p-3 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {/* Basic Info */}
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Thông tin cơ bản</h4>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium text-gray-900 text-right truncate">{modalData.teacher.email}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-600 flex-shrink-0">Chi nhánh chính:</span>
                      <span className="font-medium text-gray-900 text-right">{modalData.teacher.mainBranch}</span>
                    </div>
                    {modalData.teacher.branches && modalData.teacher.branches !== modalData.teacher.mainBranch && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600 flex-shrink-0">Có thể làm việc:</span>
                        <span className="font-medium text-gray-900 text-right">{modalData.teacher.branches}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subjects */}
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Môn dạy</h4>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {modalData.teacher.subjects.split(',').map((subject, idx) => (
                      <span
                        key={idx}
                        className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-medium"
                      >
                        {subject.trim()}
                      </span>
                    ))}
                  </div>
                  {modalData.teacher.mainSubject && (
                    <div className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-gray-600">
                      Môn chính: <span className="font-semibold text-gray-900">{modalData.teacher.mainSubject}</span>
                    </div>
                  )}
                </div>

                {/* Weekly Schedule */}
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Lịch rảnh trong tuần</h4>
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {DAYS.map(day => {
                      const availability = modalData.teacher[day.key];
                      const isBusy = !availability || availability === 'Bận';
                      return (
                        <div key={day.key} className="text-center">
                          <div className="text-[10px] sm:text-xs font-semibold text-gray-700 mb-0.5 sm:mb-1">{day.short}</div>
                          <div className={`text-[9px] sm:text-[10px] p-0.5 sm:p-1 rounded leading-tight ${isBusy ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-800'}`}>
                            {isBusy ? 'Bận' : availability}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                {modalData.teacher.notes && (
                  <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-yellow-50">
                    <h4 className="font-semibold text-gray-900 mb-1.5 sm:mb-2 text-sm sm:text-base">Ghi chú</h4>
                    <p className="text-xs sm:text-sm text-gray-700 italic">{modalData.teacher.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-b from-gray-50 to-gray-100 border-t border-gray-200">
              <button
                onClick={() => setModalOpen(false)}
                className="w-full py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base font-medium rounded-lg transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
