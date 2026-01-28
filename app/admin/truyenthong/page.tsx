'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Eye, Heart, TrendingUp, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import useSWR from 'swr'
import { Loader2 } from 'lucide-react'

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then(r => r.json())

interface RecentPost {
    id: number
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
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error) {
        return <div className="text-destructive">Lỗi tải dữ liệu.</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Quản lý Truyền Thông</h1>
                <div className="flex gap-3">
                    <Link href="/admin/truyenthong/posts">
                        <Button className="bg-primary hover:bg-primary/90 transition-all hover:scale-105 shadow-md cursor-pointer">
                            Quản lý bài viết
                        </Button>
                    </Link>
                    <Link href="/admin/truyenthong/sliders">
                        <Button variant="secondary" className="hover:bg-secondary/80 transition-all hover:scale-105 shadow-sm cursor-pointer">
                            Quản lý Slider
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {stats.map((stat, idx) => {
                    const Icon = stat.icon
                    return (
                        <Card key={idx} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-default group">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                                    {stat.title}
                                </CardTitle>
                                <div className={`p-2 rounded-lg ${stat.color} group-hover:scale-110 transition-transform`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-foreground">
                                    {stat.value}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <Card className="shadow-sm">
                <CardHeader className="border-b bg-muted/30">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Bài viết gần đây
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="space-y-3">
                        {statsData?.recentPosts && statsData.recentPosts.length > 0 ? (
                            statsData.recentPosts.map((post) => (
                                <Link
                                    href={`/admin/truyenthong/posts/${post.id}/edit`}
                                    key={post.id}
                                    className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer group"
                                >
                                    <div className="space-y-1">
                                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                            {post.title}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <p className="text-xs text-muted-foreground">
                                                {post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : 'N/A'}
                                            </p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${post.status === 'published' ? 'bg-green-100 text-green-700' :
                                                post.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {post.status === 'published' ? 'Công bố' : post.status === 'draft' ? 'Nháp' : 'Ẩn'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-foreground">
                                                {post.view_count?.toLocaleString('vi-VN') || 0}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-tight">lượt xem</div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transform group-hover:translate-x-1 transition-all" />
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="text-center py-10 bg-muted/20 rounded-lg border-2 border-dashed">
                                <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-muted-foreground">Chưa có bài viết nào</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
