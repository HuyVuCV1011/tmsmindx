import { Search, RefreshCw } from 'lucide-react';
import { HrSource } from '../types';

interface HrCandidatesFilterProps {
  searchInput: string;
  setSearchInput: (val: string) => void;
  statusFilter: 'all' | 'assigned' | 'unassigned' | 'missing-sheet-gen' | 'manual-assigned';
  setStatusFilter: (val: 'all' | 'assigned' | 'unassigned' | 'missing-sheet-gen' | 'manual-assigned') => void;
  genFilter: string;
  setGenFilter: (val: string) => void;
  availableGens: string[];
  refreshing: boolean;
  onRefresh: () => void;
  
  // Extra columns logic
  selectedExtraColumns: string[];
  toggleExtraColumn: (col: string) => void;
  extraColumnOptions: string[];
  
  source: HrSource | null;
  topGenStats: [string, number][];
}

export default function HrCandidatesFilter({
  searchInput, setSearchInput,
  statusFilter, setStatusFilter,
  genFilter, setGenFilter,
  availableGens,
  refreshing, onRefresh,
  selectedExtraColumns, toggleExtraColumn, extraColumnOptions,
  source, topGenStats
}: HrCandidatesFilterProps) {
  
  return (
    <div className="border-b border-gray-200 bg-gray-50/30 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        
        {/* Vế Trái: Thanh tìm kiếm chiếm rộng */}
        <div className="relative flex-1 max-w-full lg:max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search className="h-4 w-4 text-gray-400 group-focus-within:text-[#a1001f] transition-colors" />
          </div>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo mã UV, tên, email, SĐT, gen..."
            className="block w-full rounded-xl border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm outline-none transition-all placeholder:text-gray-400 focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10"
          />
        </div>

        {/* Vế Phải: Các bộ lọc & nút hành động */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="cursor-pointer rounded-xl border-gray-300 py-2.5 pl-3.5 pr-8 text-sm font-medium text-gray-700 shadow-sm outline-none transition-all focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 hover:bg-gray-50"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="unassigned">Chỉ: Chưa có GEN</option>
            <option value="assigned">Chỉ: Đã có GEN</option>
            <option value="manual-assigned">Chỉ: Gán thủ công</option>
            <option value="missing-sheet-gen">Chỉ: Sheet bỏ trống</option>
          </select>

          <select
            value={genFilter}
            onChange={(e) => setGenFilter(e.target.value)}
            className="cursor-pointer rounded-xl border-gray-300 py-2.5 pl-3.5 pr-8 text-sm font-medium text-gray-700 shadow-sm outline-none transition-all focus:border-[#a1001f] focus:ring-4 focus:ring-[#a1001f]/10 hover:bg-gray-50"
            style={{ maxWidth: '160px' }}
          >
            <option value="all">Lọc theo bảng GEN</option>
            <option value="__unassigned__">-- Chưa có GEN --</option>
            {availableGens.map((gen) => (
              <option key={gen} value={gen}>{gen}</option>
            ))}
          </select>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Làm mới Sheet</span>
          </button>

          {/* Dropdown cột mở rộng (Popover pattern) */}
          <div className="relative group/columns z-20">
            <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
              Cột mở rộng
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
                {selectedExtraColumns.length}
              </span>
            </button>
            
            <div className="absolute right-0 top-full mt-2 hidden w-72 origin-top-right rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl group-hover/columns:block hover:block focus-within:block animate-in fade-in zoom-in-95 duration-200">
              <div className="mb-3 border-b border-gray-100 pb-3">
                <p className="text-sm font-bold text-gray-900">Tuỳ chỉnh cột hiển thị</p>
                <p className="text-xs text-gray-500 mt-1">Chọn tối đa 4 cột data thô từ sheet để hiển thị trực tiếp lên bảng.</p>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto pr-1 flex flex-col custom-scrollbar">
                {extraColumnOptions.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4 text-center bg-gray-50 rounded-lg">Không tìm thấy cột ngoài luồng.</p>
                ) : (
                  extraColumnOptions.map((header) => (
                    <label
                      key={header}
                      className="flex cursor-pointer items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-blue-50/50"
                    >
                      <div className="flex h-5 items-center mt-0.5">
                        <input
                          type="checkbox"
                          checked={selectedExtraColumns.includes(header)}
                          onChange={() => toggleExtraColumn(header)}
                          disabled={!selectedExtraColumns.includes(header) && selectedExtraColumns.length >= 4}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-600 disabled:opacity-50"
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 leading-snug">{header}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Nguồn Data Meta Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-blue-50/50 border border-blue-100/50 px-4 py-2.5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Nguồn Sheet: <span className="font-bold text-gray-700 normal-case">{source?.sheetId?.slice(0,8)}...</span></span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Tab GID: <span className="font-bold text-gray-700 normal-case">{source?.gid || 'N/A'}</span></span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Đồng bộ lúc: <span className="font-bold text-gray-700 normal-case">{source?.fetchedAt ? new Date(source.fetchedAt).toLocaleString('vi-VN') : 'N/A'}</span></span>
        </div>
        {topGenStats.length > 0 && (
          <div className="hidden md:flex gap-1.5">
            <span className="text-[11px] font-bold uppercase text-gray-400 mr-1 flex items-center">Top GEN:</span>
            {topGenStats.slice(0, 4).map(([gen, count]) => (
              <span key={gen} className="rounded-md bg-white border border-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-700 shadow-sm">
                {gen} <span className="text-gray-400 ml-0.5">{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
