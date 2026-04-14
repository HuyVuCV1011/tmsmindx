'use client'

import UserFeedbackManagePanel from '@/components/feedback/UserFeedbackManagePanel'
import { PageHeader } from '@/components/PageHeader'

export default function QuanLyPhanHoiPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Quản lý phản hồi"
        description="Theo dõi toàn bộ ý kiến phản hồi bạn đã gửi và tiến trình xử lý"
      />

      <UserFeedbackManagePanel />
    </div>
  )
}
