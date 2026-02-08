'use client';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/PageContainer';
import { SkeletonPage } from '@/components/skeletons';
import { Tabs } from '@/components/Tabs';
import { useAuth } from '@/lib/auth-context';
import { CheckCircle, Eye, FileText, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  // Fetch tất cả giải trình
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
      <PageContainer title="Quản lý giải trình" description="Xem và phê duyệt giải trình của giảng viên">
        <SkeletonPage />
      </PageContainer>
    );
  }

  const tabs = [
    { id: 'all', label: 'Tất cả', count: getStatusCount('all') },
    { id: 'pending', label: 'Đang chờ', count: getStatusCount('pending') },
    { id: 'accepted', label: 'Đã chấp nhận', count: getStatusCount('accepted') },
    { id: 'rejected', label: 'Đã từ chối', count: getStatusCount('rejected') },
  ];

  return (
    <PageContainer
      title="Quản lý Giải trình"
      description="Xem và xét duyệt các giải trình từ giáo viên"
    >
      {/* Tabs Filter */}
      <Tabs
        tabs={tabs}
        activeTab={filterStatus}
        onChange={setFilterStatus}
      />

      <Card>
        {explanations.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Không có giải trình"
            description={filterStatus === 'all' 
              ? 'Chưa có giải trình nào được gửi lên hệ thống'
              : `Không có giải trình ở trạng thái "${filterStatus}"`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Giáo viên</th>
                  <th className="px-3 py-2 text-left font-semibold">Cơ sở</th>
                  <th className="px-3 py-2 text-left font-semibold">Bộ môn</th>
                  <th className="px-3 py-2 text-left font-semibold">Ngày KT</th>
                  <th className="px-3 py-2 text-left font-semibold">Ngày tạo</th>
                  <th className="px-3 py-2 text-center font-semibold">Trạng thái</th>
                  <th className="px-3 py-2 text-center font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {explanations.map((explanation, idx) => (
                  <tr key={explanation.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{explanation.teacher_name}</div>
                      <div className="text-xs text-gray-500">{explanation.lms_code}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[150px]">{explanation.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[180px] truncate" title={explanation.campus}>
                        {explanation.campus}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[150px] truncate" title={explanation.subject}>
                        {explanation.subject}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {new Date(explanation.test_date).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <div>
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
                    <td className="px-3 py-2 text-center">
                      {getStatusBadge(explanation.status)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => setSelectedExplanation(explanation)}
                        className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        title="Xem chi tiết"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      {selectedExplanation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <Card>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">Chi tiết Giải trình #{selectedExplanation.id}</h2>
                <p className="text-sm text-gray-600">{selectedExplanation.teacher_name}</p>
              </div>
              <button
                onClick={() => { setSelectedExplanation(null); setAdminNote(''); }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center justify-between pb-3 border-b">
                <span className="text-sm font-medium">Trạng thái:</span>
                {getStatusBadge(selectedExplanation.status)}
              </div>

              {/* Teacher Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Họ và tên</p>
                  <p className="text-sm font-semibold">{selectedExplanation.teacher_name}</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Mã LMS</p>
                  <p className="text-sm font-semibold">{selectedExplanation.lms_code}</p>
                </div>
                <div className="bg-gray-50 rounded p-3 col-span-2">
                  <p className="text-xs text-gray-600 mb-1">Email</p>
                  <p className="text-sm font-semibold break-all">{selectedExplanation.email}</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Cơ sở</p>
                  <p className="text-sm font-semibold">{selectedExplanation.campus}</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Bộ môn</p>
                  <p className="text-sm font-semibold">{selectedExplanation.subject}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Ngày kiểm tra</p>
                  <p className="text-sm font-semibold">
                    {new Date(selectedExplanation.test_date).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Ngày tạo</p>
                  <p className="text-sm font-semibold">
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
                <p className="text-sm font-semibold mb-2">Lý do không tham gia:</p>
                <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r p-3">
                  <p className="text-sm whitespace-pre-wrap">{selectedExplanation.reason}</p>
                </div>
              </div>

              {/* Existing Admin Note */}
              {selectedExplanation.admin_note && (
                <div>
                  <p className="text-sm font-semibold mb-2">Ghi chú từ quản lý:</p>
                  <div className={`border-l-4 rounded-r p-3 ${
                    selectedExplanation.status === 'accepted' 
                      ? 'bg-green-50 border-green-500' 
                      : 'bg-red-50 border-red-500'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{selectedExplanation.admin_note}</p>
                    {selectedExplanation.admin_name && (
                      <p className="text-xs text-gray-600 mt-2 pt-2 border-t">
                        <span className="font-medium">Người xử lý:</span> {selectedExplanation.admin_name}
                        {selectedExplanation.admin_email && ` (${selectedExplanation.admin_email})`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Section - Only for Pending */}
              {selectedExplanation.status === 'pending' && (
                <div className="pt-3 border-t">
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
                    <p className="text-sm text-amber-800">Giải trình này đang chờ xét duyệt. Vui lòng xem xét và quyết định.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Ghi chú (không bắt buộc)</label>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                        placeholder="Nhập ghi chú hoặc lý do từ chối..."
                      />
                      <p className="text-xs text-gray-500 mt-1">Ghi chú sẽ được gửi qua email cho giáo viên</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleUpdateStatus(selectedExplanation.id, 'accepted')}
                        disabled={processing}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                      >
                        {processing ? 'Đang xử lý...' : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Chấp nhận
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(selectedExplanation.id, 'rejected')}
                        disabled={processing}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium"
                      >
                        {processing ? 'Đang xử lý...' : (
                          <>
                            <XCircle className="h-4 w-4" />
                            Từ chối
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
