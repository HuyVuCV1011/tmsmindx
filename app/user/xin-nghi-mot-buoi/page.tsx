'use client';

import Modal from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { StepItem, Stepper } from '@/components/ui/stepper';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { findMatchingCampus } from '@/lib/campus-data';
import { useTeacher } from '@/lib/teacher-context';
import { FileText, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

interface LeaveRequest {
  id: number;
  teacher_name: string;
  lms_code: string;
  email: string;
  campus: string;
  leave_date: string;
  reason: string;
  class_code?: string;
  student_count?: string;
  class_time?: string;
  leave_session?: string;
  has_substitute: boolean;
  substitute_teacher?: string;
  substitute_email?: string;
  class_status?: string;
  email_subject?: string;
  email_body?: string;
  status: 'pending_admin' | 'approved_unassigned' | 'approved_assigned' | 'rejected' | 'substitute_confirmed';
  admin_note?: string;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = 'teacher_leave_request_auto_fill_data';
const NORTH_CAMPUS_KEYWORDS = ['ha noi', 'hanoi', 'bac', 'hai phong', 'quang ninh', 'thai nguyen', 'nam dinh'];

function getStatusLabel(status: LeaveRequest['status']) {
  switch (status) {
    case 'pending_admin':
      return 'Chờ TC/Leader duyệt';
    case 'approved_unassigned':
      return 'Đã duyệt - chờ phân giáo viên thay';
    case 'approved_assigned':
      return 'Đã gửi cho giáo viên thay thế';
    case 'substitute_confirmed':
      return 'Giáo viên thay thế đã xác nhận';
    case 'rejected':
      return 'Từ chối';
    default:
      return status;
  }
}

function getWorkflowSteps(status: LeaveRequest['status']): StepItem[] {
  const step1: StepItem = { id: 1, label: 'Gửi mail xin nghỉ', status: 'completed' };

  let step2Status: StepItem['status'] = 'current';
  let step3Status: StepItem['status'] = 'upcoming';
  let step4Status: StepItem['status'] = 'upcoming';

  if (status === 'rejected') {
    step2Status = 'error';
    step3Status = 'upcoming';
    step4Status = 'error';
  } else if (status === 'approved_unassigned') {
    step2Status = 'success';
    step3Status = 'current';
  } else if (status === 'approved_assigned') {
    step2Status = 'success';
    step3Status = 'current';
  } else if (status === 'substitute_confirmed') {
    step2Status = 'success';
    step3Status = 'success';
    step4Status = 'success';
  }

  return [
    step1,
    { id: 2, label: 'TC/Leader duyệt', status: step2Status },
    { id: 3, label: 'GV thay thế xác nhận', status: step3Status },
    { id: 4, label: 'Hoàn tất quy trình', status: step4Status }
  ];
}

export default function XinNghiMotBuoiPage() {
  const { user } = useAuth();
  const { teacherProfile, isLoading: isTeacherLoading } = useTeacher();

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  const [formData, setFormData] = useState({
    teacher_name: '',
    lms_code: '',
    email: user?.email || '',
    campus: '',
    leave_date: '',
    reason: '',
    class_code: '',
    student_count: '',
    class_time: '',
    leave_session: '',
    has_substitute: false,
    substitute_teacher: '',
    substitute_email: '',
    class_status: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      setFormData((prev) => ({ ...prev, ...parsed }));
    } catch (error) {
      console.error('Error loading leave request cache', error);
    }
  }, []);

  useEffect(() => {
    if (!teacherProfile) {
      setFormData((prev) => ({ ...prev, email: prev.email || user?.email || '' }));
      return;
    }

    const teacherBranch = teacherProfile.branchIn || teacherProfile.branchCurrent || '';
    const matchedCampus = findMatchingCampus(teacherBranch);

    setFormData((prev) => {
      const updated = {
        ...prev,
        teacher_name: teacherProfile.name || prev.teacher_name || '',
        lms_code: teacherProfile.code || prev.lms_code || '',
        email: teacherProfile.emailMindx || teacherProfile.emailPersonal || prev.email || user?.email || '',
        campus: matchedCampus || prev.campus || ''
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          teacher_name: updated.teacher_name,
          lms_code: updated.lms_code,
          email: updated.email,
          campus: updated.campus
        })
      );

      return updated;
    });
  }, [teacherProfile, user?.email]);

  const fetchLeaveRequests = async () => {
    if (!user?.email) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/leave-requests?email=${encodeURIComponent(user.email)}`);
      const data = await response.json();

      if (data.success) {
        setLeaveRequests(data.data);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email) {
      fetchLeaveRequests();
    }
  }, [user?.email]);

  const inferredRegion = useMemo(() => {
    const normalizedCampus = formData.campus.toLowerCase();
    const isNorthernCampus = NORTH_CAMPUS_KEYWORDS.some((keyword) => normalizedCampus.includes(keyword));
    return isNorthernCampus ? 'mien_bac' : 'mien_nam';
  }, [formData.campus]);

  const hasSubstitute = formData.has_substitute && formData.substitute_teacher.trim().length > 0;

  const toLine =
    inferredRegion === 'mien_nam' ? 'TC/TE, CS cơ sở xin nghỉ' : 'TC/TE, TC, CS cơ sở xin nghỉ';
  const ccLine = 'Leader, TEGL';

  const subjectLine = `[MindX - ${formData.campus || 'Tên Cơ Sở'}] V/v xin nghỉ 1 buổi dạy`;

  const leaveDateDisplay = useMemo(() => {
    if (!formData.leave_date) return '[ngày/tháng/năm]';
    return new Date(formData.leave_date).toLocaleDateString('vi-VN');
  }, [formData.leave_date]);

  const emailBody = useMemo(() => {
    return `Kính gửi:

Em là ${formData.teacher_name || '[Họ tên giáo viên đầy đủ]'} hiện đang là giáo viên tại cơ sở ${formData.campus || '[Tên Cơ Sở]'}, hôm nay em viết email này xin được nghỉ vào ngày ${leaveDateDisplay}.

Vì lý do ${formData.reason || '[nêu lý do]'}. 

Thông tin lớp học cụ thể như sau:

Mã lớp: ${formData.class_code || '[Mã lớp học]'}. 
Số học viên: ${formData.student_count || '[Số lượng học viên của lớp]'}. 
Thời gian học: ${formData.class_time || '[Giờ Thứ, Ngày]'}. 
Buổi học: ${formData.leave_session || '[Buổi học xin nghỉ]'}. 
Giáo viên thay thế: ${formData.has_substitute ? formData.substitute_teacher || '[Nhập tên giáo viên thay thế]' : ''}. 
Tình hình lớp học: ${formData.class_status || '[Nêu tình hình của lớp, có học viên nào cần lưu ý hay đặc biệt không]'}. 

${hasSubstitute
  ? 'Trên đây là thông tin lớp mà em xin nghỉ, mong phía chuyên môn cơ sở xem xét và xác nhận giúp em. Em xin cảm ơn!'
  : 'Trên đây là thông tin lớp mà em xin nghỉ, vì chưa tìm được giáo viên thay nên em nhờ phía chuyên môn hỗ trợ tìm giáo viên giúp em cho buổi học trên. Em xin cảm ơn!'}

Trân trọng,

${formData.teacher_name || '[Họ Và Tên]'}`;
  }, [
    formData.teacher_name,
    formData.campus,
    formData.reason,
    formData.class_code,
    formData.student_count,
    formData.class_time,
    formData.leave_session,
    formData.class_status,
    formData.has_substitute,
    formData.substitute_teacher,
    hasSubstitute,
    leaveDateDisplay
  ]);

  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetFormForNew = () => {
    setFormData((prev) => ({
      ...prev,
      leave_date: '',
      reason: '',
      class_code: '',
      student_count: '',
      class_time: '',
      leave_session: '',
      has_substitute: false,
      substitute_teacher: '',
      substitute_email: '',
      class_status: ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email_subject: subjectLine,
          email_body: emailBody,
          substitute_teacher: formData.has_substitute ? formData.substitute_teacher : '',
          substitute_email: formData.has_substitute ? formData.substitute_email : ''
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Tạo mail xin nghỉ thành công. Yêu cầu đã vào quy trình duyệt.');
        setShowModal(false);
        resetFormForNew();
        fetchLeaveRequests();
      } else {
        toast.error(`Lỗi: ${data.error}`);
      }
    } catch (error) {
      console.error('Error creating leave request:', error);
      toast.error('Có lỗi xảy ra khi tạo yêu cầu xin nghỉ');
    } finally {
      setSubmitting(false);
    }
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Đã copy ${label}`);
    } catch {
      toast.error(`Không thể copy ${label}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
          <div className="h-24 animate-pulse rounded bg-gray-100" />
          <div className="h-96 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Yêu Cầu Xin Nghỉ 1 Buổi"
          description="Bấm tạo yêu cầu để gửi yêu cầu, sau đó theo dõi tiến trình 4 bước."
          actions={
            <Button
              size="lg"
              onClick={() => {
                resetFormForNew();
                setShowModal(true);
              }}
              className="whitespace-nowrap border-2 border-[#a1001f] bg-[#a1001f] text-white shadow-md hover:bg-[#8a001a]"
            >
              <Plus className="mr-2 h-5 w-5" />
              Tạo yêu cầu xin nghỉ
            </Button>
          }
        />

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="min-w-0 text-lg font-semibold text-gray-900">Danh sách yêu cầu xin nghỉ</h2>
              <p className="shrink-0 whitespace-nowrap text-sm text-gray-600">Tổng: {leaveRequests.length} yêu cầu</p>
            </div>
          </div>

          {leaveRequests.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <FileText className="mx-auto h-16 w-16 text-gray-400" strokeWidth={1.5} />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Chưa có yêu cầu xin nghỉ nào</h3>
              <p className="mt-2 text-sm text-gray-600">Bắt đầu bằng cách tạo yêu cầu xin nghỉ mới</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead>Ngày nghỉ</TableHead>
                      <TableHead>Cơ sở</TableHead>
                      <TableHead>Mã lớp</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-blue-50"
                        onClick={() => setSelectedRequest(item)}
                      >
                        <TableCell>{new Date(item.created_at).toLocaleDateString('vi-VN')}</TableCell>
                        <TableCell>{new Date(item.leave_date).toLocaleDateString('vi-VN')}</TableCell>
                        <TableCell>{item.campus}</TableCell>
                        <TableCell>{item.class_code || '-'}</TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-gray-700">{getStatusLabel(item.status)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-gray-200 lg:hidden">
                {leaveRequests.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full p-4 text-left hover:bg-gray-50"
                    onClick={() => setSelectedRequest(item)}
                  >
                    <p className="text-sm font-semibold text-gray-900">{item.campus}</p>
                    <p className="text-xs text-gray-600 mt-1">Ngày nghỉ: {new Date(item.leave_date).toLocaleDateString('vi-VN')}</p>
                    <p className="text-xs text-[#a1001f] mt-1">{getStatusLabel(item.status)}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Tạo mail xin nghỉ 1 buổi"
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Quy định nhanh</p>
            <p className="mt-1">Giáo viên cần báo nghỉ trước ít nhất 72 giờ, tối đa 2 buổi/học phần và phải được TC/Leader xác nhận.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Họ và tên *</label>
              <input
                required
                type="text"
                value={formData.teacher_name}
                onChange={(e) => handleChange('teacher_name', e.target.value)}
                placeholder={isTeacherLoading ? 'Đang tải...' : 'Họ tên giáo viên'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Mã LMS *</label>
              <input
                required
                type="text"
                value={formData.lms_code}
                onChange={(e) => handleChange('lms_code', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email *</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Cơ sở *</label>
              <input
                required
                type="text"
                value={formData.campus}
                onChange={(e) => handleChange('campus', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Ngày xin nghỉ *</label>
              <input
                required
                type="date"
                value={formData.leave_date}
                onChange={(e) => handleChange('leave_date', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Lý do xin nghỉ *</label>
              <textarea
                required
                rows={3}
                value={formData.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Mã lớp</label>
              <input
                type="text"
                value={formData.class_code}
                onChange={(e) => handleChange('class_code', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Số học viên</label>
              <input
                type="text"
                value={formData.student_count}
                onChange={(e) => handleChange('student_count', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Thời gian học</label>
              <input
                type="text"
                value={formData.class_time}
                onChange={(e) => handleChange('class_time', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Buổi học xin nghỉ</label>
              <input
                type="text"
                value={formData.leave_session}
                onChange={(e) => handleChange('leave_session', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.has_substitute}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    handleChange('has_substitute', checked);
                    if (!checked) {
                      handleChange('substitute_teacher', '');
                      handleChange('substitute_email', '');
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Giáo viên thay thế (tích nếu có)
              </label>
            </div>
            {formData.has_substitute && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Tên giáo viên thay thế</label>
                  <input
                    type="text"
                    value={formData.substitute_teacher}
                    onChange={(e) => handleChange('substitute_teacher', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Email giáo viên thay thế</label>
                  <input
                    type="email"
                    value={formData.substitute_email}
                    onChange={(e) => handleChange('substitute_email', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Tình hình lớp học</label>
              <textarea
                rows={3}
                value={formData.class_status}
                onChange={(e) => handleChange('class_status', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">Mẫu mail sẽ gửi</p>
              <Button type="button" size="sm" variant="outline" onClick={() => copyText('nội dung mail', emailBody)}>
                Copy nội dung
              </Button>
            </div>
            <p className="text-sm"><span className="font-medium">To:</span> {toLine}</p>
            <p className="text-sm"><span className="font-medium">CC:</span> {ccLine}</p>
            <p className="text-sm"><span className="font-medium">Tiêu đề:</span> {subjectLine}</p>
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-700">{emailBody}</pre>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Đang tạo...' : 'Gửi mail và tạo yêu cầu'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest ? `Chi tiết yêu cầu #${selectedRequest.id}` : 'Chi tiết yêu cầu'}
        maxWidth="3xl"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <Stepper steps={getWorkflowSteps(selectedRequest.status)} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Giáo viên</p>
                <p className="text-sm font-medium text-gray-900">{selectedRequest.teacher_name}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Mã LMS</p>
                <p className="text-sm font-medium text-gray-900">{selectedRequest.lms_code}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Ngày nghỉ</p>
                <p className="text-sm font-medium text-gray-900">{new Date(selectedRequest.leave_date).toLocaleDateString('vi-VN')}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Trạng thái</p>
                <p className="text-sm font-medium text-gray-900">{getStatusLabel(selectedRequest.status)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                <p className="text-xs text-gray-600">Lý do</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedRequest.reason}</p>
              </div>
              {selectedRequest.admin_note && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
                  <p className="text-xs text-amber-800">Ghi chú từ TC/Leader</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{selectedRequest.admin_note}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
