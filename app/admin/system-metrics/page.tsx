'use client'

import { PageContainer } from '@/components/PageContainer'
import { DevicePieChart } from '@/components/system-metrics/DevicePieChart'
import { EngagementChart } from '@/components/system-metrics/EngagementChart'
import { MetricCard } from '@/components/system-metrics/MetricCard'
import { TopPagesTable } from '@/components/system-metrics/TopPagesTable'
import {
  useEngagement,
  useSystemHealth,
} from '@/components/system-metrics/useMetrics'
import { useAuth } from '@/lib/auth-context'
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  Download,
  RefreshCw,
  Smartphone,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type PeriodFilter = 'today' | '7d' | '30d'

const periodLabels: Record<PeriodFilter, string> = {
  today: 'Hôm nay',
  '7d': '7 ngày',
  '30d': '30 ngày',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
}

function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h]
          const str = String(val ?? '')
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(','),
    ),
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function SystemMetricsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [period, setPeriod] = useState<PeriodFilter>('7d')
  const [chartTab, setChartTab] = useState<'dau' | 'wau'>('dau')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    if (!authLoading && user?.role !== 'super_admin') {
      router.replace('/admin/dashboard')
    }
  }, [user, authLoading, router])

  const {
    data: health,
    isLoading: healthLoading,
    mutate: refreshHealth,
  } = useSystemHealth(user?.email)
  const {
    data: engagement,
    isLoading: engagementLoading,
    mutate: refreshEngagement,
  } = useEngagement(period, user?.email)

  const handleRefresh = useCallback(() => {
    refreshHealth()
    refreshEngagement()
    setLastRefresh(new Date())
  }, [refreshHealth, refreshEngagement])

  const handleExportHealth = () => {
    if (!health) return
    exportCSV(
      [
        {
          'Concurrent Users': health.concurrent_users,
          'DB Usage (%)': health.db_usage,
          'Response Time P95 (ms)': health.response_time_p95,
          'Error Rate (%)': health.error_rate,
          'Error 500 (%)': health.error_500,
          'Error 404 (%)': health.error_404,
        },
      ],
      'system_health',
    )
  }

  const handleExportEngagement = () => {
    if (!engagement) return
    const rows = engagement.top_pages.map((p) => ({
      Page: p.page,
      Views: p.views,
      'Percentage (%)': p.percentage,
    }))
    exportCSV(rows, 'top_pages')
  }

  const errorAlert = health && health.error_rate > 5
  const dbAlert = health && health.db_usage > 80

  if (authLoading || user?.role !== 'super_admin') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <PageContainer
      title="Quản lý chỉ số hệ thống"
      description="Theo dõi sức khỏe, hiệu suất và hành vi người dùng trong hệ thống TPS"
    >
      {(errorAlert || dbAlert) && (
        <div className="mb-4 space-y-2">
          {errorAlert && (
            <div className="animate-in slide-in-from-top-2 fade-in flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm duration-300">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">
                  Cảnh báo: Tỷ lệ lỗi cao
                </p>
                <p className="text-xs text-red-600">
                  Error rate hiện tại: {health?.error_rate}% (ngưỡng: 5%). Kiểm
                  tra logs ngay.
                </p>
              </div>
            </div>
          )}
          {dbAlert && (
            <div className="animate-in slide-in-from-top-2 fade-in flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm duration-300">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <Database className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Cảnh báo: DB connection cao
                </p>
                <p className="text-xs text-amber-600">
                  Sử dụng hiện tại: {health?.db_usage}% (ngưỡng: 80%). Cân nhắc
                  scale pool.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(Object.keys(periodLabels) as PeriodFilter[]).map((key) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                period === key
                  ? 'bg-[#a1001f] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {periodLabels[key]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            Cập nhật: {lastRefresh.toLocaleTimeString('vi-VN')}
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:border-[#a1001f] hover:bg-red-50/50 hover:text-[#a1001f]"
          >
            <RefreshCw className="h-3 w-3" />
            Làm mới
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#a1001f]/10">
              <Activity className="h-3.5 w-3.5 text-[#a1001f]" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">
              Sức khỏe hệ thống
            </h2>
          </div>
          <button
            onClick={handleExportHealth}
            className="flex items-center gap-1 text-[11px] font-medium text-gray-500 transition-colors hover:text-[#a1001f]"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
        </div>

        {healthLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[140px] animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Người dùng đang online"
                value={health?.concurrent_users ?? 0}
                icon={Users}
                live
              />
              <MetricCard
                label="DB connection"
                value={health?.db_usage ?? 0}
                unit="%"
                icon={Database}
                progress={health?.db_usage ?? 0}
                warningThreshold={80}
              />
              <MetricCard
                label="API response time (p95)"
                value={health?.response_time_p95 ?? 0}
                unit="ms"
                icon={Zap}
                trend={
                  health?.response_time_trend !== undefined
                    ? {
                        value: Math.abs(health.response_time_trend),
                        direction:
                          health.response_time_trend > 0
                            ? 'up'
                            : health.response_time_trend < 0
                              ? 'down'
                              : 'flat',
                      }
                    : undefined
                }
              />
              <MetricCard
                label="Tỷ lệ lỗi"
                value={health?.error_rate ?? 0}
                unit="%"
                icon={AlertTriangle}
                detail={`500: ${health?.error_500 ?? 0}% | 404: ${health?.error_404 ?? 0}%`}
              />
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  Chi tiết lỗi theo page (24h)
                </h3>
                <span className="text-[11px] text-gray-400">
                  Top {health?.error_by_page?.length ?? 0} page có lỗi
                </span>
              </div>

              {!health?.error_by_page || health.error_by_page.length === 0 ? (
                <div className="flex h-28 items-center justify-center text-sm text-gray-400">
                  Chưa có dữ liệu lỗi theo page
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-100">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Page
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Tổng lỗi
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          500
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          404
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Request
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          Tỷ lệ lỗi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {health.error_by_page.map((row) => (
                        <tr key={row.page} className="hover:bg-gray-50/70">
                          <td className="max-w-[320px] truncate px-3 py-2.5 text-xs font-medium text-gray-700">
                            {row.page}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-gray-900">
                            {row.total_errors.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                            {row.errors_500.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                            {row.errors_404.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">
                            {row.total_requests.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs font-medium tabular-nums text-gray-800">
                            {row.error_rate !== null
                              ? `${row.error_rate}%`
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#a1001f]/10">
              <TrendingUp className="h-3.5 w-3.5 text-[#a1001f]" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">
              Tương tác người dùng
            </h2>
          </div>
          <button
            onClick={handleExportEngagement}
            className="flex items-center gap-1 text-[11px] font-medium text-gray-500 transition-colors hover:text-[#a1001f]"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
        </div>

        {engagementLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[280px] animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                label="Thời gian phiên trung bình"
                value={formatDuration(engagement?.avg_session_duration ?? 0)}
                icon={Timer}
              />
              <MetricCard
                label="Thiết bị di động"
                value={engagement?.devices?.mobile ?? 0}
                unit="%"
                icon={Smartphone}
              />
              <MetricCard
                label="Tổng lượt xem trang"
                value={
                  engagement?.top_pages
                    ?.reduce((s, p) => s + p.views, 0)
                    .toLocaleString() ?? '0'
                }
                icon={Clock}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <EngagementChart
                  dau={engagement?.dau ?? []}
                  wau={engagement?.wau ?? []}
                  activeTab={chartTab}
                  onTabChange={setChartTab}
                />
              </div>
              <DevicePieChart
                mobile={engagement?.devices?.mobile ?? 0}
                desktop={engagement?.devices?.desktop ?? 0}
              />
            </div>

            <div className="mt-4">
              <TopPagesTable pages={engagement?.top_pages ?? []} />
            </div>
          </>
        )}
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#a1001f]/10">
            <Zap className="h-3.5 w-3.5 text-[#a1001f]" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">Chỉ số sản phẩm</h2>
        </div>

        {engagementLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[100px] animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="mb-1 text-[11px] font-medium text-gray-500">
                  Retention D1
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {engagement?.retention?.d1 ?? 0}%
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  Quay lại sau 1 ngày
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="mb-1 text-[11px] font-medium text-gray-500">
                  Retention D7
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {engagement?.retention?.d7 ?? 0}%
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  Quay lại sau 7 ngày
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="mb-1 text-[11px] font-medium text-gray-500">
                  Retention D30
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {engagement?.retention?.d30 ?? 0}%
                </p>
                <p className="mt-1 text-[10px] text-gray-400">
                  Quay lại sau 30 ngày
                </p>
              </div>
            </div>

            {engagement?.feature_usage &&
              engagement.feature_usage.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-sm font-semibold text-gray-800">
                    Sử dụng tính năng
                  </h3>
                  <div className="space-y-3">
                    {engagement.feature_usage.map((f) => {
                      const maxUsage = Math.max(
                        ...engagement.feature_usage.map((x) => x.usage_count),
                      )
                      const pct =
                        maxUsage > 0
                          ? Math.round((f.usage_count / maxUsage) * 100)
                          : 0

                      return (
                        <div
                          key={f.feature}
                          className="flex items-center gap-3"
                        >
                          <span className="w-40 truncate text-xs font-medium text-gray-700">
                            {f.feature}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-[#a1001f]/80 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-16 text-right text-[11px] tabular-nums text-gray-500">
                            {f.usage_count} lần
                          </span>
                          <span className="w-14 text-right text-[11px] tabular-nums text-gray-400">
                            {f.unique_users} user
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
