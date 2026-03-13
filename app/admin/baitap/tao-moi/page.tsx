'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { AssignmentWizard } from '@/components/assignments';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface SubjectOption {
  examType: 'expertise' | 'experience';
  blockCode: string;
  blockLabel: string;
  subjectCode: string;
  subjectName: string;
}

const PROFESSIONAL_SUBJECTS: SubjectOption[] = [
  {
    examType: 'expertise',
    blockCode: 'CODING',
    blockLabel: 'Coding',
    subjectCode: '[COD] Scratch',
    subjectName: '[COD] Scratch',
  },
  {
    examType: 'expertise',
    blockCode: 'CODING',
    blockLabel: 'Coding',
    subjectCode: '[COD] GameMaker',
    subjectName: '[COD] GameMaker',
  },
  {
    examType: 'expertise',
    blockCode: 'CODING',
    blockLabel: 'Coding',
    subjectCode: '[COD] Web',
    subjectName: '[COD] Web',
  },
  {
    examType: 'expertise',
    blockCode: 'CODING',
    blockLabel: 'Coding',
    subjectCode: '[COD] AppProducer',
    subjectName: '[COD] AppProducer',
  },
  {
    examType: 'expertise',
    blockCode: 'CODING',
    blockLabel: 'Coding',
    subjectCode: '[COD] ComputerScience',
    subjectName: '[COD] ComputerScience',
  },
  {
    examType: 'expertise',
    blockCode: 'ROBOTICS',
    blockLabel: 'Robotics',
    subjectCode: '[ROB] VexGo',
    subjectName: '[ROB] VexGo',
  },
  {
    examType: 'expertise',
    blockCode: 'ROBOTICS',
    blockLabel: 'Robotics',
    subjectCode: '[ROB] VexIQ',
    subjectName: '[ROB] VexIQ',
  },
  {
    examType: 'expertise',
    blockCode: 'ART',
    blockLabel: 'Art',
    subjectCode: '[ART] Test chuyên sâu',
    subjectName: '[ART] Test chuyên sâu',
  },
  {
    examType: 'experience',
    blockCode: 'PROCESS',
    blockLabel: 'Kiểm tra quy trình, kỹ năng trải nghiệm',
    subjectCode: '[Trial] Quy Trình Trai nghiệm',
    subjectName: 'Kiểm tra quy trình, kỹ năng trải nghiệm',
  },
];

export default function CreateAssignmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mode = searchParams.get('mode');
  const specialty = searchParams.get('specialty');
  const template = searchParams.get('template');
  const isProfessionalMode = mode === 'professional';

  const [selectedBlockCode, setSelectedBlockCode] = useState<string>('CODING');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('[COD] Scratch');
  const [setName, setSetName] = useState(template || '');
  const [totalPoints, setTotalPoints] = useState(10);
  const [passingScore, setPassingScore] = useState(7);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const blockOptions = Array.from(
    new Map(PROFESSIONAL_SUBJECTS.map((item) => [item.blockCode, item.blockLabel])).entries()
  ).map(([blockCode, blockLabel]) => ({ blockCode, blockLabel }));

  const subjectOptions = PROFESSIONAL_SUBJECTS.filter((item) => item.blockCode === selectedBlockCode);
  const selectedSubject = PROFESSIONAL_SUBJECTS.find(
    (item) => item.blockCode === selectedBlockCode && item.subjectCode === selectedSubjectCode
  );

  const initialData = isProfessionalMode
    ? {
        assignment_title: template || '',
        description: specialty
          ? `Đánh giá chuyên môn: ${specialty}`
          : 'Đánh giá chuyên môn giáo viên',
        assignment_type: 'exam' as const,
      }
    : undefined;

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

  const handleCreateProfessionalExamSet = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSubject) {
      toast.error('Vui lòng chọn môn chuyên môn');
      return;
    }

    if (!setName.trim()) {
      toast.error('Vui lòng nhập tên đề');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/exam-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_type: selectedSubject.examType,
          block_code: selectedSubject.blockCode,
          subject_code: selectedSubject.subjectCode,
          subject_name: selectedSubject.subjectName,
          set_name: setName.trim(),
          total_points: totalPoints,
          passing_score: passingScore,
          status,
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.id) {
        toast.success('Tạo đề kiểm tra chuyên môn thành công!');
        router.push(`/admin/page4/thu-vien-de/questions?set_id=${data.data.id}`);
      } else {
        toast.error('Lỗi: ' + (data.error || 'Không thể tạo đề'));
      }
    } catch (error) {
      console.error('Error creating professional exam set:', error);
      toast.error('Lỗi khi tạo đề kiểm tra chuyên môn');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer
      title={isProfessionalMode ? 'Tạo đề kiểm tra chuyên môn' : 'Tạo bài tập mới'}
      description={
        isProfessionalMode
          ? 'Tạo đề chuyên môn trong luồng assignment, không gắn video đào tạo'
          : 'Tạo bài tập mới với trình hướng dẫn từng bước'
      }
    >
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => router.push(isProfessionalMode ? '/admin/page4/thu-vien-de' : '/admin/baitap')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isProfessionalMode ? 'Quay lại thư viện đề' : 'Quay lại danh sách'}</span>
        </button>
      </div>

      {isProfessionalMode ? (
        <div className="max-w-2xl bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Tạo đề kiểm tra chuyên môn</h2>
          <form onSubmit={handleCreateProfessionalExamSet} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Khối</label>
              <select
                value={selectedBlockCode}
                onChange={(e) => {
                  const nextBlock = e.target.value;
                  setSelectedBlockCode(nextBlock);
                  const firstSubject = PROFESSIONAL_SUBJECTS.find((item) => item.blockCode === nextBlock);
                  if (firstSubject) {
                    setSelectedSubjectCode(firstSubject.subjectCode);
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {blockOptions.map((block) => (
                  <option key={block.blockCode} value={block.blockCode}>
                    {block.blockLabel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Môn</label>
              <select
                value={selectedSubjectCode}
                onChange={(e) => setSelectedSubjectCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {subjectOptions.map((subject) => (
                  <option key={subject.subjectCode} value={subject.subjectCode}>
                    {subject.subjectName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên đề</label>
              <input
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="Nhập tên bộ đề"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tổng điểm</label>
                <input
                  type="number"
                  min={1}
                  value={totalPoints}
                  onChange={(e) => setTotalPoints(Number(e.target.value || 10))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Điểm đạt</label>
                <input
                  type="number"
                  min={0}
                  value={passingScore}
                  onChange={(e) => setPassingScore(Number(e.target.value || 7))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#a1001f] text-white hover:bg-[#8a0019] text-sm font-medium disabled:bg-gray-400"
            >
              <PlusCircle className="h-4 w-4" />
              {isSubmitting ? 'Đang tạo...' : 'Tạo đề và thêm câu hỏi'}
            </button>
          </form>
        </div>
      ) : (
        <AssignmentWizard
          onSubmit={handleCreateAssignment}
          onCancel={() => router.push('/admin/baitap')}
          initialData={initialData}
          isSubmitting={isSubmitting}
        />
      )}
    </PageContainer>
  );
}
