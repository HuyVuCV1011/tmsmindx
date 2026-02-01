'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import Modal from '@/components/Modal';

interface Explanation {
  id: number;
  teacher_name: string;
  lms_code: string;
  email: string;
  campus: string;
  subject: string;
  test_date: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  admin_note?: string;
  admin_name?: string;
  admin_email?: string;
  created_at: string;
  updated_at: string;
}

export default function AdminGiaiThichPage() {
  const { user } = useAuth();
  const [explanations, setExplanations] = useState<Explanation[]>([]);
  const [allExplanations, setAllExplanations] = useState<Explanation[]>([]); // Lưu tất cả để tính số thống kê
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedExplanation, setSelectedExplanation] = useState<Explanation | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  // Close modal when clicking outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedExplanation(null);
        setAdminNote('');
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Fetch tất cả giải thích
  const fetchExplanations = async () => {
    try {
      // Luôn fetch tất cả để có số thống kê
      const response = await fetch('/api/explanations');
      const data = await response.json();
      if (data.success) {
        setAllExplanations(data.data);
        // Filter cho hiển thị
        if (filterStatus === 'all') {
          setExplanations(data.data);
        } else {
          setExplanations(data.data.filter((e: Explanation) => e.status === filterStatus));
        }
      }
    } catch (error) {
      console.error('Error fetching explanations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExplanations();
  }, [filterStatus]);

  const handleUpdateStatus = async (id: number, status: 'accepted' | 'rejected') => {
    if (!confirm(`Bạn có chắc muốn ${status === 'accepted' ? 'chấp nhận' : 'từ chối'} giải trình này?`)) {
      return;
    }

    setProcessing(true);
    
    try {
      const response = await fetch('/api/explanations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status,
          admin_note: adminNote,
          admin_email: user?.email,
          admin_name: user?.displayName || user?.email
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Đã ${status === 'accepted' ? 'chấp nhận' : 'từ chối'} giải trình. Email đã được gửi đến giáo viên.`);
        setSelectedExplanation(null);
        setAdminNote('');
        fetchExplanations();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating explanation:', error);
      alert('Có lỗi xảy ra khi cập nhật giải trình');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      accepted: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300'
    };
    const labels = {
      pending: 'Đang chờ',
      accepted: 'Đã chấp nhận',
      rejected: 'Đã từ chối'
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getStatusCount = (status: string) => {
    if (status === 'all') return allExplanations.length;
    return allExplanations.filter(e => e.status === status).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Quản Lý Giải Trình</h1>
        <p className="text-sm text-gray-600">Xem và xét duyệt các giải trình từ giáo viên</p>
      </div>

      {/* Filter Buttons - Responsive */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 sm:px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                filterStatus === 'all' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">Tất cả</span>
              <span className="sm:hidden">Tất cả</span>
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-white bg-opacity-20">
                {getStatusCount('all')}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 sm:px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                filterStatus === 'pending' 
                  ? 'bg-yellow-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">Đang chờ</span>
              <span className="sm:hidden">Chờ</span>
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-white bg-opacity-20">
                {getStatusCount('pending')}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('accepted')}
              className={`px-3 sm:px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                filterStatus === 'accepted' 
                  ? 'bg-green-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">Đã chấp nhận</span>
              <span className="sm:hidden">Chấp nhận</span>
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-white bg-opacity-20">
                {getStatusCount('accepted')}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-3 sm:px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                filterStatus === 'rejected' 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="hidden sm:inline">Đã từ chối</span>
              <span className="sm:hidden">Từ chối</span>
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-white bg-opacity-20">
                {getStatusCount('rejected')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Review Modal - Mobile Optimized */}
      <Modal
        isOpen={!!selectedExplanation}
        onClose={() => {
          setSelectedExplanation(null);
          setAdminNote('');
        }}
        title={selectedExplanation ? `Chi Tiết Giải Trình #${selectedExplanation.id}` : ''}
        subtitle={selectedExplanation?.teacher_name}
        maxWidth="3xl"
        footer={
          <div className="flex items-center justify-between text-xs text-gray-500">
            {selectedExplanation && (
              <>
                <span>ID: #{selectedExplanation.id}</span>
                <span>Cập nhật: {new Date(selectedExplanation.updated_at).toLocaleString('vi-VN')}</span>
              </>
            )}
          </div>
        }
      >
        {selectedExplanation && (
            <div className="space-y-5">
                {/* Status Badge */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Trạng thái hiện tại:</span>
                  {getStatusBadge(selectedExplanation.status)}
                </div>

                {/* Teacher Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 font-medium mb-1">Họ và tên</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedExplanation.teacher_name}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 font-medium mb-1">Mã LMS</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedExplanation.lms_code}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 sm:col-span-2">
                    <p className="text-xs text-gray-600 font-medium mb-1">Email</p>
                    <p className="text-sm font-semibold text-gray-900 break-all">{selectedExplanation.email}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 font-medium mb-1">Cơ sở</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedExplanation.campus}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 font-medium mb-1">Bộ môn</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedExplanation.subject}</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 font-medium mb-1">Ngày kiểm tra</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(selectedExplanation.test_date).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 font-medium mb-1">Ngày tạo</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(selectedExplanation.created_at).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Lý do không tham gia:
                  </p>
                  <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-4">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selectedExplanation.reason}</p>
                  </div>
                </div>

                {/* Existing Admin Note */}
                {selectedExplanation.admin_note && (
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Ghi chú từ quản lý:
                    </p>
                    <div className={`border-l-4 rounded-r-lg p-4 ${
                      selectedExplanation.status === 'accepted' 
                        ? 'bg-green-50 border-green-500' 
                        : 'bg-red-50 border-red-500'
                    }`}>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selectedExplanation.admin_note}</p>
                      {selectedExplanation.admin_name && (
                        <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-300">
                          <span className="font-medium">Người xử lý:</span> {selectedExplanation.admin_name}
                          {selectedExplanation.admin_email && ` (${selectedExplanation.admin_email})`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Section - Only for Pending */}
                {selectedExplanation.status === 'pending' && (
                  <div className="pt-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm text-amber-800">Giải trình này đang chờ xét duyệt. Vui lòng xem xét và quyết định.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Ghi chú của bạn (không bắt buộc)
                        </label>
                        <textarea
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          rows={4}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                          placeholder="Nhập ghi chú hoặc lý do từ chối (nếu có)..."
                        />
                        <p className="text-xs text-gray-500 mt-1.5">Ghi chú này sẽ được gửi qua email cho giáo viên</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => handleUpdateStatus(selectedExplanation.id, 'accepted')}
                          disabled={processing}
                          className="w-full flex items-center justify-center px-5 py-3.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-medium shadow-md hover:shadow-lg"
                        >
                          {processing ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Đang xử lý...
                            </span>
                          ) : (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Chấp Nhận
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(selectedExplanation.id, 'rejected')}
                          disabled={processing}
                          className="w-full flex items-center justify-center px-5 py-3.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-medium shadow-md hover:shadow-lg"
                        >
                          {processing ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Đang xử lý...
                            </span>
                          ) : (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Từ Chối
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
        )}
      </Modal>

      {/* Table & Cards - Responsive */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {explanations.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Không có giải trình nào</h3>
              <p className="mt-2 text-sm text-gray-600">
                {filterStatus === 'all' 
                  ? 'Chưa có giải trình nào được gửi lên hệ thống'
                  : `Không có giải trình nào ở trạng thái "${filterStatus}"`}
              </p>
            </div>
          ) : (
            <div>
              {/* Desktop Table - Hidden on mobile */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Giáo viên</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Cơ sở</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Bộ môn</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Ngày KT</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Ngày tạo</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {explanations.map((explanation) => (
                      <tr key={explanation.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-blue-600">#{explanation.id}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{explanation.teacher_name}</div>
                          <div className="text-xs text-gray-500">{explanation.lms_code}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">{explanation.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-[180px] truncate" title={explanation.campus}>
                            {explanation.campus}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-[150px] truncate" title={explanation.subject}>
                            {explanation.subject}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(explanation.test_date).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(explanation.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit'
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(explanation.created_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(explanation.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedExplanation(explanation)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors flex items-center"
                          >
                            Xem
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden divide-y divide-gray-200">
                {explanations.map((explanation) => (
                  <div
                    key={explanation.id}
                    onClick={() => setSelectedExplanation(explanation)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-blue-600">#{explanation.id}</span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-600">
                            {new Date(explanation.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{explanation.teacher_name}</p>
                        <p className="text-xs text-gray-600 truncate">{explanation.email}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(explanation.status)}
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-500 mb-0.5">Cơ sở</p>
                        <p className="text-xs font-medium text-gray-900 truncate" title={explanation.campus}>
                          {explanation.campus}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-500 mb-0.5">Bộ môn</p>
                        <p className="text-xs font-medium text-gray-900 truncate" title={explanation.subject}>
                          {explanation.subject}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Ngày KT:</span>{' '}
                        {new Date(explanation.test_date).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit'
                        })}
                      </div>
                      <div className="flex items-center text-xs text-blue-600 font-medium">
                        <span>Chi tiết</span>
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
