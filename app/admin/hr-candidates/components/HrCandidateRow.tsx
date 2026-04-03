import { useEffect, useRef, useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Maximize2 } from 'lucide-react';
import { HrCandidateRow as HrCandidateRowType } from '../types';

interface HrCandidateRowProps {
  row: HrCandidateRowType;
  index: number;
  page: number;
  pageSize: number;
  selectedExtraColumns: string[];
  onOpenDetails: (candidate: HrCandidateRowType) => void;
  isSelected: boolean;
  onToggleSelect: (candidateKey: string) => void;
}

export default function HrCandidateRow({
  row, index, page, pageSize, selectedExtraColumns,
  onOpenDetails, isSelected, onToggleSelect
}: HrCandidateRowProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const handleInfoMouseEnter = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  };

  const handleInfoMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowTooltip(false);
  };

  const bgClass = isSelected 
    ? 'bg-blue-50 hover:bg-blue-100/60' 
    : row.hasManualAssignment 
      ? 'bg-amber-50/20 hover:bg-amber-50/50' 
      : index % 2 === 0 
        ? 'bg-white' 
        : 'bg-gray-50/30 hover:bg-gray-50/80';

  const borderColorClass = isSelected 
    ? 'border-l-blue-500' 
    : row.hasManualAssignment 
      ? 'hover:border-l-amber-400 border-l-transparent' 
      : 'hover:border-l-gray-300 border-l-transparent';

  return (
    <TableRow className={`transition-colors border-l-4 group/row ${bgClass} ${borderColorClass}`}>
      {/* Checkbox */}
      <TableCell className="pl-4 py-3">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onToggleSelect(row.candidateKey)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
        />
      </TableCell>
      
      {/* STT */}
      <TableCell className="py-3 px-2 font-medium text-gray-400 text-xs">
        {(page - 1) * pageSize + index + 1}
      </TableCell>
      
      {/* Candidate Code */}
      <TableCell className="py-3 px-3">
        <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-800 font-mono tracking-tight border border-gray-200">
          {row.candidateCode || 'Không có'}
        </span>
      </TableCell>

      {/* Candidate Info */}
      <TableCell className="py-3 px-3 relative">
        <div
          className="relative max-w-[280px] cursor-pointer"
          onMouseEnter={handleInfoMouseEnter}
          onMouseLeave={handleInfoMouseLeave}
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-gray-900">{row.name || '--- Chưa nhập tên ---'}</p>
              <button
                onClick={() => onOpenDetails(row)}
                className="text-gray-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                title="Xem thông tin chi tiết"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {row.email && <p className="truncate text-xs text-gray-500">{row.email}</p>}
            {row.phone && <p className="truncate text-[11px] font-medium text-gray-400 font-mono">{row.phone}</p>}
          </div>

          {showTooltip && (
            <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-[360px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
              <p className="text-sm font-bold text-gray-900">{row.name || 'Chưa có tên'}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Mã UV</p>
                  <p className="mt-1 font-semibold text-gray-800">{row.candidateCode || 'Không có'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">GEN chính thức</p>
                  <p className="mt-1 font-semibold text-gray-800">{row.effectiveGen || 'Chưa xếp GEN'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Email</p>
                  <p className="mt-1 font-medium text-gray-800 break-all">{row.email || 'Không có'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Số điện thoại</p>
                  <p className="mt-1 font-medium text-gray-800">{row.phone || 'Không có'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cơ sở mong muốn</p>
                  <p className="mt-1 font-medium text-gray-800">{row.desiredCampus || 'Không có'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </TableCell>

      {/* Desired Campus */}
      <TableCell className="py-3 px-3">
        <div className="flex flex-col gap-1">
          <span className="max-w-[120px] truncate text-[13px] font-semibold text-gray-800" title={row.desiredCampus || 'Chưa có'}>
            {row.desiredCampus || '—'}
          </span>
          <span className="max-w-[120px] truncate text-[11px] text-gray-500" title={`${row.workBlock || ''} / ${row.desiredProgram || ''}`}>
            {row.workBlock || ''} {row.desiredProgram ? `• ${row.desiredProgram}` : ''}
          </span>
        </div>
      </TableCell>

      {/* Official GEN */}
      <TableCell className="py-3 px-3">
        {row.effectiveGen ? (
          <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[13px] font-black text-emerald-700 shadow-sm border border-emerald-200 uppercase tracking-widest">
            {row.effectiveGen}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            Chưa xếp GEN
          </span>
        )}
      </TableCell>

      {/* Region Code */}
      <TableCell className="py-3 px-3">
        <span className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
          KV {row.regionCode || 'N/A'}
        </span>
      </TableCell>

      {/* Work Block / Program */}
      <TableCell className="py-3 px-3">
        <div className="flex max-w-[220px] flex-col gap-1">
          <span className="truncate text-xs font-semibold text-gray-800" title={row.workBlock || 'Chưa có'}>
            {row.workBlock || 'Chưa có khối'}
          </span>
          <span className="truncate text-[11px] text-gray-500" title={row.desiredProgram || 'Chưa có'}>
            {row.desiredProgram || 'Chưa có chương trình'}
          </span>
        </div>
      </TableCell>

      {/* Extra columns */}
      {selectedExtraColumns.map((header) => (
        <TableCell key={`${row.candidateKey}-${header}`} className="py-3 px-3">
          <span className="max-w-[160px] truncate block text-xs text-gray-600 border-l border-gray-200 pl-2" title={row.raw?.[header] || ''}>
            {row.raw?.[header] || '—'}
          </span>
        </TableCell>
      ))}
    </TableRow>
  );
}
