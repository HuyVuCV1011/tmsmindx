'use client';

import { PageContainer } from '@/components/PageContainer';
import { AssignmentWizard } from '@/components/assignments';
import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

function EditAssignmentContent() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (assignmentId) {
      fetchAssignment();
    }
  }, [assignmentId]);

  const fetchAssignment = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/training-assignments?id=${assignmentId}`);
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        setAssignment(data.data[0]);
      } else {
        toast.error('Không tìm thấy bài tập');
        router.push('/admin/baitap');
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
      toast.error('Lỗi tải bài tập');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAssignment = async (assignmentData: any) => {
    try {
      setIsSubmitting(true);

      const response = await fetch('/api/training-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(assignmentId),
          ...assignmentData
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Cập nhật bài tập thành công!');
        router.push('/admin/baitap');
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast.error('Lỗi khi cập nhật bài tập');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title="Chỉnh sửa bài tập">
        <div className="animate-pulse space-y-6 p-6">
          <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          <div className="space-y-4">
            <div className="h-12 bg-gray-300 rounded"></div>
            <div className="h-32 bg-gray-300 rounded"></div>
            <div className="h-10 bg-gray-300 rounded w-1/4"></div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!assignment) {
    return (
      <PageContainer title="Chỉnh sửa bài tập">
        <div className="text-center py-12">
          <p className="text-red-600">Không tìm thấy bài tập</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Chỉnh sửa bài tập"
      description={assignment.assignment_title}
    >
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/baitap')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách</span>
        </button>
      </div>

      {/* Wizard */}
      <AssignmentWizard
        initialData={assignment}
        onSubmit={handleUpdateAssignment}
        onCancel={() => router.push('/admin/baitap')}
        isSubmitting={isSubmitting}
        isEditing={true}
      />
    </PageContainer>
  );
}

export default function EditAssignmentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditAssignmentContent />
    </Suspense>
  );
}
