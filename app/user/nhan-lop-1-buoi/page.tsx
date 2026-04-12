'use client';

import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/ui/stepper';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface LeaveRequest {
  id: number;
  teacher_name: string;
  campus: string;
  leave_date: string;
  class_code?: string;
  class_time?: string;
  leave_session?: string;
  class_status?: string;
  substitute_teacher?: string;
  substitute_email?: string;
  status: 'pending_admin' | 'approved_unassigned' | 'approved_assigned' | 'rejected' | 'substitute_confirmed';
  created_at: string;
}

export default function NhanLop1BuoiPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetchData = async () => {
    if (!user?.email) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/leave-requests?mode=substitute&email=${encodeURIComponent(user.email)}`);
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
  }, [user?.email]);

  const handleConfirm = async (id: number) => {
    if (!user?.email) return;

    setConfirming(true);
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'substitute_confirm',
          id,
          substitute_email: user.email
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Đã xác nhận nhận thông tin lớp 1 buổi');
        setSelected(null);
        fetchData();
      } else {
        toast.error(data.error || 'Không thể xác nhận');
      }
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi xác nhận');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen p-6">Đang tải danh sách lớp nhận thay...</div>;
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="border-b border-gray-200 pb-4 sm:pb-5">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Danh Sách Lớp Nhận Thay Thế</h1>
          <p className="mt-1 text-sm text-gray-600">Hiển thị khi giáo viên thay thế đã xác nhận thông tin</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày phân</TableHead>
                <TableHead>Giáo viên xin nghỉ</TableHead>
                <TableHead>Cơ sở</TableHead>
                <TableHead>Ngày nghỉ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{new Date(item.created_at).toLocaleDateString('vi-VN')}</TableCell>
                  <TableCell>{item.teacher_name}</TableCell>
                  <TableCell>{item.campus}</TableCell>
                  <TableCell>{new Date(item.leave_date).toLocaleDateString('vi-VN')}</TableCell>
                  <TableCell>
                    {item.status === 'substitute_confirmed' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(item)}
                      className="border-[#d8a1ae] text-[#a1001f] hover:border-[#a1001f] hover:bg-[#fdf2f5]"
                    >
                      Chi tiết
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {items.length === 0 && <div className="p-8 text-center text-sm text-gray-600">Bạn chưa có lớp nào được phân thay thế.</div>}
        </div>
      </div>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Lớp nhận thay #${selected.id}` : 'Chi tiết'}
        maxWidth="2xl"
      >
        {selected && (
          <div className="space-y-4">
            <Stepper
              steps={[
                { id: 1, label: 'Gửi mail xin nghỉ', status: 'completed' },
                { id: 2, label: 'TC/Leader duyệt', status: 'completed' },
                { id: 3, label: 'GV thay thế xác nhận', status: selected.status === 'substitute_confirmed' ? 'success' : 'current' },
                { id: 4, label: 'Hoàn tất', status: selected.status === 'substitute_confirmed' ? 'success' : 'upcoming' }
              ]}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Giáo viên xin nghỉ</p>
                <p className="text-sm font-medium text-gray-900">{selected.teacher_name}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Mã lớp</p>
                <p className="text-sm font-medium text-gray-900">{selected.class_code || '-'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Thời gian học</p>
                <p className="text-sm font-medium text-gray-900">{selected.class_time || '-'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-600">Buổi học xin nghỉ</p>
                <p className="text-sm font-medium text-gray-900">{selected.leave_session || '-'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                <p className="text-xs text-gray-600">Tình hình lớp học</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{selected.class_status || '-'}</p>
              </div>
            </div>

            {selected.status !== 'substitute_confirmed' && (
              <div className="flex justify-end">
                <Button disabled={confirming} onClick={() => handleConfirm(selected.id)}>
                  {confirming ? 'Đang xác nhận...' : 'Xác nhận đã nhận thông tin'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
