'use client';

import Modal from '@/components/Modal';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Stepper, StepItem } from '@/components/ui/stepper';
import {
  Search, Filter, CheckCircle, XCircle, Eye, DollarSign,
  Award, TrendingDown, ChevronDown, MessageSquare
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────
interface SalaryDeal {
  id: number;
  deal_type: 'bonus' | 'salary_reduction' | 'salary_deal';
  submitter_email: string;
  submitter_name: string;
  teacher_name: string;
  teacher_codename?: string;
  teacher_email?: string;
  class_code?: string;
  bonus_amount?: number;
  bonus_reason?: string;
  deal_salary_amount?: number;
  teacher_experience?: string;
  teacher_certificates?: string;
  current_rate?: string;
  new_rate?: string;
  status: string;
  tegl_note?: string;
  tegl_email?: string;
  tegl_name?: string;
  tegl_decided_at?: string;
  admin_note?: string;
  admin_email?: string;
  admin_name?: string;
  admin_decided_at?: string;
  created_at: string;
}

type StatusFilter = 'all' | 'pending' | 'tegl_approved' | 'admin_approved' | 'rejected';

// ─── Constants ──────────────────────────────────────
const DEAL_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  bonus: { label: 'Bonus', icon: <Award className="w-3.5 h-3.5" />, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  salary_reduction: { label: 'Hạ lương', icon: <TrendingDown className="w-3.5 h-3.5" />, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  salary_deal: { label: 'Deal lương', icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-blue-700 bg-blue-50 border-blue-200' },
};

const STATUS_TABS: { key: StatusFilter; label: string; color: string }[] = [
  { key: 'all', label: 'Tất cả', color: 'text-slate-600' },
  { key: 'pending', label: 'Chờ TEGL', color: 'text-yellow-600' },
  { key: 'tegl_approved', label: 'Chờ Admin', color: 'text-blue-600' },
  { key: 'admin_approved', label: 'Đã duyệt', color: 'text-green-600' },
  { key: 'rejected', label: 'Đã từ chối', color: 'text-red-600' },
];

// ─── Helpers ────────────────────────────────────────
function getStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Chờ TEGL duyệt', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    tegl_approved: { label: 'Chờ Admin duyệt', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
    tegl_rejected: { label: 'TEGL từ chối', cls: 'bg-red-100 text-red-800 border-red-200' },
    admin_approved: { label: 'Đã duyệt', cls: 'bg-green-100 text-green-800 border-green-200' },
    admin_rejected: { label: 'Admin từ chối', cls: 'bg-red-100 text-red-800 border-red-200' },
  };
  const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.cls}`}>{s.label}</span>;
}

function getSteps(deal: SalaryDeal): StepItem[] {
  const s = deal.status;
  return [
    {
      id: 1, label: 'Gửi yêu cầu',
      description: `${deal.submitter_name} · ${new Date(deal.created_at).toLocaleDateString('vi-VN')}`,
      status: 'completed',
    },
    {
      id: 2, label: 'TEGL duyệt',
      description: deal.tegl_name ? `${deal.tegl_name}` : undefined,
      status: s === 'pending' ? 'current' :
        s === 'tegl_rejected' ? 'error' : 'completed',
    },
    {
      id: 3, label: 'Admin duyệt',
      description: deal.admin_name ? `${deal.admin_name}` : undefined,
      status: ['admin_approved'].includes(s) ? 'success' :
        s === 'admin_rejected' ? 'error' :
        s === 'tegl_approved' ? 'current' : 'upcoming',
    },
  ];
}

// ─── Component ──────────────────────────────────────
export default function AdminDealLuongPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<SalaryDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dealTypeFilter, setDealTypeFilter] = useState<string>('all');
  const [selectedDeal, setSelectedDeal] = useState<SalaryDeal | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ─── Role check ──────────────────────────────────
  const userRole = user?.role;
  const isAdmin = userRole === 'super_admin' || userRole === 'admin';

  // ─── Fetch ───────────────────────────────────────
  const fetchDeals = async () => {
    try {
      const res = await fetch('/api/salary-deals');
      const data = await res.json();
      if (data.success) setDeals(data.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchDeals(); }, []);

  // ─── Filter ──────────────────────────────────────
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      // Status filter
      if (statusFilter === 'rejected') {
        if (!['tegl_rejected', 'admin_rejected'].includes(d.status)) return false;
      } else if (statusFilter !== 'all' && d.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (dealTypeFilter !== 'all' && d.deal_type !== dealTypeFilter) return false;

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          d.teacher_name.toLowerCase().includes(q) ||
          d.submitter_name.toLowerCase().includes(q) ||
          (d.teacher_codename || '').toLowerCase().includes(q) ||
          (d.class_code || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [deals, statusFilter, dealTypeFilter, searchQuery]);

  // ─── Can review? ─────────────────────────────────
  const canReview = (deal: SalaryDeal) => {
    if (!isAdmin) return false;
    if (deal.status === 'pending') return true;
    if (deal.status === 'tegl_approved') return true;
    return false;
  };

  // ─── Review action ──────────────────────────────
  const handleReview = async (action: 'approve' | 'reject') => {
    if (!selectedDeal || !user) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/salary-deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDeal.id,
          action,
          note: reviewNote,
          reviewer_email: user.email,
          reviewer_name: user.displayName || user.email,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setSelectedDeal(null);
        setReviewNote('');
        fetchDeals();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally { setSubmitting(false); }
  };

  // ─── Stats ────────────────────────────────────────
  const stats = useMemo(() => ({
    total: deals.length,
    pending: deals.filter(d => d.status === 'pending').length,
    waitingAdmin: deals.filter(d => d.status === 'tegl_approved').length,
    approved: deals.filter(d => d.status === 'admin_approved').length,
    rejected: deals.filter(d => ['tegl_rejected', 'admin_rejected'].includes(d.status)).length,
  }), [deals]);

  // ─── Render ──────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          Quản lý Deal Lương
        </h1>
        <p className="text-slate-500 mt-2 text-sm">Duyệt yêu cầu bonus, hạ lương, deal lương từ Leader/TE/TC</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Tổng', value: stats.total, color: 'from-slate-500 to-slate-600' },
          { label: 'Chờ TEGL', value: stats.pending, color: 'from-yellow-500 to-amber-500' },
          { label: 'Chờ Admin', value: stats.waitingAdmin, color: 'from-blue-500 to-indigo-500' },
          { label: 'Đã duyệt', value: stats.approved, color: 'from-green-500 to-emerald-500' },
          { label: 'Từ chối', value: stats.rejected, color: 'from-red-500 to-rose-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4">
            <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm mb-6 overflow-hidden">
        {/* Status tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {STATUS_TABS.map(tab => {
            const isActive = statusFilter === tab.key;
            const count = tab.key === 'all' ? stats.total :
              tab.key === 'rejected' ? stats.rejected :
              tab.key === 'pending' ? stats.pending :
              tab.key === 'tegl_approved' ? stats.waitingAdmin :
              stats.approved;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-5 py-3.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                  isActive
                    ? `${tab.color} border-current bg-slate-50/50`
                    : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50/30'
                }`}
              >
                {tab.label}
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-current/10' : 'bg-slate-100'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search & type filter */}
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên GV, codename, mã lớp..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
          <select
            value={dealTypeFilter}
            onChange={e => setDealTypeFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all min-w-[160px]"
          >
            <option value="all">Tất cả loại</option>
            <option value="bonus">Bonus</option>
            <option value="salary_reduction">Hạ lương</option>
            <option value="salary_deal">Deal lương</option>
          </select>
        </div>
      </div>

      {/* Deal List */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        {filteredDeals.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-400 text-sm">Không có yêu cầu nào</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDeals.map(deal => {
              const typeInfo = DEAL_TYPE_LABELS[deal.deal_type];
              const reviewable = canReview(deal);

              return (
                <div
                  key={deal.id}
                  className={`p-5 transition-colors cursor-pointer hover:bg-slate-50/50 ${reviewable ? 'border-l-4 border-l-blue-400' : ''}`}
                  onClick={() => { setSelectedDeal(deal); setReviewNote(''); }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${typeInfo.color}`}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                        <span className="text-xs text-slate-400">#{deal.id}</span>
                      </div>
                      <p className="font-semibold text-slate-900 truncate">{deal.teacher_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Gửi bởi {deal.submitter_name} · {new Date(deal.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {deal.deal_type === 'bonus' && deal.bonus_amount && (
                        <span className="text-sm font-bold text-emerald-600">+{deal.bonus_amount.toLocaleString()}đ</span>
                      )}
                      {deal.deal_type === 'salary_reduction' && (
                        <span className="text-sm font-medium text-amber-600">{deal.current_rate} → {deal.new_rate}</span>
                      )}
                      {deal.deal_type === 'salary_deal' && deal.deal_salary_amount && (
                        <span className="text-sm font-bold text-blue-600">{deal.deal_salary_amount.toLocaleString()}đ</span>
                      )}
                      {getStatusBadge(deal.status)}
                      {reviewable && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded-lg text-[11px] font-bold animate-pulse">
                          Cần duyệt
                        </span>
                      )}
                    </div>
                  </div>

                  <Stepper steps={getSteps(deal)} compact />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ Detail + Review Modal ═══ */}
      <Modal
        isOpen={!!selectedDeal}
        onClose={() => { setSelectedDeal(null); setReviewNote(''); }}
        title={`Chi tiết yêu cầu #${selectedDeal?.id}`}
        maxWidth="4xl"
      >
        {selectedDeal && (
          <div className="space-y-6">
            {/* Stepper */}
            <Stepper steps={getSteps(selectedDeal)} />

            {/* Deal type badge */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${DEAL_TYPE_LABELS[selectedDeal.deal_type]?.color}`}>
                {DEAL_TYPE_LABELS[selectedDeal.deal_type]?.icon}
                {DEAL_TYPE_LABELS[selectedDeal.deal_type]?.label}
              </span>
              {getStatusBadge(selectedDeal.status)}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Giảng viên</p>
                <p className="text-sm font-semibold text-slate-800">{selectedDeal.teacher_name}</p>
                {selectedDeal.teacher_codename && <p className="text-xs text-slate-500">{selectedDeal.teacher_codename}</p>}
                {selectedDeal.teacher_email && <p className="text-xs text-slate-400">{selectedDeal.teacher_email}</p>}
              </div>
              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Người gửi</p>
                <p className="text-sm font-semibold text-slate-800">{selectedDeal.submitter_name}</p>
                <p className="text-xs text-slate-400">{selectedDeal.submitter_email}</p>
              </div>
            </div>

            {/* Type-specific */}
            {selectedDeal.deal_type === 'bonus' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-emerald-50 rounded-lg px-4 py-3 border border-emerald-100">
                  <span className="text-sm text-emerald-700 font-medium">Mức bonus</span>
                  <span className="font-bold text-emerald-700 text-lg">+{selectedDeal.bonus_amount?.toLocaleString()}đ</span>
                </div>
                {selectedDeal.class_code && (
                  <p className="text-sm"><span className="text-slate-500">Mã lớp:</span> <strong>{selectedDeal.class_code}</strong></p>
                )}
                {selectedDeal.bonus_reason && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Lý do</p>
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selectedDeal.bonus_reason}</p>
                  </div>
                )}
              </div>
            )}

            {selectedDeal.deal_type === 'salary_reduction' && (
              <div className="space-y-3">
                <div className="flex items-center gap-6 bg-amber-50 rounded-lg px-4 py-3 border border-amber-100">
                  <div className="text-center">
                    <p className="text-[11px] text-amber-500 font-bold uppercase">Rate hiện tại</p>
                    <p className="text-xl font-bold text-amber-700">{selectedDeal.current_rate}</p>
                  </div>
                  <span className="text-2xl text-amber-400">→</span>
                  <div className="text-center">
                    <p className="text-[11px] text-amber-500 font-bold uppercase">Rate mới</p>
                    <p className="text-xl font-bold text-amber-700">{selectedDeal.new_rate}</p>
                  </div>
                </div>
                {selectedDeal.class_code && (
                  <p className="text-sm"><span className="text-slate-500">Mã lớp:</span> <strong>{selectedDeal.class_code}</strong></p>
                )}
              </div>
            )}

            {selectedDeal.deal_type === 'salary_deal' && (
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-100 flex items-center justify-between">
                  <span className="text-sm text-blue-700 font-medium">Mức đề xuất</span>
                  <span className="font-bold text-blue-700 text-lg">{selectedDeal.deal_salary_amount?.toLocaleString()}đ</span>
                </div>
                {selectedDeal.teacher_experience && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Kinh nghiệm</p>
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{selectedDeal.teacher_experience}</p>
                  </div>
                )}
                {selectedDeal.teacher_certificates && (
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Chứng chỉ</p>
                    <a href={selectedDeal.teacher_certificates} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline">{selectedDeal.teacher_certificates}</a>
                  </div>
                )}
              </div>
            )}

            {/* TEGL review info */}
            {selectedDeal.tegl_name && (
              <div className={`rounded-lg px-4 py-3 border ${selectedDeal.status === 'tegl_rejected' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-[11px] text-slate-400 font-bold uppercase">TEGL Review — {selectedDeal.tegl_name}</p>
                </div>
                {selectedDeal.tegl_note && <p className="text-sm text-slate-700">{selectedDeal.tegl_note}</p>}
                {selectedDeal.tegl_decided_at && <p className="text-[11px] text-slate-400 mt-1">{new Date(selectedDeal.tegl_decided_at).toLocaleString('vi-VN')}</p>}
              </div>
            )}

            {/* Admin review info */}
            {selectedDeal.admin_name && (
              <div className={`rounded-lg px-4 py-3 border ${selectedDeal.status === 'admin_rejected' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-[11px] text-slate-400 font-bold uppercase">Admin Review — {selectedDeal.admin_name}</p>
                </div>
                {selectedDeal.admin_note && <p className="text-sm text-slate-700">{selectedDeal.admin_note}</p>}
                {selectedDeal.admin_decided_at && <p className="text-[11px] text-slate-400 mt-1">{new Date(selectedDeal.admin_decided_at).toLocaleString('vi-VN')}</p>}
              </div>
            )}

            {/* Review Actions */}
            {canReview(selectedDeal) && (
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-bold text-blue-700 mb-0.5">
                    {selectedDeal.status === 'pending' ? '🔍 Duyệt Bước 1 (Xác nhận yêu cầu)' : '✅ Duyệt Bước 2 — Phê duyệt cuối cùng'}
                  </p>
                  <p className="text-[11px] text-blue-500">Vui lòng nhập ghi chú và chọn hành động</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Ghi chú duyệt
                  </label>
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none"
                    rows={3}
                    placeholder="Nhập ghi chú cho quyết định duyệt/từ chối..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleReview('reject')}
                    disabled={submitting}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Từ chối
                  </Button>
                  <Button
                    onClick={() => handleReview('approve')}
                    disabled={submitting}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/20"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang xử lý...
                      </span>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1.5" />
                        Duyệt
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
