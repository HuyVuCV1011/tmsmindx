'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageContainer } from '@/components/PageContainer';
import { TableSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
    const variantMap: Record<string, 'warning' | 'success' | 'secondary'> = {
      draft: 'warning',
      published: 'success',
      archived: 'secondary',
    };
    const labels: Record<string, string> = {
      draft: 'Nháp',
      published: 'Đã công bố',
      archived: 'Lưu trữ',
    };
    const Icon = status === 'published' ? CheckCircle : status === 'draft' ? Edit : XCircle;
    
    return (
      <Badge variant={variantMap[status] || 'secondary'}>
        <Icon className="w-3 h-3" />
        {labels[status] || status}
      </Badge>
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
            <Button variant="mindx">
              <Plus className="h-5 w-5" />
              Tạo đề chuyên môn
            </Button>
          </Link>
          <Link href="/admin/baitap/tao-moi">
            <Button>
              <Plus className="h-5 w-5" />
              Tạo bài tập mới
            </Button>
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
              <Button>
                <Plus className="h-5 w-5" />
                Tạo bài tập đầu tiên
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead className="hidden md:table-cell">Video</TableHead>
                  <TableHead className="text-center">Loại</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Câu hỏi</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">Điểm</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Trạng thái</TableHead>
                  <TableHead className="text-center">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment, idx) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="text-gray-600">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-gray-900">
                        {assignment.assignment_title}
                      </div>
                      {assignment.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {assignment.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600 hidden md:table-cell">
                      {assignment.video_title || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {getTypeBadge(assignment.assignment_type)}
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <Badge variant="info">
                        <FileText className="w-3 h-3" />
                        {assignment.question_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center hidden lg:table-cell">
                      <div className="text-sm font-semibold text-gray-900">
                        {assignment.total_points}
                      </div>
                      <div className="text-xs text-gray-500">
                        Đạt: {assignment.passing_score}
                      </div>
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      {getStatusBadge(assignment.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/admin/baitap/${assignment.id}/cau-hoi?assignment_id=${assignment.id}`}>
                          <Button variant="ghost" size="icon-sm" title="Quản lý câu hỏi" className="text-green-600 hover:bg-green-50">
                            <FileText className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/baitap/${assignment.id}/chinh-sua`}>
                          <Button variant="ghost" size="icon-sm" title="Sửa" className="text-blue-600 hover:bg-blue-50">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirmId(assignment.id)} title="Xóa" className="text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title="Xóa bài tập"
        message="Bạn có chắc chắn muốn xóa bài tập này? Tất cả câu hỏi liên quan sẽ bị xóa. Hành động này không thể hoàn tác."
        type="danger"
        confirmText="Xóa"
        cancelText="Hủy"
      />
    </PageContainer>
  );
}
