'use client';

import Modal from '@/components/Modal';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

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
  created_at: string;
  updated_at: string;
}

const CAMPUS_LIST = [
  'HCM - 01 Quang Trung',
  'HCM - 01 Tô Ký',
  'HCM - Phan Văn Trị',
  'HCM - 01 Trường Chinh',
  'HCM - 261-263 Phan Xích Long',
  'HCM - 322 Tây Thạnh',
  'HCM - 414 Lũy Bán Bích',
  'HCM - 624 Lạc Long Quân',
  'HCM - Khu Tên Lửa',
  'HCM - 02 Song Hành',
  'HCM - 223 Nguyễn Xí',
  'Thủ Đức - 120-122 Phạm Văn Đồng',
  'Thủ Đức - 99 Lê Văn Việt',
  'HCM - 165-167 Nguyễn Thị Thập',
  'HCM - 343 Phạm Ngũ Lão',
  'HCM - 39 Hải Thượng Lãn Ông',
  'HCM - 618 Đường 3/2',
  'HCM - Phú Mỹ Hưng',
  'Cần Thơ - 153Q Trần Hưng Đạo',
  'Dĩ An - Bình Dương',
  'Đồng Nai - 253 Phạm Văn Thuận',
  'MindX - Online',
  'MindX Digital Art',
  'Thủ Dầu Một - Bình Dương',
  'Vũng Tàu - 205A Lê Hồng Phong',
  'HN - 107 Nguyễn Phong Sắc',
  'HN - 29T1 Hoàng Đạo Thúy',
  'HN - 71 Nguyễn Chí Thanh',
  'HN - A3 VinHomes Gardenia Hàm Nghi',
  'HN - 06 Nguyễn Hữu Thọ',
  'HN - 10 Trần Phú',
  'HN - 505 Minh Khai',
  'HN - 98 Nguyễn Văn Cừ',
  'HN - Văn Phú Victoria',
  'Nghệ An - 67 Đại Lộ Lê Nin',
  'Thanh Hóa - Đại Lộ Lê Lợi',
  'Đà Nẵng - 255-257 Hùng Vương',
  'Bắc Ninh - 09 Lê Thái Tổ',
  'Hải Phòng - 268 Trần Nguyên Hãn',
  'Phú Thọ - 1606A Hùng Vương',
  'Quảng Ninh - 70 Nguyễn Văn Cừ',
  'Thái Nguyên - 04 Hoàng Văn Thụ',
  'Vĩnh Phúc - 01 Trần Phú'
];

const SUBJECT_LIST = [
  '[COD] Scratch',
  '[COD] Web',
  '[COD] ComputerScience',
  '[COD] GameMaker',
  '[COD] AppProducer',
  '[ART] Test chuyên sâu',
  '[ROB] VexIQ',
  '[ROB] VexGo',
  '[Trial] Quy Trình Trai nghiệm'
];

export default function GiaiTrinhPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [explanations, setExplanations] = useState<Explanation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [campusSearch, setCampusSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [showCampusList, setShowCampusList] = useState(false);
  const [showSubjectList, setShowSubjectList] = useState(false);
  const [fetchingTeacher, setFetchingTeacher] = useState(false);
  const [selectedExplanation, setSelectedExplanation] = useState<Explanation | null>(null);
  
  const [formData, setFormData] = useState({
    teacher_name: '',
    lms_code: '',
    email: user?.email || '',
    campus: '',
    subject: '',
    test_date: '',
    reason: ''
  });

  const prefillAssignmentId = searchParams.get('assignment_id');
  const prefillSubject = searchParams.get('subject');
  const prefillCampus = searchParams.get('campus');
  const prefillTestDate = searchParams.get('test_date');

  // Filter campus list based on search
  const filteredCampusList = CAMPUS_LIST.filter(campus =>
    campus.toLowerCase().includes(campusSearch.toLowerCase())
  );

  // Filter subject list based on search
  const filteredSubjectList = SUBJECT_LIST.filter(subject =>
    subject.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  // Close modal when clicking outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setSelectedExplanation(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Fetch teacher info to get LMS code
  const fetchTeacherInfo = async () => {
    if (!user?.email) return;
    
    setFetchingTeacher(true);
    try {
      const response = await fetch(`/api/teachers?email=${encodeURIComponent(user.email)}`);
      const data = await response.json();
      
      if (data.success && data.teacher) {
        const teacher = data.teacher;
        setFormData(prev => ({
          ...prev,
          teacher_name: teacher.name || user.displayName || '',
          lms_code: teacher.code || '',
          email: teacher.emailMindx || user.email
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          teacher_name: user.displayName || '',
          email: user.email
        }));
      }
    } catch (error) {
      console.error('Error fetching teacher info:', error);
      setFormData(prev => ({
        ...prev,
        teacher_name: user.displayName || '',
        email: user.email
      }));
    } finally {
      setFetchingTeacher(false);
    }
  };

  // Fetch danh sách giải trình của user
  const fetchExplanations = async () => {
    try {
      const response = await fetch(`/api/explanations?email=${user?.email}`);
      const data = await response.json();
      if (data.success) {
        setExplanations(data.data);
      }
    } catch (error) {
      console.error('Error fetching explanations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email) {
      fetchExplanations();
      fetchTeacherInfo();
    }
  }, [user]);

  useEffect(() => {
    if (!user?.email || !prefillAssignmentId) return;

    const normalizedDate = prefillTestDate
      ? new Date(prefillTestDate).toISOString().slice(0, 10)
      : '';

    setFormData((prev) => ({
      ...prev,
      campus: prefillCampus || prev.campus,
      subject: prefillSubject || prev.subject,
      test_date: normalizedDate || prev.test_date,
      reason: prev.reason || `Giải trình cho bài thi quá hạn (Assignment #${prefillAssignmentId}).`
    }));
    setCampusSearch(prefillCampus || '');
    setSubjectSearch(prefillSubject || '');
    setShowModal(true);
  }, [user, prefillAssignmentId, prefillSubject, prefillCampus, prefillTestDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/explanations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Gửi giải trình thành công! Email đã được gửi đến bộ phận học vụ.');
        setShowModal(false);
        setCampusSearch('');
        setSubjectSearch('');
        setFormData(prev => ({
          ...prev,
          campus: '',
          subject: '',
          test_date: '',
          reason: ''
        }));
        fetchExplanations();
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (error) {
      console.error('Error submitting explanation:', error);
      toast.error('Có lỗi xảy ra khi gửi giải trình');
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-6 space-y-3 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-96"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </div>
          {/* Table Skeleton */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border rounded-lg animate-pulse">
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
                <div className="w-24 h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="w-full mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Giải Trình Không Tham Gia Kiểm Tra</h1>
            <p className="mt-1 text-sm text-gray-600">Quản lý và theo dõi các giải trình của bạn</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tạo Giải Trình Mới
          </button>
        </div>
      </div>

      {/* Modal Form - Responsive for mobile */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Tạo Giải Trình Mới"
        maxWidth="3xl"
        headerColor="from-blue-600 to-blue-700"
      >
        <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                {/* Row 1: Teacher Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.teacher_name}
                      onChange={(e) => setFormData({ ...formData, teacher_name: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-all"
                      placeholder={fetchingTeacher ? 'Đang tải...' : 'Tên giáo viên'}
                      readOnly={fetchingTeacher}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Mã LMS <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lms_code}
                      onChange={(e) => setFormData({ ...formData, lms_code: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-all"
                      placeholder={fetchingTeacher ? 'Đang tải...' : 'Mã LMS'}
                      readOnly={fetchingTeacher}
                    />
                  </div>
                </div>

                {/* Row 2: Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="email@mindx.edu.vn"
                  />
                </div>

                {/* Row 3: Campus & Subject */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Cơ sở <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={campusSearch || formData.campus}
                      onChange={(e) => {
                        setCampusSearch(e.target.value);
                        setFormData({ ...formData, campus: e.target.value });
                        setShowCampusList(true);
                      }}
                      onFocus={() => setShowCampusList(true)}
                      onBlur={() => setTimeout(() => setShowCampusList(false), 200)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Nhập hoặc chọn cơ sở"
                      autoComplete="off"
                    />
                    {showCampusList && filteredCampusList.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCampusList.map((campus, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setFormData({ ...formData, campus });
                              setCampusSearch(campus);
                              setShowCampusList(false);
                            }}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm transition-colors"
                          >
                            {campus}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Bộ môn <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={subjectSearch || formData.subject}
                      onChange={(e) => {
                        setSubjectSearch(e.target.value);
                        setFormData({ ...formData, subject: e.target.value });
                        setShowSubjectList(true);
                      }}
                      onFocus={() => setShowSubjectList(true)}
                      onBlur={() => setTimeout(() => setShowSubjectList(false), 200)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Nhập hoặc chọn bộ môn"
                      autoComplete="off"
                    />
                    {showSubjectList && filteredSubjectList.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredSubjectList.map((subject, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setFormData({ ...formData, subject });
                              setSubjectSearch(subject);
                              setShowSubjectList(false);
                            }}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm transition-colors"
                          >
                            {subject}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 4: Test Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Ngày kiểm tra <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.test_date}
                    onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                
                {/* Row 5: Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Lý do không tham gia <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    placeholder="Nhập lý do chi tiết về việc không thể tham gia kiểm tra..."
                  />
                </div>
              </div>
              
              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center">
                      <div className="w-4 h-4 bg-white/30 rounded mr-2"></div>
                      Đang gửi...
                    </span>
                  ) : 'Gửi Giải Trình'}
                </button>
              </div>
        </form>
      </Modal>

      {/* Danh sách giải trình - Responsive Cards */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-4 sm:px-6 py-5 border-b border-gray-200 bg-linear-to-r from-gray-50 to-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Danh Sách Giải Trình</h2>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{explanations.length}</span> giải trình
              </p>
            </div>
          </div>
          
          {explanations.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Chưa có giải trình nào</h3>
              <p className="mt-2 text-sm text-gray-600">Bắt đầu bằng cách tạo giải trình mới</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Tạo Giải Trình Mới
              </button>
            </div>
          ) : (
            <div>
              {/* Desktop Table View - Hidden on mobile */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Ngày tạo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Ngày KT</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Cơ sở</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Bộ môn</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {explanations.map((explanation) => (
                      <tr key={explanation.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(explanation.created_at).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(explanation.test_date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-xs truncate">{explanation.campus}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-xs truncate">{explanation.subject}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {getStatusBadge(explanation.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedExplanation(explanation)}
                            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                          >
                            Xem chi tiết →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View - Visible on mobile and tablet */}
              <div className="lg:hidden divide-y divide-gray-200">
                {explanations.map((explanation) => (
                  <div
                    key={explanation.id}
                    onClick={() => setSelectedExplanation(explanation)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{explanation.campus}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{explanation.subject}</p>
                      </div>
                      <div className="ml-3 shrink-0">
                        {getStatusBadge(explanation.status)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">Ngày tạo:</span>
                        <p className="text-gray-900 font-medium mt-0.5">
                          {new Date(explanation.created_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Ngày kiểm tra:</span>
                        <p className="text-gray-900 font-medium mt-0.5">
                          {new Date(explanation.test_date).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center text-xs text-blue-600 font-medium">
                      <span>Xem chi tiết</span>
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal - Mobile Optimized */}
      <Modal
        isOpen={!!selectedExplanation}
        onClose={() => setSelectedExplanation(null)}
        title="Chi Tiết Giải Trình"
        maxWidth="2xl"
        footer={
          <button
            onClick={() => setSelectedExplanation(null)}
            className="w-full sm:w-auto px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Đóng
          </button>
        }
      >
        {selectedExplanation && (
            <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Trạng thái:</span>
                  {getStatusBadge(selectedExplanation.status)}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Họ và tên</p>
                    <p className="text-sm font-medium text-gray-900">{selectedExplanation.teacher_name}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Mã LMS</p>
                    <p className="text-sm font-medium text-gray-900">{selectedExplanation.lms_code}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 sm:col-span-2">
                    <p className="text-xs text-gray-600 mb-1">Email</p>
                    <p className="text-sm font-medium text-gray-900 break-all">{selectedExplanation.email}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Cơ sở</p>
                    <p className="text-sm font-medium text-gray-900">{selectedExplanation.campus}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Bộ môn</p>
                    <p className="text-sm font-medium text-gray-900">{selectedExplanation.subject}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Ngày kiểm tra</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(selectedExplanation.test_date).toLocaleDateString('vi-VN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Ngày tạo</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(selectedExplanation.created_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>

                {/* Reason Section */}
                <div className="pt-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">Lý do không tham gia:</p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedExplanation.reason}</p>
                  </div>
                </div>

                {/* Admin Note */}
                {selectedExplanation.admin_note && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-gray-700 mb-2">Ghi chú từ quản lý:</p>
                    <div className={`border rounded-lg p-4 ${
                      selectedExplanation.status === 'accepted' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedExplanation.admin_note}</p>
                    </div>
                  </div>
                )}
              </div>
        )}
      </Modal>
    </div>
  );
}
