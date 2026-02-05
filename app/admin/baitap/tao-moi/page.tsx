'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { AssignmentWizard } from '@/components/assignments';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateAssignmentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateAssignment = async (assignmentData: any) => {
    try {
      setIsSubmitting(true);

      const response = await fetch('/api/training-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignmentData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Tạo bài tập thành công!');
        // Redirect to question management page
        router.push(`/admin/baitap/${data.data.id}/cau-hoi?assignment_id=${data.data.id}`);
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Lỗi khi tạo bài tập');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer
      title="Tạo bài tập mới"
      description="Tạo bài tập mới với trình hướng dẫn từng bước"
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
        onSubmit={handleCreateAssignment}
        onCancel={() => router.push('/admin/baitap')}
        isSubmitting={isSubmitting}
      />
    </PageContainer>
  );
}
