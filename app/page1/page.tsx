"use client";

import { Briefcase, Calendar, Mail, MapPin, Search, User, UserCheck } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

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

// Fetcher function with caching
const fetcher = async (url: string) => {
  const res = await fetch(url, { 
    next: { revalidate: 60 }, // Cache 60s
    headers: { 'Accept-Encoding': 'gzip, deflate' }
  });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export default function Page1() {
  const [searchCode, setSearchCode] = useState("");
  const [submitCode, setSubmitCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("12");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedTableYear, setSelectedTableYear] = useState("2025");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMonth, setModalMonth] = useState<string | null>(null);
  const [modalType, setModalType] = useState<"expertise" | "experience" | null>(null);
  const [modalRecords, setModalRecords] = useState<TestRecord[]>([]);

  // SWR với auto caching và revalidation
  const { data: teacherData } = useSWR(
    submitCode ? `/api/teachers?code=${submitCode}` : null,
    fetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 60000 // Dedupe requests trong 60s
    }
  );

  const { data: expertiseDataRes } = useSWR(
    submitCode ? `/api/rawdata?code=${submitCode}` : null,
    fetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 60000
    }
  );

  const { data: experienceDataRes } = useSWR(
    submitCode ? `/api/rawdata-experience?code=${submitCode}` : null,
    fetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 60000
    }
  );

  const teacher = teacherData?.teacher || null;
  const expertiseData = expertiseDataRes?.monthlyData || [];
  const experienceData = experienceDataRes?.monthlyData || [];

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

  // Debounce search để giảm số lần fetch
  useEffect(() => {
    if (teacherData && teacherData.error) {
      setError(teacherData.error);
    } else if (teacherData) {
      setError("");
    }
  }, [teacherData]);

  const handleSearch = useCallback(() => {
    if (!searchCode.trim()) {
      setError("Vui lòng nhập mã giáo viên");
      return;
    }
    setError("");
    setSubmitCode(searchCode.trim());
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-4">
        {/* Header */}
        <div className="border-b border-gray-900 pb-3">
          <h1 className="text-2xl font-bold text-gray-900">Tìm kiếm giáo viên</h1>
          <p className="text-xs text-gray-600 mt-1">Nhập mã giáo viên để xem thông tin chi tiết</p>
        </div>

        {/* Search Box */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Nhập mã giáo viên (ví dụ: datpt1, tramhlb)"
              className="w-full px-3 py-2 text-sm border border-gray-900 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            {loading ? "Tìm kiếm..." : "Tìm"}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Loading Modal */}
        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-lg p-6 shadow-2xl border-2 border-gray-900 pointer-events-auto">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-gray-200"></div>
                  <div className="absolute top-0 h-16 w-16 animate-spin rounded-full border-4 border-gray-900 border-t-transparent"></div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-gray-900">Đang tìm kiếm...</h3>
                  <p className="text-sm text-gray-600 mt-1">Vui lòng chờ trong giây lát</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Teacher Info */}
        {teacher && (
          <div className="border border-gray-900 rounded-lg overflow-hidden">
            {/* Header Card */}
            <div className="bg-gray-900 text-white p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white text-gray-900 flex items-center justify-center font-bold text-lg">
                  {teacher.name.split(" ").pop()?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{teacher.name}</h2>
                  <p className="text-xs opacity-90">{teacher.code}</p>
                </div>
                <div className="ml-auto">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
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
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

        {/* Score Summary */}
        {teacher && (expertiseData.length > 0 || experienceData.length > 0) && (
          <div className="border border-gray-900 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
        {teacher && (expertiseData.length > 0 || experienceData.length > 0) && (
          <div className="border border-gray-900 rounded-lg overflow-hidden mt-4">
            <div className="bg-gray-900 text-white p-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Các chỉ số theo tháng</h3>
              <div className="flex items-center gap-2">
                <label className="text-xs">Năm:</label>
                <select
                  value={selectedTableYear}
                  onChange={(e) => setSelectedTableYear(e.target.value)}
                  className="px-2 py-1 text-xs bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
            </div>
            <div className="p-4 overflow-x-auto">
              {(() => {
                const months = Array.from({ length: 12 }, (_, i) => `${i + 1}/${selectedTableYear}`);

                return (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-900">
                        <th className="text-left py-2 px-2 font-bold text-gray-900 min-w-37.5">Chỉ tiêu</th>
                        {months.map((month) => (
                          <th key={month} className={`text-center py-2 px-2 min-w-17.5 ${
                            highlightedMonths.includes(month) ? "bg-blue-50" : ""
                          }`}>
                            <div className="font-medium text-gray-700">{month}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-2 px-2">
                          <div className="font-medium text-gray-900">Điểm đánh giá Chuyên môn Chuyên sâu</div>
                        </td>
                        {months.map((month) => {
                          const score = getScoreForMonth(expertiseData, month);
                          const scoreValue = score === "N/A" ? 0 : parseFloat(score);
                          return (
                            <td key={month} className={`text-center py-2 px-2 ${
                              highlightedMonths.includes(month) ? "bg-blue-50" : ""
                            }`}>
                              <span 
                                onClick={() => score !== "N/A" && openModal(month, "expertise")}
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
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
                        <td className="py-2 px-2">
                          <div className="font-medium text-gray-900">Điểm đánh giá Kỹ năng - Quy trình trải nghiệm</div>
                        </td>
                        {months.map((month) => {
                          const score = getScoreForMonth(experienceData, month);
                          const scoreValue = score === "N/A" ? 0 : parseFloat(score);
                          return (
                            <td key={month} className={`text-center py-2 px-2 ${
                              highlightedMonths.includes(month) ? "bg-blue-50" : ""
                            }`}>
                              <span 
                                onClick={() => score !== "N/A" && openModal(month, "experience")}
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
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
              <div className="mt-3 flex gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-4 h-4 bg-green-100 border border-green-200 rounded"></span>
                  <span>≥ 4.0 điểm</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></span>
                  <span>3.0 - 3.9 điểm</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-4 h-4 bg-gray-200 border border-gray-300 rounded"></span>
                  <span>N/A (Chưa có dữ liệu)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal - Chi tiết bài test */}
        {modalOpen && modalMonth && modalType && (
          <div 
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={() => setModalOpen(false)}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`${modalType === "expertise" ? "bg-gradient-to-r from-blue-600 to-blue-800" : "bg-gradient-to-r from-purple-600 to-purple-800"} text-white px-6 py-5 flex items-center justify-between`}>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">
                    Chi tiết bài test tháng {modalMonth}
                  </h3>
                  <div className="flex items-center gap-4 mt-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      modalType === "expertise" ? "bg-blue-500" : "bg-purple-500"
                    }`}>
                      {modalType === "expertise" ? "Chuyên môn Chuyên sâu" : "Kỹ năng & Trải nghiệm"}
                    </span>
                    <p className={`text-sm ${modalType === "expertise" ? "text-blue-100" : "text-purple-100"}`}>
                      <span className="font-semibold">{modalRecords.length}</span> bài test • 
                      <span className="font-semibold"> {modalRecords.filter(r => r.isCountedInAverage).length}</span> được tính điểm
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setModalOpen(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all ml-4"
                  title="Đóng"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-220px)] bg-gray-50">
                <table className="w-full text-sm bg-white">
                  <thead className="bg-gradient-to-b from-gray-100 to-gray-50 border-b-2 border-gray-300 sticky top-0 z-10">
                    <tr>
                      <th className="text-left py-4 px-4 font-bold text-gray-700 w-16">STT</th>
                      <th className="text-left py-4 px-4 font-bold text-gray-700">{modalType === "expertise" ? "Bộ môn" : "Khối giảng dạy"}</th>
                      {modalType === "expertise" && <th className="text-left py-4 px-4 font-bold text-gray-700">Đề thi</th>}
                      <th className="text-center py-4 px-4 font-bold text-gray-700 w-24">Câu đúng</th>
                      <th className="text-center py-4 px-4 font-bold text-gray-700 w-24">Điểm</th>
                      <th className="text-left py-4 px-4 font-bold text-gray-700">Email giải trình</th>
                      <th className="text-center py-4 px-4 font-bold text-gray-700 w-32">Tính điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRecords.map((record, index) => (
                      <tr key={index} className={`border-b border-gray-200 transition-colors ${
                        !record.isCountedInAverage ? "bg-red-50" : "hover:bg-blue-50"
                      }`}>
                        <td className="py-4 px-4 text-gray-500 font-medium text-center">{index + 1}</td>
                        <td className="py-4 px-4 font-semibold text-gray-900">{modalType === "expertise" ? record.subject : record.teachingLevel}</td>
                        {modalType === "expertise" && <td className="py-4 px-4 text-gray-600">{record.exam}</td>}
                        <td className="text-center py-4 px-4 font-medium text-gray-700">{record.correct}</td>
                        <td className="text-center py-4 px-4">
                          <span className={`inline-block px-3 py-1.5 rounded-lg font-bold text-base ${
                            parseFloat(record.score.replace(",", ".")) >= 4 
                              ? "bg-green-100 text-green-700" 
                              : parseFloat(record.score.replace(",", ".")) >= 3 
                                ? "bg-yellow-100 text-yellow-700" 
                                : "bg-red-100 text-red-700"
                          }`}>
                            {record.score}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {record.emailExplanation ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-md text-xs font-medium">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                              </svg>
                              {record.emailExplanation}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="text-center py-4 px-4">
                          {record.isCountedInAverage ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs font-semibold">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Tính
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-800 rounded-lg text-xs font-semibold">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              Không tính
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 bg-gradient-to-b from-gray-50 to-gray-100 border-t border-gray-200">
                <div className="flex items-start gap-6 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Tính điểm:</strong> Bài test được đưa vào tính trung bình</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Không tính:</strong> Điểm 0 + đã email giải trình</span>
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
