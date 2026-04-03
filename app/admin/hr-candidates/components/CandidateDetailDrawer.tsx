import { X, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { HrCandidateRow } from '../types';

interface CandidateDetailDrawerProps {
  candidate: HrCandidateRow | null;
  isOpen: boolean;
  onClose: () => void;
  essentialHeaders: Set<string>;
}

export default function CandidateDetailDrawer({ candidate, isOpen, onClose, essentialHeaders }: CandidateDetailDrawerProps) {
  if (!isOpen || !candidate) return null;

  const hoverRawEntries = Object.entries(candidate.raw || {})
    .filter(([key, value]) => !essentialHeaders.has(key) && String(value || '').trim());

  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      <div 
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl transition-transform duration-300 transform translate-x-0 flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-xl font-extrabold text-gray-900">Chi tiết ứng viên</h2>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <div className="mb-6 flex justify-between items-start gap-4">
            <div>
              <p className="text-xl font-bold text-gray-900">{candidate.name || 'Chưa định danh'}</p>
              <div className="mt-2 space-y-1.5 text-sm font-medium text-gray-600">
                {candidate.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" /> {candidate.email}
                  </p>
                )}
                {candidate.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" /> {candidate.phone}
                  </p>
                )}
              </div>
            </div>
            <span className="shrink-0 bg-gray-100 px-2 py-1.5 rounded-lg text-xs font-bold text-gray-700 border border-gray-200">
              {candidate.candidateCode || 'No-Code'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
              <p className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                <MapPin className="h-3 w-3" /> Khu vực
              </p>
              <p className="text-sm font-bold text-gray-800">{candidate.desiredCampus || '---'}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
              <p className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                <Briefcase className="h-3 w-3" /> Bộ môn
              </p>
              <div className="flex flex-col">
                <p className="text-sm font-bold text-gray-800">{candidate.workBlock || '---'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{candidate.desiredProgram || ''}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3">Tình trạng phân bổ</h3>
            <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-xs font-semibold text-gray-500">GEN từ Sheet:</span>
                <span className="text-sm font-bold text-gray-800">{candidate.sheetGen || 'Trống'}</span>
              </div>
              <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-xs font-semibold text-gray-500">GEN Thực tế:</span>
                <span className="text-sm font-black text-emerald-600">{candidate.effectiveGen || 'Chưa Xếp'}</span>
              </div>
              {candidate.hasManualAssignment && (
                <p className="text-xs text-amber-600 font-medium pt-1 text-right">
                  * Ứng viên này đã bị ghi đè GEN thủ công.
                </p>
              )}
            </div>
          </div>

          {hoverRawEntries.length > 0 && (
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-blue-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Thông tin mở rộng từ Sheet
              </p>
              <div className="space-y-2">
                {hoverRawEntries.map(([key, value]) => (
                  <div key={`${candidate.candidateKey}-${key}`} className="flex flex-col gap-1 rounded-xl bg-gray-50 p-3 border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">{key}</span>
                    <span className="text-sm font-medium text-gray-900 border-l-2 border-gray-300 pl-3 py-0.5 leading-relaxed">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-between gap-3">
          <button 
           type="button"
           className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-2 justify-center"
          >
             <Mail className="w-4 h-4" /> Gửi Email
          </button>
          <button 
            type="button"
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-blue-700 transition-colors"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </>
  );
}
