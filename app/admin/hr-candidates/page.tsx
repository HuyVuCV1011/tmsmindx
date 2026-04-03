'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

import HrCandidateStats from './components/HrCandidateStats';
import HrCandidatesFilter from './components/HrCandidatesFilter';
import HrCandidatesTable from './components/HrCandidatesTable';
import CandidateDetailDrawer from './components/CandidateDetailDrawer';

import { HrCandidateRow, HrSummary, HrPagination, HrSource } from './types';
import { Mail, UserCheck } from 'lucide-react';

const PAGE_SIZE = 25;

export default function HrCandidatesPage() {
  const { user } = useAuth();

  const [rows, setRows] = useState<HrCandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned' | 'missing-sheet-gen' | 'manual-assigned'>('all');
  const [regionFilter, setRegionFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [genFilter, setGenFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [availableGens, setAvailableGens] = useState<string[]>([]);
  const [summary, setSummary] = useState<HrSummary>({
    total: 0,
    assigned: 0,
    unassigned: 0,
    missingSheetGen: 0,
    manualAssigned: 0,
    byGen: {},
    byRegion: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  });
  const [pagination, setPagination] = useState<HrPagination>({
    page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1,
  });
  const [source, setSource] = useState<HrSource | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedExtraColumns, setSelectedExtraColumns] = useState<string[]>([]);

  // Detailed drawer state
  const [selectedDetailsCandidate, setSelectedDetailsCandidate] = useState<HrCandidateRow | null>(null);

  // Bulk selection state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
      setSelectedKeys(new Set()); // Clear selection when search changes
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Essential Headers
  const essentialHeaders = useMemo(
    () => new Set([
        'Mã ứng viên', 'Mã UV', 'Ứng viên', 'Họ tên', 'Email',
        'Số điện thoại', 'GEN', 'Cơ sở mong muốn làm việc', 'Khối làm việc', 'Chương trình',
      ]), []
  );

  const extraColumnOptions = useMemo(() => {
    const uniqueHeaders = Array.from(new Set(headers));
    return uniqueHeaders.filter((header) => !essentialHeaders.has(header));
  }, [headers, essentialHeaders]);

  const toggleExtraColumn = (header: string) => {
    setSelectedExtraColumns((prev) => {
      if (prev.includes(header)) return prev.filter((item) => item !== header);
      if (prev.length >= 4) {
        toast.error('Chỉ nên hiển thị tối đa 4 cột mở rộng để dễ nhìn.');
        return prev;
      }
      return [...prev, header];
    });
  };

  useEffect(() => {
    setSelectedExtraColumns((prev) => prev.filter((header) => headers.includes(header)));
  }, [headers]);

  // Data Fetching
  const fetchRows = useCallback(async (forceRefresh = false) => {
    if (!user?.email) return;

    if (forceRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        requestEmail: user.email,
        status: statusFilter,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (search) params.set('search', search);
      if (genFilter !== 'all') params.set('gen', genFilter);
      if (regionFilter !== 'all') params.set('region', regionFilter);
      if (forceRefresh) params.set('refresh', '1');

      const response = await fetch(`/api/hr/candidates?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Không thể tải dữ liệu ứng viên.');

      const incomingRows: HrCandidateRow[] = data.rows || [];
      setRows(incomingRows);
      setSummary(
        data.summary || {
          total: 0,
          assigned: 0,
          unassigned: 0,
          missingSheetGen: 0,
          manualAssigned: 0,
          byGen: {},
          byRegion: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        }
      );
      setPagination(data.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
      setAvailableGens(data.availableGens || []);
      setSource(data.source || null);
      setHeaders(data.headers || []);

      if (data.pagination?.page && data.pagination.page !== page) {
        setPage(data.pagination.page);
      }
    } catch (error) {
       toast.error(error instanceof Error ? error.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email, statusFilter, page, search, genFilter, regionFilter]);

  useEffect(() => {
    fetchRows(false);
  }, [fetchRows]);

  const applyQuickFilter = (nextStatus: 'all' | 'assigned' | 'unassigned' | 'missing-sheet-gen' | 'manual-assigned', nextGen: string = 'all') => {
    setStatusFilter(nextStatus);
    setGenFilter(nextGen);
    setPage(1);
    setSelectedKeys(new Set()); // Clear selections 
  };

  const handleRegionFilterChange = (nextRegion: 'all' | '1' | '2' | '3' | '4' | '5') => {
    setRegionFilter(nextRegion);
    setPage(1);
    setSelectedKeys(new Set());
  };

  const topGenStats = useMemo(() => Object.entries(summary.byGen || {}).sort((a, b) => b[1] - a[1]).slice(0, 6), [summary.byGen]);

  // Bulk Selection Logic
  const handleToggleSelect = (candidateKey: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(candidateKey)) next.delete(candidateKey);
      else next.add(candidateKey);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedKeys.size === rows.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(rows.map(r => r.candidateKey)));
    }
  };

  return (
    <PageContainer
      title="Quản trị GEN Nhóm UV"
      description="Trung tâm điều phối dữ liệu nhân sự tuyển dụng, bộ lọc đa năng, và bulk actions."
      maxWidth="full"
      padding="md"
    >
      <div className="space-y-6 pb-20"> {/* pb-20 for floating action bar space */}

        {/* STATS */}
        <HrCandidateStats
          summary={summary}
          statusFilter={statusFilter}
          onFilterChange={(s) => applyQuickFilter(s)}
          regionFilter={regionFilter}
          onRegionFilterChange={handleRegionFilterChange}
        />

        {/* WORKSPACE */}
        <section className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Filters */}
          <HrCandidatesFilter
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            genFilter={genFilter}
            setGenFilter={setGenFilter}
            availableGens={availableGens}
            refreshing={refreshing}
            onRefresh={() => fetchRows(true)}
            selectedExtraColumns={selectedExtraColumns}
            toggleExtraColumn={toggleExtraColumn}
            extraColumnOptions={extraColumnOptions}
            source={source}
            topGenStats={topGenStats as [string, number][]}
          />

          {/* Table */}
          <HrCandidatesTable
            rows={rows}
            loading={loading}
            page={page}
            pageSize={PAGE_SIZE}
            pagination={pagination}
            selectedExtraColumns={selectedExtraColumns}
            onOpenDetails={setSelectedDetailsCandidate}
            onPageChange={(p) => setPage(p)}
            onClearFilters={() => applyQuickFilter('all', 'all')}
            selectedKeys={selectedKeys}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
          />
        </section>
      </div>

      {/* Floating Action Bar (Appears when rows are selected) */}
      {selectedKeys.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white rounded-full px-6 py-3 shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom border border-gray-700">
          <div className="flex items-center gap-2 font-medium">
             <span className="flex h-6 w-6 items-center justify-center bg-blue-500 rounded-full text-xs font-bold">{selectedKeys.size}</span> 
             đang chọn
          </div>
          <div className="h-6 w-px bg-gray-700 mx-2"></div>
          <button className="flex items-center gap-2 text-sm font-semibold hover:text-blue-400 transition-colors">
            <UserCheck className="w-4 h-4" /> Gán Tự động ALL
          </button>
          <button className="flex items-center gap-2 text-sm font-semibold hover:text-emerald-400 transition-colors">
            <Mail className="w-4 h-4" /> Email
          </button>
          <button 
            onClick={() => setSelectedKeys(new Set())}
            className="text-xs text-gray-400 hover:text-white transition-colors uppercase font-bold tracking-widest pl-4"
          >
            Bỏ qua
          </button>
        </div>
      )}

      {/* Slide-out Candidate Details Drawer */}
      <CandidateDetailDrawer
        candidate={selectedDetailsCandidate}
        isOpen={selectedDetailsCandidate !== null}
        onClose={() => setSelectedDetailsCandidate(null)}
        essentialHeaders={essentialHeaders}
      />

    </PageContainer>
  );
}
