'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
        alert(editingId ? 'Cập nhật assignment thành công!' : 'Tạo assignment thành công!');
        setShowModal(false);
        resetForm();
        fetchAssignments();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error saving assignment:', err);
      alert('Lỗi khi lưu assignment');
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
        alert('Xóa assignment thành công!');
        fetchAssignments();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
      alert('Lỗi khi xóa assignment');
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Quản lý Assignments</h1>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            + Tạo Assignment mới
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">Đang tải dữ liệu...</div>
        ) : error ? (
          <div className="text-red-500 text-center py-12">{error}</div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Video</th>
                  <th className="px-4 py-3 text-left">Tên Assignment</th>
                  <th className="px-4 py-3 text-left">Loại</th>
                  <th className="px-4 py-3 text-center">Số câu hỏi</th>
                  <th className="px-4 py-3 text-center">Điểm tối đa</th>
                  <th className="px-4 py-3 text-center">Điểm đạt</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      Chưa có assignment nào. Nhấn "Tạo Assignment mới" để bắt đầu.
                    </td>
                  </tr>
                ) : (
                  assignments.map((assignment, idx) => (
                    <tr key={assignment.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm">{assignment.video_title}</td>
                      <td className="px-4 py-3 font-medium">{assignment.assignment_title}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {assignment.assignment_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{assignment.question_count || 0}</td>
                      <td className="px-4 py-3 text-center">{assignment.total_points}</td>
                      <td className="px-4 py-3 text-center">{assignment.passing_score}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-sm ${
                          assignment.status === 'published' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {assignment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleManageQuestions(assignment.id)}
                            className="px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm"
                          >
                            Câu hỏi
                          </button>
                          <button
                            onClick={() => handleEdit(assignment)}
                            className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(assignment.id)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">
                  {editingId ? 'Chỉnh sửa Assignment' : 'Tạo Assignment mới'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 font-medium">Video ID *</label>
                      <input
                        type="number"
                        required
                        value={formData.video_id}
                        onChange={e => setFormData({...formData, video_id: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium">Loại *</label>
                      <select
                        value={formData.assignment_type}
                        onChange={e => setFormData({...formData, assignment_type: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="quiz">Quiz</option>
                        <option value="test">Test</option>
                        <option value="exam">Exam</option>
                        <option value="practice">Practice</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 font-medium">Tên Assignment *</label>
                    <input
                      type="text"
                      required
                      value={formData.assignment_title}
                      onChange={e => setFormData({...formData, assignment_title: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 font-medium">Mô tả</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block mb-1 font-medium">Điểm tối đa</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.total_points}
                        onChange={e => setFormData({...formData, total_points: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium">Điểm đạt</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.passing_score}
                        onChange={e => setFormData({...formData, passing_score: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium">Thời gian (phút)</label>
                      <input
                        type="number"
                        value={formData.time_limit_minutes}
                        onChange={e => setFormData({...formData, time_limit_minutes: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium">Số lần làm</label>
                      <input
                        type="number"
                        value={formData.max_attempts}
                        onChange={e => setFormData({...formData, max_attempts: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 font-medium">Hạn nộp</label>
                      <input
                        type="date"
                        value={formData.due_date}
                        onChange={e => setFormData({...formData, due_date: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium">Trạng thái</label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value})}
                        className="w-full border rounded px-3 py-2"
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
                    <label>Bắt buộc hoàn thành</label>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); resetForm(); }}
                      className="px-4 py-2 border rounded hover:bg-gray-100"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {editingId ? 'Cập nhật' : 'Tạo mới'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
