import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search } from 'lucide-react';
import HrCandidateRow from './HrCandidateRow';
import { HrCandidateRow as HrCandidateRowType, HrPagination } from '../types';

interface HrCandidatesTableProps {
  rows: HrCandidateRowType[];
  loading: boolean;
  page: number;
  pageSize: number;
  pagination: HrPagination;
  selectedExtraColumns: string[];

  onOpenDetails: (candidate: HrCandidateRowType) => void;
  onPageChange: (newPage: number) => void;
  onClearFilters: () => void;

  selectedKeys: Set<string>;
  onToggleSelect: (candidateKey: string) => void;
  onToggleSelectAll: () => void;
}

export default function HrCandidatesTable({
  rows, loading, page, pageSize, pagination,
  selectedExtraColumns, onOpenDetails, onPageChange, onClearFilters,
  selectedKeys, onToggleSelect, onToggleSelectAll
}: HrCandidatesTableProps) {
  
  const allSelected = rows.length > 0 && selectedKeys.size === rows.length;

  return (
    <div className="relative min-h-[400px]">
      {loading ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-[#a1001f] mb-4" />
          <p className="text-sm font-semibold text-gray-600 animate-pulse">Đang tải và đồng bộ danh sách ứng viên...</p>
        </div>
      ) : null}

      <div className="overflow-x-auto overflow-y-visible">
        <Table className="w-full text-left text-sm">
          <TableHeader className="bg-gray-50 border-b border-gray-200">
            <TableRow className="hover:bg-gray-50">
              <TableHead className="w-12 py-3.5 pl-4 px-2 whitespace-nowrap">
                <input 
                  type="checkbox" 
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                  disabled={rows.length === 0}
                />
              </TableHead>
              <TableHead className="w-14 py-3.5 px-2 text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">STT</TableHead>
              <TableHead className="min-w-28 py-3.5 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">Mã UV</TableHead>
              <TableHead className="min-w-[280px] py-3.5 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">Thông tin ứng viên</TableHead>
              <TableHead className="min-w-32 py-3.5 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">Cơ sở mong muốn</TableHead>
              <TableHead className="min-w-[120px] py-3.5 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">GEN chính thức</TableHead>
              <TableHead className="min-w-[120px] py-3.5 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">Mã khu vực</TableHead>
              <TableHead className="min-w-[200px] py-3.5 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">Khối / Chương trình</TableHead>
              {selectedExtraColumns.map((header) => (
                <TableHead key={header} className="min-w-[180px] py-3.5 px-3 text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={8 + selectedExtraColumns.length} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center p-8">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 mb-4">
                      <Search className="h-10 w-10 text-gray-300" />
                    </div>
                    <p className="text-base font-semibold text-gray-900">Không tìm thấy ứng viên</p>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm text-center">Hãy thử thay đổi từ khoá tìm kiếm, chọn lại bộ lọc trạng thái hoặc làm mới dữ liệu từ Google Sheet.</p>
                    <button 
                      onClick={onClearFilters}
                      className="mt-6 text-sm font-semibold text-[#a1001f] hover:underline"
                    >
                      Xóa toàn bộ bộ lọc
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {rows.map((row, index) => (
              <HrCandidateRow
                key={`${row.candidateKey}-${row.rowNumber}`}
                row={row}
                index={index}
                page={page}
                pageSize={pageSize}
                selectedExtraColumns={selectedExtraColumns}
                onOpenDetails={onOpenDetails}
                isSelected={selectedKeys.has(row.candidateKey)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-200 bg-gray-50/50 px-4 py-3 sm:flex-row sm:px-5">
        <p className="text-xs font-medium text-gray-500">
          Đang hiển thị <span className="text-gray-900 font-bold">{rows.length}</span> trên tổng số <span className="text-gray-900 font-bold">{pagination.total}</span> ứng viên
        </p>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={pagination.page <= 1}
            className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
          >
            Trang trước
          </button>
          <div className="h-4 w-px bg-gray-200 mx-1"></div>
          <span className="px-3 text-xs font-bold text-gray-900">
            {pagination.page} <span className="text-gray-400 font-medium">/ {pagination.totalPages}</span>
          </span>
          <div className="h-4 w-px bg-gray-200 mx-1"></div>
          <button
            onClick={() => onPageChange(Math.min(pagination.totalPages, page + 1))}
            disabled={pagination.page >= pagination.totalPages}
            className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      </div>
    </div>
  );
}
