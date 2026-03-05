'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { TableSkeleton } from '@/components/skeletons';
import { Assignment } from '@/types/assignment';
import { ASSIGNMENT_TYPES } from '@/lib/assignment-constants';
import { Plus, Edit, Trash2, FileText, Eye, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function BaiTapManagementPage() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR('/api/training-assignments', fetcher);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const assignments: Assignment[] = data?.success ? data.data : [];

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800',
      archived: 'bg-gray-100 text-gray-800',
    };
    const labels = {
      draft: 'Nháp',
      published: 'Đã công bố',
      archived: 'Lưu trữ',
    };
    const Icon = status === 'published' ? CheckCircle : status === 'draft' ? Edit : XCircle;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        <Icon className="w-3 h-3" />
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeInfo = ASSIGNMENT_TYPES.find(t => t.value === type);
    return (
      <span className="inline-flex items-center gap-1 text-sm">
        <span>{typeInfo?.icon}</span>
        <span>{typeInfo?.label}</span>
      </span>
    );
  };

  const handleDelete = async (id: number) => {
    try {
      // Optimistic update
      const previousData = assignments;
      mutate({ success: true, data: assignments.filter(a => a.id !== id) }, false);
      
      const response = await fetch(`/api/training-assignments?id=${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Xóa bài tập thành công!');
        mutate();
      } else {
        // Revert on error
        mutate({ success: true, data: previousData }, false);
        toast.error('Lỗi: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Lỗi khi xóa bài tập');
      mutate();
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return (
    <PageContainer
      title="Quản lý Bài tập"
      description="Tạo và quản lý bài tập cho giáo viên"
    >
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-gray-600">
          Tổng số: <span className="font-semibold">{assignments.length}</span> bài tập
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/baitap/tao-moi?mode=professional">
            <button className="flex items-center gap-2 bg-[#a1001f] hover:bg-[#8a0019] text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-md">
              <Plus className="h-5 w-5" />
              Tạo đề chuyên môn
            </button>
          </Link>
          <Link href="/admin/baitap/tao-moi">
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-md">
              <Plus className="h-5 w-5" />
              Tạo bài tập mới
            </button>
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            Lỗi tải dữ liệu
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Chưa có bài tập nào</h3>
            <p className="text-gray-600 mb-6">Bắt đầu bằng cách tạo bài tập đầu tiên</p>
            <Link href="/admin/baitap/tao-moi">
              <button className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-md">
                <Plus className="h-5 w-5" />
                Tạo bài tập đầu tiên
              </button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Tiêu đề
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                    Video
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Loại
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                    Câu hỏi
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                    Điểm
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.map((assignment, idx) => (
                  <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        {assignment.assignment_title}
                      </div>
                      {assignment.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {assignment.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                      {assignment.video_title || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getTypeBadge(assignment.assignment_type)}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                        <FileText className="w-3 h-3" />
                        {assignment.question_count || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <div className="text-sm font-semibold text-gray-900">
                        {assignment.total_points}
                      </div>
                      <div className="text-xs text-gray-500">
                        Đạt: {assignment.passing_score}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      {getStatusBadge(assignment.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/admin/baitap/${assignment.id}/cau-hoi?assignment_id=${assignment.id}`}>
                          <button
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Quản lý câu hỏi"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </Link>
                        <Link href={`/admin/baitap/${assignment.id}/chinh-sua`}>
                          <button
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Sửa"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </Link>
                        <button
                          onClick={() => setDeleteConfirmId(assignment.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Xóa bài tập</h3>
            <p className="text-gray-600 mb-6">
              Bạn có chắc chắn muốn xóa bài tập này? Tất cả câu hỏi liên quan sẽ bị xóa. Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
