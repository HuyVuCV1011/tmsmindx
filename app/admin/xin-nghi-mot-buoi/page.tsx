'use client';

import Modal from '@/components/Modal';
import { Tabs } from '@/components/Tabs';
import { Button } from '@/components/ui/button';
import { Stepper, StepItem } from '@/components/ui/stepper';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
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
  status: 'pending_admin' | 'approved_unassigned' | 'approved_assigned' | 'rejected' | 'substitute_confirmed';
  admin_note?: string;
  created_at: string;
}

function getWorkflowSteps(status: LeaveRequest['status']): StepItem[] {
  const step1: StepItem = { id: 1, label: 'Gửi mail xin nghỉ', status: 'completed' };

  let step2Status: StepItem['status'] = 'current';
  let step3Status: StepItem['status'] = 'upcoming';
  let step4Status: StepItem['status'] = 'upcoming';

  if (status === 'rejected') {
    step2Status = 'error';
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
    { id: 4, label: 'Hoàn tất', status: step4Status }
  ];
}

function statusLabel(status: LeaveRequest['status']) {
  switch (status) {
    case 'pending_admin':
      return 'Chờ duyệt';
    case 'approved_unassigned':
      return 'Đã duyệt - chưa có GV thay';
    case 'approved_assigned':
      return 'Đã gửi cho GV thay';
    case 'substitute_confirmed':
      return 'GV thay đã xác nhận';
    case 'rejected':
      return 'Đã từ chối';
    default:
      return status;
  }
}

export default function AdminXinNghiMotBuoiPage() {
  const { user } = useAuth();

  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [substituteTeacher, setSubstituteTeacher] = useState('');
  const [substituteEmail, setSubstituteEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leave-requests?mode=admin');
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter((item) => item.status === activeTab);
  }, [items, activeTab]);

  const tabs = [
    { id: 'all', label: 'Tất cả', count: items.length },
    { id: 'pending_admin', label: 'Chờ duyệt', count: items.filter((i) => i.status === 'pending_admin').length },
    { id: 'approved_unassigned', label: 'Chưa có GV thay', count: items.filter((i) => i.status === 'approved_unassigned').length },
    { id: 'approved_assigned', label: 'Đã gửi GV thay', count: items.filter((i) => i.status === 'approved_assigned').length },
    { id: 'substitute_confirmed', label: 'Đã hoàn tất', count: items.filter((i) => i.status === 'substitute_confirmed').length },
    { id: 'rejected', label: 'Từ chối', count: items.filter((i) => i.status === 'rejected').length }
  ];

  const openDetail = (item: LeaveRequest) => {
    setSelected(item);
    setAdminNote(item.admin_note || '');
    setSubstituteTeacher(item.substitute_teacher || '');
    setSubstituteEmail(item.substitute_email || '');
  };

  const submitAdminReview = async (decision: 'approved' | 'rejected') => {
    if (!selected) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_review',
          id: selected.id,
          decision,
          admin_note: adminNote,
          admin_email: user?.email,
          admin_name: user?.displayName || user?.email,
          substitute_teacher: substituteTeacher,
          substitute_email: substituteEmail
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(decision === 'approved' ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu');
        setSelected(null);
        fetchData();
      } else {
        toast.error(data.error || 'Không thể cập nhật');
      }
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi cập nhật');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAssignSubstitute = async () => {
    if (!selected) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_substitute',
          id: selected.id,
          substitute_teacher: substituteTeacher,
          substitute_email: substituteEmail,
          admin_email: user?.email,
          admin_name: user?.displayName || user?.email
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Đã phân giáo viên thay thế');
        setSelected(null);
        fetchData();
      } else {
        toast.error(data.error || 'Không thể phân giáo viên thay thế');
      }
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi cập nhật');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen p-6">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Tiếp nhận xin nghỉ 1 buổi</h1>
          <p className="mt-1 text-sm text-gray-600">Step 2: TC/Leader duyệt yêu cầu và phân giáo viên thay thế khi cần.</p>
        </div>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày tạo</TableHead>
                <TableHead>Giáo viên</TableHead>
                <TableHead>Cơ sở</TableHead>
                <TableHead>Ngày nghỉ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{new Date(item.created_at).toLocaleDateString('vi-VN')}</TableCell>
                  <TableCell>{item.teacher_name}</TableCell>
                  <TableCell>{item.campus}</TableCell>
                  <TableCell>{new Date(item.leave_date).toLocaleDateString('vi-VN')}</TableCell>
                  <TableCell>{statusLabel(item.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openDetail(item)}>
                      Xem / Duyệt
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredItems.length === 0 && <div className="p-8 text-center text-sm text-gray-600">Không có dữ liệu ở tab này.</div>}
        </div>
      </div>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Yêu cầu #${selected.id}` : 'Chi tiết yêu cầu'}
        maxWidth="3xl"
      >
        {selected && (
          <div className="space-y-4">
            <Stepper steps={getWorkflowSteps(selected.status)} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Giáo viên</p>
                <p className="text-sm font-medium text-gray-900">{selected.teacher_name}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Email</p>
                <p className="text-sm font-medium text-gray-900 break-all">{selected.email}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                <p className="text-xs text-gray-600">Lý do</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{selected.reason}</p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-200 p-4">
              <label className="block text-sm font-medium text-gray-700">Ghi chú duyệt</label>
              <textarea
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              />

              <label className="block text-sm font-medium text-gray-700">Giáo viên thay thế (nếu có)</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={substituteTeacher}
                  onChange={(e) => setSubstituteTeacher(e.target.value)}
                  placeholder="Tên giáo viên thay thế"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
                <input
                  type="email"
                  value={substituteEmail}
                  onChange={(e) => setSubstituteEmail(e.target.value)}
                  placeholder="Email giáo viên thay thế"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {selected.status === 'pending_admin' && (
                <>
                  <Button variant="outline" disabled={submitting} onClick={() => submitAdminReview('rejected')}>
                    Từ chối
                  </Button>
                  <Button disabled={submitting} onClick={() => submitAdminReview('approved')}>
                    Duyệt yêu cầu
                  </Button>
                </>
              )}

              {selected.status === 'approved_unassigned' && (
                <Button disabled={submitting} onClick={submitAssignSubstitute}>
                  Phân giáo viên thay thế
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
