'use client'

import { FileText, Eye, MessageSquare, TrendingUp } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function TruyenThongStats() {
    const { data: stats } = useSWR('/api/truyenthong/stats', fetcher, {
        refreshInterval: 30000 // Refresh every 30s
    })

    const statsCards = [
        {
            title: 'Tổng bài viết',
            value: stats?.totalPosts || 0,
            icon: FileText,
            color: 'bg-blue-500',
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-600',
        },
        {
            title: 'Lượt xem',
            value: stats?.totalViews || 0,
            icon: Eye,
            color: 'bg-green-500',
            bgColor: 'bg-green-50',
            textColor: 'text-green-600',
            format: 'number'
        },
        {
            title: 'Bình luận',
            value: stats?.totalComments || 0,
            icon: MessageSquare,
            color: 'bg-purple-500',
            bgColor: 'bg-purple-50',
            textColor: 'text-purple-600',
        },
        {
            title: 'Tăng trưởng',
            value: stats?.growth || 0,
            icon: TrendingUp,
            color: 'bg-amber-500',
            bgColor: 'bg-amber-50',
            textColor: 'text-amber-600',
            suffix: '%'
        },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {statsCards.map((stat, index) => {
                const Icon = stat.icon
                const formattedValue = stat.format === 'number' 
                    ? stat.value.toLocaleString('vi-VN')
                    : stat.value

                return (
                    <div 
                        key={index}
                        className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-all duration-200"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className={`${stat.bgColor} p-2 rounded-lg`}>
                                <Icon className={`w-5 h-5 ${stat.textColor}`} />
                            </div>
                            <div className={`w-1.5 h-1.5 rounded-full ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 font-semibold mb-0.5">{stat.title}</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {formattedValue}
                                {stat.suffix && <span className="text-base ml-1">{stat.suffix}</span>}
                            </p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
