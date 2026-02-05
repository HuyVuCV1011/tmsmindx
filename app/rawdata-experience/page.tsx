"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface TestRecord {
  area: string;
  name: string;
  email: string;
  branch: string;
  code: string;
  type: string;
  teachingLevel: string;
  month: string;
  year: string;
  batch: string;
  time: string;
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

function RawDataExperienceContent() {
  const searchParams = useSearchParams();
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyAverage[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [teacherCode, setTeacherCode] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthlyAverage | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setSearchCode(code);
      handleSearch(code);
    }
  }, [searchParams]);

  const handleSearch = async (code?: string) => {
    const codeToSearch = code || searchCode;
    if (!codeToSearch.trim()) {
      setError("Vui lòng nhập mã giáo viên");
      return;
    }

    setLoading(true);
    setError("");
    setRecords([]);
    setMonthlyData([]);

    try {
      const response = await fetch(`/api/rawdata-experience?code=${codeToSearch}`);
      const data = await response.json();

      if (response.ok) {
        setRecords(data.records || []);
        setMonthlyData(data.monthlyData || []);
        setTotalRecords(data.totalRecords || 0);
        setTeacherCode(data.teacherCode || codeToSearch);
      } else {
        setError(data.error || "Không tìm thấy dữ liệu");
      }
    } catch (err) {
      setError("Đã xảy ra lỗi khi tìm kiếm");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (monthData: MonthlyAverage) => {
    setSelectedMonth(monthData);
    setModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="space-y-4">
        <div className="border-b border-gray-900 pb-3">
          <h1 className="text-2xl font-bold text-gray-900">Raw Data - Kỹ năng & Quy trình trải nghiệm</h1>
          <p className="text-xs text-gray-600 mt-1">Xem chi tiết điểm test trải nghiệm theo tháng</p>
        </div>

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
            onClick={() => handleSearch()}
            disabled={loading}
            className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? "Đang tìm..." : "Tìm kiếm"}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="text-gray-600">Đang tải dữ liệu...</div>
          </div>
        )}

        {!loading && teacherCode && (
          <>
            <div className="border border-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Giáo viên: {teacherCode}</h2>
                  <p className="text-sm text-gray-600 mt-1">Tổng số bài test: {totalRecords}</p>
                </div>
              </div>
            </div>

            {monthlyData.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">Tổng hợp theo tháng</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {monthlyData.map((monthData) => (
                    <div
                      key={monthData.month}
                      onClick={() => openModal(monthData)}
                      className="border border-gray-300 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer hover:border-gray-900"
                    >
                      <div className="text-sm font-medium text-gray-600 mb-2">
                        Tháng {monthData.month}
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mb-2">
                        {monthData.average.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {monthData.count} bài test
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {records.length > 0 && (
              <div className="border border-gray-900 rounded-lg overflow-hidden">
                <div className="bg-gray-900 text-white p-3">
                  <h3 className="text-sm font-bold">Chi tiết tất cả bài test</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                      <tr>
                        <th className="text-left py-3 px-3 font-bold">STT</th>
                        <th className="text-left py-3 px-3 font-bold">Tháng/Năm</th>
                        <th className="text-left py-3 px-3 font-bold">Khối giảng dạy</th>
                        <th className="text-center py-3 px-3 font-bold">Câu đúng</th>
                        <th className="text-center py-3 px-3 font-bold">Điểm</th>
                        <th className="text-left py-3 px-3 font-bold">Email giải trình</th>
                        <th className="text-center py-3 px-3 font-bold">Tính điểm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, index) => (
                        <tr
                          key={index}
                          className={`border-b border-gray-200 ${
                            !record.isCountedInAverage ? "bg-red-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="py-3 px-3 text-gray-500 font-medium">{index + 1}</td>
                          <td className="py-3 px-3 font-medium">{record.date}</td>
                          <td className="py-3 px-3 font-medium">{record.teachingLevel}</td>
                          <td className="text-center py-3 px-3">{record.correct}</td>
                          <td className="text-center py-3 px-3">
                            <span
                              className={`font-bold text-base ${
                                parseFloat(record.score.replace(",", ".")) >= 4
                                  ? "text-green-600"
                                  : parseFloat(record.score.replace(",", ".")) >= 3
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {record.score}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {record.emailExplanation ? (
                              <span className="text-orange-600 font-medium">
                                {record.emailExplanation}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="text-center py-3 px-3">
                            {record.isCountedInAverage ? (
                              <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                ✓ Tính
                              </span>
                            ) : (
                              <span className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                ✗ Không tính
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {modalOpen && selectedMonth && (
          <div
            className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border-2 border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-linear-to-r from-purple-600 to-purple-700 text-white p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    Chi tiết tháng {selectedMonth.month} - Trải nghiệm
                  </h3>
                  <p className="text-xs text-purple-100 mt-1">
                    Điểm trung bình: {selectedMonth.average.toFixed(1)} | Tổng {selectedMonth.count} bài test
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-180px)] bg-white">
                <table className="w-full text-xs bg-white">
                  <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                    <tr>
                      <th className="text-left py-3 px-3 font-bold">STT</th>
                      <th className="text-left py-3 px-3 font-bold">Khối giảng dạy</th>
                      <th className="text-center py-3 px-3 font-bold">Câu đúng</th>
                      <th className="text-center py-3 px-3 font-bold">Điểm</th>
                      <th className="text-left py-3 px-3 font-bold">Email giải trình</th>
                      <th className="text-center py-3 px-3 font-bold">Tính điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMonth.records.map((record, index) => (
                      <tr
                        key={index}
                        className={`border-b border-gray-200 ${
                          !record.isCountedInAverage ? "bg-red-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="py-3 px-3 text-gray-500 font-medium">{index + 1}</td>
                        <td className="py-3 px-3 font-medium">{record.teachingLevel}</td>
                        <td className="text-center py-3 px-3">{record.correct}</td>
                        <td className="text-center py-3 px-3">
                          <span
                            className={`font-bold text-base ${
                              parseFloat(record.score.replace(",", ".")) >= 4
                                ? "text-green-600"
                                : parseFloat(record.score.replace(",", ".")) >= 3
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {record.score}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {record.emailExplanation ? (
                            <span className="text-orange-600 font-medium">
                              {record.emailExplanation}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="text-center py-3 px-3">
                          {record.isCountedInAverage ? (
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                              ✓ Tính
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                              ✗ Không tính
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 space-y-1">
                <div>• <strong>Tính điểm:</strong> Các bài test được đưa vào tính trung bình</div>
                <div>• <strong>Không tính:</strong> Bài test điểm 0 + đã email giải trình</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RawDataExperiencePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header Skeleton */}
          <div className="space-y-3 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-96"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </div>
          {/* Search Bar Skeleton */}
          <div className="flex gap-2">
            <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-24 h-10 bg-gray-200 rounded animate-pulse"></div>
          </div>
          {/* Results Skeleton */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    }>
      <RawDataExperienceContent />
    </Suspense>
  );
}
