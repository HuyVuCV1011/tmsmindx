'use client';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/PageContainer';
import { SkeletonTable } from '@/components/skeletons';
import { Edit, List, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface Assignment {
  id: number;
  video_id: number;
  video_title: string;
  assignment_title: string;
  assignment_type: string;
  description: string;
  total_points: number;
  passing_score: number;
  time_limit_minutes: number;
  max_attempts: number;
  is_required: boolean;
  due_date: string;
  status: string;
  question_count: number;
}

export default function AssignmentManagementPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const router = useRouter();

  const [formData, setFormData] = useState({
    video_id: '',
    assignment_title: '',
    assignment_type: 'quiz',
    description: '',
    total_points: '10',
    passing_score: '7',
    time_limit_minutes: '30',
    max_attempts: '3',
    is_required: true,
    due_date: '',
    status: 'published'
  });

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/training-assignments');
      const data = await response.json();
      if (data.success) {
        setAssignments(data.data);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId 
        ? `/api/training-assignments?id=${editingId}` 
        : '/api/training-assignments';
      
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId 
        ? { id: editingId, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.success) {
        toast.success(editingId ? 'Cập nhật assignment thành công!' : 'Tạo assignment thành công!');
        setShowModal(false);
        resetForm();
        fetchAssignments();
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error saving assignment:', err);
      toast.error('Lỗi khi lưu assignment');
    }
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingId(assignment.id);
    setFormData({
      video_id: assignment.video_id.toString(),
      assignment_title: assignment.assignment_title,
      assignment_type: assignment.assignment_type,
      description: assignment.description || '',
      total_points: assignment.total_points.toString(),
      passing_score: assignment.passing_score.toString(),
      time_limit_minutes: assignment.time_limit_minutes?.toString() || '30',
      max_attempts: assignment.max_attempts?.toString() || '3',
      is_required: assignment.is_required,
      due_date: assignment.due_date ? new Date(assignment.due_date).toISOString().split('T')[0] : '',
      status: assignment.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa assignment này?')) return;
    
    try {
      const response = await fetch(`/api/training-assignments?id=${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Xóa assignment thành công!');
        fetchAssignments();
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
      toast.error('Lỗi khi xóa assignment');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      video_id: '',
      assignment_title: '',
      assignment_type: 'quiz',
      description: '',
      total_points: '10',
      passing_score: '7',
      time_limit_minutes: '30',
      max_attempts: '3',
      is_required: true,
      due_date: '',
      status: 'published'
    });
  };

  const handleManageQuestions = (assignmentId: number) => {
    router.push(`/admin/assignment-questions?assignment_id=${assignmentId}`);
  };

  if (loading) {
    return (
      <PageContainer title="Quản lý Assignment" description="Quản lý câu hỏi và bài tập">
        <SkeletonTable />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Quản lý Assignments"
      description="Tạo và quản lý bài tập, quiz cho video đào tạo"
    >
      {/* Create Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-[#a1001f] hover:bg-[#c41230] text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tạo Assignment mới
        </button>
      </div>

      <Card>
        {error ? (
          <div className="text-red-600 text-center py-8">{error}</div>
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={List}
            title="Chưa có assignment"
            description='Nhấn "Tạo Assignment mới" để thêm bài tập cho video'
            action={{
              label: "Tạo Assignment",
              onClick: () => { resetForm(); setShowModal(true); }
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Video</th>
                  <th className="px-3 py-2 text-left font-semibold">Tên Assignment</th>
                  <th className="px-3 py-2 text-left font-semibold">Loại</th>
                  <th className="px-3 py-2 text-center font-semibold">Câu hỏi</th>
                  <th className="px-3 py-2 text-center font-semibold">Điểm</th>
                  <th className="px-3 py-2 text-center font-semibold">Điểm đạt</th>
                  <th className="px-3 py-2 text-center font-semibold">Trạng thái</th>
                  <th className="px-3 py-2 text-center font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.map((assignment, idx) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2 text-xs max-w-xs truncate">{assignment.video_title}</td>
                    <td className="px-3 py-2 font-medium">{assignment.assignment_title}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                        {assignment.assignment_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">{assignment.question_count || 0}</td>
                    <td className="px-3 py-2 text-center font-medium">{assignment.total_points}</td>
                    <td className="px-3 py-2 text-center">{assignment.passing_score}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        assignment.status === 'published' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {assignment.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleManageQuestions(assignment.id)}
                          className="p-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                          title="Quản lý câu hỏi"
                        >
                          <List className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(assignment)}
                          className="p-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          title="Sửa"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(assignment.id)}
                          className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {editingId ? 'Chỉnh sửa Assignment' : 'Tạo Assignment mới'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-sm font-medium">Video ID *</label>
                  <input
                    type="number"
                    required
                    value={formData.video_id}
                    onChange={e => setFormData({...formData, video_id: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">Loại *</label>
                  <select
                    value={formData.assignment_type}
                    onChange={e => setFormData({...formData, assignment_type: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  >
                    <option value="quiz">Quiz</option>
                    <option value="test">Test</option>
                    <option value="exam">Exam</option>
                    <option value="practice">Practice</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Tên Assignment *</label>
                <input
                  type="text"
                  required
                  value={formData.assignment_title}
                  onChange={e => setFormData({...formData, assignment_title: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block mb-1 text-sm font-medium">Điểm tối đa</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_points}
                    onChange={e => setFormData({...formData, total_points: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">Điểm đạt</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.passing_score}
                    onChange={e => setFormData({...formData, passing_score: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">TG (phút)</label>
                  <input
                    type="number"
                    value={formData.time_limit_minutes}
                    onChange={e => setFormData({...formData, time_limit_minutes: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">Số lần</label>
                  <input
                    type="number"
                    value={formData.max_attempts}
                    onChange={e => setFormData({...formData, max_attempts: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-sm font-medium">Hạn nộp</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={e => setFormData({...formData, due_date: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">Trạng thái</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={e => setFormData({...formData, is_required: e.target.checked})}
                  className="mr-2"
                />
                <label className="text-sm">Bắt buộc hoàn thành</label>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#a1001f] hover:bg-[#c41230] text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {editingId ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
