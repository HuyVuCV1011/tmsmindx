'use client';

import { PageContainer } from '@/components/PageContainer';
import { AssignmentPreview, QuestionBuilder, QuestionList } from '@/components/assignments';
import { Question } from '@/types/assignment';
import { ArrowLeft, Download, Eye, FileText, HelpCircle, Upload } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

type DbDifficulty = 'easy' | 'medium' | 'hard';

interface AssignmentQuestionRequestPayload {
  assignment_id: number;
  question_text: string;
  question_type: Question['question_type'];
  correct_answer: string;
  options: string[] | null;
  image_url: string | null;
  explanation: string;
  points: number;
  order_number: number;
  difficulty: DbDifficulty;
}

const mapDifficultyToDb = (difficulty?: Question['difficulty'] | string): DbDifficulty => {
  switch (difficulty) {
    case 'easy':
      return 'easy';
    case 'hard':
      return 'hard';
    case 'medium':
    default:
      return 'medium';
  }
};

function AssignmentQuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignment_id');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [assignmentInfo, setAssignmentInfo] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportGuide, setShowImportGuide] = useState(false);

  useEffect(() => {
    if (assignmentId) {
      fetchQuestions();
      fetchAssignmentInfo();
    }
  }, [assignmentId]);

  const fetchAssignmentInfo = async () => {
    try {
      const response = await fetch(`/api/training-assignments?id=${assignmentId}`);
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        setAssignmentInfo(data.data[0]);
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/training-assignment-questions?assignment_id=${assignmentId}`);
      const data = await response.json();
      if (data.success) {
        setQuestions(data.data);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Lỗi tải câu hỏi');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async (questionData: Partial<Question>) => {
    try {
      const isEditing = editingQuestion?.id;
      const method = isEditing ? 'PUT' : 'POST';
      const questionText = (questionData.question_text || '').trim();
      const questionType: Question['question_type'] = questionData.question_type || 'multiple_choice';
      const normalizedOptions = Array.isArray(questionData.options)
        ? questionData.options.map((option) => option.trim()).filter(Boolean)
        : null;
      let correctAnswer = String(questionData.correct_answer || '').trim();

      if (!questionText) {
        toast.error('Vui lòng nhập câu hỏi');
        return;
      }

      if (questionType === 'multiple_choice') {
        if (!normalizedOptions || normalizedOptions.length < 2) {
          toast.error('Câu hỏi trắc nghiệm cần ít nhất 2 đáp án');
          return;
        }

        if (!correctAnswer) {
          toast.error('Vui lòng chọn đáp án đúng');
          return;
        }

        if (!normalizedOptions.includes(correctAnswer)) {
          const indexAnswer = Number.parseInt(correctAnswer, 10);
          if (!Number.isNaN(indexAnswer) && indexAnswer >= 0 && indexAnswer < normalizedOptions.length) {
            correctAnswer = normalizedOptions[indexAnswer];
          } else {
            toast.error('Đáp án đúng phải khớp với một trong các đáp án');
            return;
          }
        }
      }

      const payload: AssignmentQuestionRequestPayload = {
        assignment_id: Number(assignmentId),
        question_text: questionText,
        question_type: questionType,
        correct_answer: correctAnswer,
        options: questionType === 'multiple_choice' || questionType === 'true_false'
          ? normalizedOptions
          : null,
        image_url: questionData.image_url || null,
        explanation: questionData.explanation || '',
        points: Number(questionData.points || 1),
        order_number: isEditing ? editingQuestion.order_number : questions.length + 1,
        difficulty: mapDifficultyToDb(questionData.difficulty)
      };
      
      const requestPayload = isEditing
        ? { ...payload, id: editingQuestion.id }
        : payload;

      const response = await fetch('/api/training-assignment-questions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      const data = await response.json();
      if (data.success) {
        toast.success(isEditing ? 'Cập nhật câu hỏi thành công!' : 'Tạo câu hỏi thành công!');
        setShowBuilder(false);
        setEditingQuestion(null);
        fetchQuestions();
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Lỗi khi lưu câu hỏi');
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    try {
      const response = await fetch(`/api/training-assignment-questions?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Xóa câu hỏi thành công!');
        fetchQuestions();
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Lỗi khi xóa câu hỏi');
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setShowBuilder(true);
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setShowBuilder(true);
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/training-assignment-questions/export?assignment_id=${assignmentId}`);
      
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Lỗi khi export');
        return;
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cau_hoi_bai_tap_${assignmentId}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Export thành công!');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Lỗi khi export câu hỏi');
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Vui lòng chọn file CSV');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('assignment_id', assignmentId!);

    try {
      setImporting(true);
      const response = await fetch('/api/training-assignment-questions/import', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message || `Import thành công ${data.imported} câu hỏi!`);
        
        // Show errors if any
        if (data.errors && data.errors.length > 0) {
          console.warn('Import errors:', data.errors);
          toast.error(`Có ${data.errors.length} lỗi. Xem console để biết chi tiết.`);
        }
        
        fetchQuestions();
      } else {
        toast.error(data.error || 'Lỗi khi import');
      }
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Lỗi khi import câu hỏi');
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/training-assignment-questions/template');
      
      if (!response.ok) {
        toast.error('Lỗi khi tải file mẫu');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mau_cau_hoi_bai_tap.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Tải file mẫu thành công!');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Lỗi khi tải file mẫu');
    }
  };

  if (!assignmentId) {
    return (
      <PageContainer title="Quản lý câu hỏi">
        <div className="text-center py-12">
          <p className="text-red-600">Không tìm thấy bài tập</p>
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer title="Quản lý câu hỏi">
        <div className="animate-pulse space-y-6 p-6">
          <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="h-32 bg-gray-300 rounded"></div>
            <div className="h-32 bg-gray-300 rounded"></div>
            <div className="h-32 bg-gray-300 rounded"></div>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={assignmentInfo?.assignment_title || 'Quản lý câu hỏi'}
      description={`Bài tập: ${assignmentInfo?.video_title || ''}`}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/admin/assignments')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Import/Export Section */}
          <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
            {/* Download Template */}
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
              title="Tải file mẫu CSV"
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">File mẫu</span>
            </button>

            {/* Import Guide */}
            <button
              onClick={() => setShowImportGuide(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
              title="Hướng dẫn import"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="text-sm font-medium hidden lg:inline">Hướng dẫn</span>
            </button>

            {/* Import */}
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              <span className="text-sm font-medium">{importing ? 'Đang import...' : 'Import'}</span>
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={questions.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={questions.length === 0 ? 'Chưa có câu hỏi để export' : 'Export câu hỏi ra file CSV'}
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export</span>
            </button>
          </div>
          
          {/* Preview */}
          <button
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <Eye className="w-4 h-4" />
            <span className="font-medium">Xem trước</span>
          </button>
        </div>
      </div>

      {/* Questions List */}
      <QuestionList
        questions={questions}
        onAddQuestion={handleAddQuestion}
        onEditQuestion={handleEditQuestion}
        onDeleteQuestion={handleDeleteQuestion}
      />

      {/* Question Builder Modal */}
      {showBuilder && (
        <QuestionBuilder
          onSave={handleSaveQuestion}
          onCancel={() => {
            setShowBuilder(false);
            setEditingQuestion(null);
          }}
          initialData={editingQuestion || undefined}
          assignmentId={Number(assignmentId)}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && assignmentInfo && (
        <AssignmentPreview
          assignment={assignmentInfo}
          questions={questions}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      {/* Import Guide Modal */}
      {showImportGuide && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">📋 Hướng dẫn Import Câu hỏi</h2>
              <button
                onClick={() => setShowImportGuide(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Quick Start */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">🚀 Bắt đầu nhanh</h3>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Click <strong>"Tải file mẫu"</strong> để download file CSV mẫu</li>
                  <li>Mở file bằng Excel hoặc Google Sheets</li>
                  <li>Thêm câu hỏi của bạn (giữ nguyên dòng header)</li>
                  <li>Lưu file dạng CSV (UTF-8)</li>
                  <li>Click <strong>"Import CSV"</strong> và chọn file vừa tạo</li>
                </ol>
              </div>

              {/* Question Types */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">🎯 Các loại câu hỏi</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">multiple_choice - Trắc nghiệm</h4>
                    <p className="text-sm text-gray-600 mb-2">Câu hỏi có nhiều lựa chọn, chỉ 1 đáp án đúng</p>
                    <div className="bg-gray-50 p-2 rounded text-xs font-mono overflow-x-auto">
                      options: "Đáp án A|Đáp án B|Đáp án C|Đáp án D"
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">true_false - Đúng/Sai</h4>
                    <p className="text-sm text-gray-600 mb-2">Câu hỏi đúng hoặc sai</p>
                    <div className="bg-gray-50 p-2 rounded text-xs font-mono overflow-x-auto">
                      options: "Đúng|Sai"<br />
                      correct_answer: "Đúng" hoặc "Sai"
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">short_answer - Trả lời ngắn</h4>
                    <p className="text-sm text-gray-600 mb-2">Câu hỏi yêu cầu trả lời văn bản ngắn</p>
                    <div className="bg-gray-50 p-2 rounded text-xs font-mono overflow-x-auto">
                      options: (để trống)
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">essay - Tự luận</h4>
                    <p className="text-sm text-gray-600 mb-2">Câu hỏi yêu cầu trả lời chi tiết</p>
                    <div className="bg-gray-50 p-2 rounded text-xs font-mono overflow-x-auto">
                      options: (để trống)<br />
                      correct_answer: (có thể để trống)
                    </div>
                  </div>
                </div>
              </div>

              {/* Important Notes */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">⚠️ Lưu ý quan trọng</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-gray-700"><strong>Dấu phân cách options:</strong> Sử dụng dấu <code className="bg-gray-100 px-1 rounded">|</code> (pipe) để phân tách các đáp án</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-gray-700"><strong>Encoding:</strong> Lưu file CSV với UTF-8 (có BOM) để hiển thị tiếng Việt đúng</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-gray-700"><strong>Độ khó:</strong> Chỉ dùng <code className="bg-gray-100 px-1 rounded">easy</code>, <code className="bg-gray-100 px-1 rounded">medium</code>, <code className="bg-gray-100 px-1 rounded">hard</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-gray-700"><strong>Đáp án đúng:</strong> Phải khớp chính xác với một trong các options (với trắc nghiệm)</span>
                  </li>
                </ul>
              </div>

              {/* Example */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">📝 Ví dụ</h3>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs">
{`question_text,question_type,correct_answer,options,points,difficulty,explanation,image_url
"Python là gì?",multiple_choice,"Ngôn ngữ thông dịch","Ngôn ngữ thông dịch|Ngôn ngữ biên dịch|Ngôn ngữ máy",1,easy,"Python là ngôn ngữ thông dịch",
"JS chỉ chạy trên browser",true_false,"Sai","Đúng|Sai",1,medium,"JS có thể chạy trên Node.js",
"HTML là viết tắt của gì?",short_answer,"HyperText Markup Language",,2,easy,"",`}
                  </pre>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  <span>Tải file mẫu</span>
                </button>
                <button
                  onClick={() => setShowImportGuide(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default function AssignmentQuestionsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AssignmentQuestionsContent />
    </Suspense>
  );
}
