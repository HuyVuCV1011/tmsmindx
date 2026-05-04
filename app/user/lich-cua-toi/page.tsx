'use client'

import { Tabs } from '@/components/Tabs'
import { useAuth } from '@/lib/auth-context'
import { authHeaders } from '@/lib/auth-headers'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TabLichHoatDong from './components/TabLichHoatDong'
import TabNhanLop from './components/TabNhanLop'
import TabXinNghi from './components/TabXinNghi'

const TAB_IDS = ['lich', 'xin-nghi', 'nhan-lop'] as const
type TabId = (typeof TAB_IDS)[number]

function isValidTab(v: string | null): v is TabId {
  return TAB_IDS.includes(v as TabId)
}

function LichCuaToiContent() {
  const { user, token } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawTab = searchParams.get('tab')
  const activeTab: TabId = isValidTab(rawTab) ? rawTab : 'lich'

  // Badge counts — fetch real-time
  const [pendingLeave, setPendingLeave] = useState(0)
  const [pendingSub, setPendingSub] = useState(0)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [leaveModalDate, setLeaveModalDate] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchBadgeCounts = useCallback(async () => {
    if (!user?.email) return
    try {
      const [leaveRes, subRes] = await Promise.all([
        fetch(`/api/leave-requests?email=${encodeURIComponent(user.email)}`, {
          headers: authHeaders(token),
        }),
        fetch(
          `/api/leave-requests?mode=substitute&email=${encodeURIComponent(user.email)}`,
          { headers: authHeaders(token) },
        ),
      ])
      const [leaveData, subData] = await Promise.all([
        leaveRes.json(),
        subRes.json(),
      ])
      if (leaveData.success) {
        setPendingLeave(
          (leaveData.data || []).filter(
            (r: any) => r.status === 'pending_admin',
          ).length,
        )
      }
      if (subData.success) {
        setPendingSub(
          (subData.data || []).filter(
            (r: any) => r.status === 'approved_assigned',
          ).length,
        )
      }
    } catch {}
  }, [user?.email, token])

  useEffect(() => {
    fetchBadgeCounts()
    intervalRef.current = setInterval(fetchBadgeCounts, 60_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchBadgeCounts])

  const setActiveTab = useCallback(
    (tabId: string) => {
      router.replace(`/user/lich-cua-toi?tab=${tabId}`, { scroll: false })
    },
    [router],
  )

  const tabs = useMemo(
    () => [
      { id: 'lich', label: 'Lịch hoạt động' },
      {
        id: 'xin-nghi',
        label: 'Xin nghỉ dạy',
        count: pendingLeave || undefined,
      },
      {
        id: 'nhan-lop',
        label: 'Nhận lớp thay',
        count: pendingSub || undefined,
      },
    ],
    [pendingLeave, pendingSub],
  )

  const openLeaveModal = useCallback((dateStr?: string) => {
    setLeaveModalDate(dateStr ?? null)
    setLeaveModalOpen(true)
  }, [])

  const closeLeaveModal = useCallback(() => {
    setLeaveModalOpen(false)
    setLeaveModalDate(null)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Tab bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-7xl">
        {activeTab === 'lich' && (
          <TabLichHoatDong onRefreshBadge={fetchBadgeCounts} onOpenLeaveRequest={(dateStr?: string) => openLeaveModal(dateStr)} />
        )}
        {activeTab === 'xin-nghi' && (
          <TabXinNghi onRefreshBadge={fetchBadgeCounts} />
        )}
        {activeTab === 'nhan-lop' && (
          <TabNhanLop onRefreshBadge={fetchBadgeCounts} />
        )}

        {/* Hidden mount of XinNghi to allow opening its modal without switching tabs */}
        <div style={{ display: 'none' }}>
          <TabXinNghi
            onRefreshBadge={fetchBadgeCounts}
            initialLeaveDate={leaveModalDate}
            externalOpen={leaveModalOpen}
            onCreated={() => {
              setActiveTab('xin-nghi')
              closeLeaveModal()
              fetchBadgeCounts()
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default function LichCuaToiPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white p-8">
          <div className="mx-auto max-w-7xl space-y-4">
            <div className="h-10 w-72 animate-pulse rounded bg-gray-200" />
            <div className="h-96 animate-pulse rounded-xl bg-gray-100" />
          </div>
        </div>
      }
    >
      <LichCuaToiContent />
    </Suspense>
  )
}
