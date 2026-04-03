import { MapPin, UserCheck, UserX, Users } from 'lucide-react';
import { HrSummary } from '../types';

interface HrCandidateStatsProps {
  summary: HrSummary;
  statusFilter: 'all' | 'assigned' | 'unassigned' | 'missing-sheet-gen' | 'manual-assigned';
  onFilterChange: (status: 'all' | 'assigned' | 'unassigned' | 'missing-sheet-gen' | 'manual-assigned') => void;
  regionFilter: 'all' | '1' | '2' | '3' | '4' | '5';
  onRegionFilterChange: (regionCode: 'all' | '1' | '2' | '3' | '4' | '5') => void;
}

export default function HrCandidateStats({ summary, statusFilter, onFilterChange, regionFilter, onRegionFilterChange }: HrCandidateStatsProps) {
  const regionCards: Array<{ code: '1' | '2' | '3' | '4' | '5'; label: string }> = [
    { code: '1', label: 'Hồ Chí Minh' },
    { code: '2', label: 'Hà Nội' },
    { code: '3', label: 'Tỉnh Nam' },
    { code: '4', label: 'Tỉnh Bắc' },
    { code: '5', label: 'Tỉnh Trung' },
  ];

  const totalRegionCandidates = regionCards.reduce((sum, region) => sum + (summary.byRegion?.[region.code] || 0), 0);
  const assignedPercent = summary.total > 0 ? Math.round((summary.assigned / summary.total) * 100) : 0;
  const topRegion = regionCards.reduce(
    (best, current) => {
      const count = summary.byRegion?.[current.code] || 0;
      return count > best.count ? { label: current.label, count } : best;
    },
    { label: 'Chưa xác định', count: 0 }
  );

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Tổng quan điều phối</p>
            <p className="mt-1 text-lg font-extrabold text-gray-900">Toàn cảnh phân GEN theo bộ lọc hiện tại</p>
            <p className="mt-1 text-xs text-gray-500">Ưu tiên xử lý nhóm chưa có GEN trước để tăng tốc độ phân phối.</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Tiến độ phân GEN</p>
            <p className="mt-1 text-xl font-black text-emerald-700">{assignedPercent}%</p>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-600 transition-all"
            style={{ width: `${assignedPercent}%` }}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="font-semibold text-gray-500">Ứng viên cần xử lý</p>
            <p className="mt-1 text-base font-extrabold text-red-700">{summary.unassigned}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="font-semibold text-gray-500">Khu vực có nhiều ứng viên nhất</p>
            <p className="mt-1 text-base font-extrabold text-gray-900">{topRegion.label}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
            <p className="font-semibold text-gray-500">Tổng ứng viên toàn hệ</p>
            <p className="mt-1 text-base font-extrabold text-gray-900">{summary.total}</p>
            <p className="mt-0.5 text-[11px] text-gray-500">Mapped khu vực: {totalRegionCandidates}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Card: Chưa xếp */}
        <button
          type="button"
          onClick={() => onFilterChange('unassigned')}
          className={`group relative overflow-hidden rounded-2xl text-left outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2 ${
            statusFilter === 'unassigned'
              ? 'ring-2 ring-red-500 shadow-md scale-[1.01]'
              : 'hover:scale-[1.01] hover:shadow-sm border border-gray-200 bg-white'
          }`}
        >
          <div className={`h-full p-5 ${statusFilter === 'unassigned' ? 'bg-linear-to-br from-red-50/80 to-white' : ''}`}>
            <div className="flex items-center justify-between z-10 relative">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-red-600 transition-colors">
                Chưa có GEN
              </p>
              <div className={`rounded-xl p-2 transition-colors ${statusFilter === 'unassigned' ? 'bg-red-100/80 text-red-600' : 'bg-gray-50 text-gray-400 group-hover:bg-red-50 group-hover:text-red-500'}`}>
                <UserX className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 relative z-10">
              <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{summary.unassigned}</p>
              <p className="mt-1 text-xs text-gray-500">Cần hành động ngay</p>
            </div>
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-red-200/20 blur-3xl transition-all duration-500 group-hover:bg-red-300/30" />
          </div>
        </button>

        {/* Card: Đã xếp */}
        <button
          type="button"
          onClick={() => onFilterChange('assigned')}
          className={`group relative overflow-hidden rounded-2xl text-left outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2 ${
            statusFilter === 'assigned'
              ? 'ring-2 ring-emerald-500 shadow-md scale-[1.01]'
              : 'hover:scale-[1.01] hover:shadow-sm border border-gray-200 bg-white'
          }`}
        >
          <div className={`h-full p-5 ${statusFilter === 'assigned' ? 'bg-linear-to-br from-emerald-50/80 to-white' : ''}`}>
            <div className="flex items-center justify-between z-10 relative">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-emerald-600 transition-colors">
                Đã có GEN
              </p>
              <div className={`rounded-xl p-2 transition-colors ${statusFilter === 'assigned' ? 'bg-emerald-100/80 text-emerald-600' : 'bg-gray-50 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500'}`}>
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 relative z-10">
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{summary.assigned}</p>
                {summary.total > 0 && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    {Math.round((summary.assigned / summary.total) * 100)}%
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">Đã phân phối gen</p>
            </div>
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-200/20 blur-3xl transition-all duration-500 group-hover:bg-emerald-300/30" />
          </div>
        </button>

        {/* Card: Tổng số */}
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={`group relative overflow-hidden rounded-2xl text-left outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2 ${
            statusFilter === 'all'
              ? 'ring-2 ring-blue-500 shadow-md scale-[1.01]'
              : 'hover:scale-[1.01] hover:shadow-sm border border-gray-200 bg-white'
          }`}
        >
          <div className={`h-full p-5 ${statusFilter === 'all' ? 'bg-linear-to-br from-blue-50/80 to-white' : ''}`}>
            <div className="flex items-center justify-between z-10 relative">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-blue-600 transition-colors">
                Tổng ứng viên
              </p>
              <div className={`rounded-xl p-2 transition-colors ${statusFilter === 'all' ? 'bg-blue-100/80 text-blue-600' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 relative z-10">
              <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{summary.total}</p>
              <p className="mt-1 text-xs text-gray-500">Toàn bộ dữ liệu sheet</p>
            </div>
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-200/20 blur-3xl transition-all duration-500 group-hover:bg-blue-300/30" />
          </div>
        </button>

      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-gray-900">Thống kê ứng viên theo mã khu vực</p>
              <p className="text-xs text-gray-500">Mã 1-5 theo quy ước vận hành tuyển dụng</p>
            </div>
          </div>
          <span className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 border border-gray-200">
            Tổng mapped: {totalRegionCandidates}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {regionCards.map((region) => (
            <button
              type="button"
              key={region.code}
              onClick={() => onRegionFilterChange(regionFilter === region.code ? 'all' : region.code)}
              className={`cursor-pointer rounded-xl px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                regionFilter === region.code
                  ? 'border-2 border-indigo-500 bg-linear-to-br from-indigo-50 to-white shadow-sm'
                  : 'border border-gray-200 bg-linear-to-br from-gray-50 to-white hover:border-indigo-300 hover:shadow-sm hover:-translate-y-0.5'
              }`}
              aria-label={`Lọc ứng viên khu vực ${region.label} (mã ${region.code})`}
            >
              <p className={`text-[11px] font-bold uppercase tracking-wider ${regionFilter === region.code ? 'text-indigo-700' : 'text-gray-500'}`}>Mã khu vực {region.code}</p>
              <p className={`mt-1 text-sm font-semibold ${regionFilter === region.code ? 'text-indigo-900' : 'text-gray-700'}`}>{region.label}</p>
              <p className={`mt-2 text-2xl font-extrabold tracking-tight ${regionFilter === region.code ? 'text-indigo-900' : 'text-gray-900'}`}>
                {summary.byRegion?.[region.code] || 0}
              </p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
