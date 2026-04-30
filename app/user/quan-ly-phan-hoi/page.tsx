'use client'

import UserFeedbackManagePanel from '@/components/feedback/UserFeedbackManagePanel'
import { PageHeader } from '@/components/PageHeader'
import { RefreshCcw } from 'lucide-react'
import { useState } from 'react'

export default function QuanLyPhanHoiPage() {
  const [refreshSignal, setRefreshSignal] = useState(0)

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Trung Tâm Phản Hồi"
        description="Theo dõi toàn bộ ý kiến phản hồi bạn đã gửi và tiến trình xử lý"
        actions={
          <button
            type="button"
            onClick={() => setRefreshSignal((prev) => prev + 1)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#f3b4bd] bg-white px-4 text-sm font-medium text-[#a1001f] shadow-sm hover:bg-[#a1001f]/5"
          >
            <RefreshCcw className="mr-1.5 h-4 w-4" />
            Làm mới
          </button>
        }
      />

      <UserFeedbackManagePanel
        showInlineRefresh={false}
        externalRefreshSignal={refreshSignal}
      />
    </div>
  )
}
