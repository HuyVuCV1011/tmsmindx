'use client'

import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageContainer } from '@/components/PageContainer'
import { StatCard } from '@/components/StatCard'
import { ChevronRight, Edit, Eye, FileText, Heart, Image, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import useSWR from 'swr'

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then(r => r.json())

interface RecentPost {
    id: number
    slug: string
    title: string
    published_at: string
    view_count: number
    status: string
}

interface StatsData {
    totalPosts: number
    totalViews: number
    totalLikes: number
    recentPosts: RecentPost[]
    error?: string
}

export default function AdminDashboard() {
    const { data: statsData, error, isLoading } = useSWR<StatsData>('/api/truyenthong/stats', fetcher)

    const stats = [
        {
            title: 'Tổng bài viết',
            value: statsData?.totalPosts || 0,
            icon: FileText,
            color: 'bg-blue-100 text-blue-600',
        },
        {
            title: 'Lượt xem tổng',
            value: statsData?.totalViews?.toLocaleString('vi-VN') || 0,
            icon: Eye,
            color: 'bg-green-100 text-green-600',
        },
        {
            title: 'Tương tác',
            value: statsData?.totalLikes?.toLocaleString('vi-VN') || 0,
            icon: Heart,
            color: 'bg-red-100 text-red-600',
        },
        {
            title: 'Tăng trưởng',
            value: '+28%', // Currently hardcoded
            icon: TrendingUp,
            color: 'bg-purple-100 text-purple-600',
        },
    ]

    if (isLoading) {
        return <LoadingSpinner text="Đang tải thống kê..." />;
    }

    if (error) {
        return <div className="text-red-600 text-center py-12">Lỗi tải dữ liệu.</div>
    }

    return (
        <PageContainer
            title="Quản lý Truyền thông"
            description="Tổng quan và quản lý nội dung truyền thông"
        >
            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
                <Link href="/admin/truyenthong/posts">
                    <button className="cursor-pointer flex items-center gap-2 bg-[#a1001f] hover:bg-[#c41230] text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                        <Edit className="h-4 w-4" />
                        Quản lý bài viết
                    </button>
                </Link>
                <Link href="/admin/truyenthong/sliders">
                    <button className="cursor-pointer flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                        <Image className="h-4 w-4" />
                        Quản lý Slider
                    </button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    title="Tổng bài viết"
                    value={statsData?.totalPosts || 0}
                    icon={FileText}
                    color="blue"
                />
                <StatCard
                    title="Lượt xem tổng"
                    value={statsData?.totalViews?.toLocaleString('vi-VN') || '0'}
                    icon={Eye}
                    color="green"
                />
                <StatCard
                    title="Tương tác"
                    value={statsData?.totalLikes?.toLocaleString('vi-VN') || '0'}
                    icon={Heart}
                    color="red"
                />
                <StatCard
                    title="Tăng trưởng"
                    value="+28%"
                    icon={TrendingUp}
                    color="purple"
                    trend={{ value: "so với tháng trước", isPositive: true }}
                />
            </div>

            {/* Recent Posts */}
            <Card title="Bài viết gần đây">
                {statsData?.recentPosts && statsData.recentPosts.length > 0 ? (
                    <div className="space-y-2">
                        {statsData.recentPosts.map((post) => (
                            <Link
                                href={`/admin/truyenthong/posts/${post.id}/edit`}
                                key={post.id}
                                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate group-hover:text-[#a1001f]">
                                        {post.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xs text-gray-500">
                                            {post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : 'N/A'}
                                        </p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${post.status === 'published' ? 'bg-green-100 text-green-700' :
                                                post.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {post.status === 'published' ? 'Công bố' : post.status === 'draft' ? 'Nháp' : 'Ẩn'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-sm font-bold">
                                            {post.view_count?.toLocaleString('vi-VN') || 0}
                                        </div>
                                        <div className="text-xs text-gray-500">lượt xem</div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#a1001f] group-hover:translate-x-1 transition-all" />
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={FileText}
                        title="Chưa có bài viết"
                        description="Tạo bài viết mới để bắt đầu"
                    />
                )}
            </Card>
        </PageContainer>
    )
}
