'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Calendar, Eye, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

interface Post {
    id: string | number
    slug: string
    title: string
    description: string
    featured_image: string
    post_type: string
    published_at: string
    view_count: number
}

export default function PostCard({ post }: { post: Post }) {
    const [imageLoading, setImageLoading] = useState(true)
    
    const publishDate = new Date(post.published_at).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })

    const postTypeLabels: Record<string, string> = {
        'tin-tức': 'Tin tức',
        'chính-sách': 'Chính sách',
        'sự-kiện': 'Sự kiện',
        'đào-tạo': 'Đào tạo',
        'báo-cáo': 'Báo cáo',
        'thông-báo': 'Thông báo',
    }

    const badgeColors: Record<string, string> = {
        'tin-tức': 'bg-blue-100 text-blue-700 border-blue-200',
        'chính-sách': 'bg-purple-100 text-purple-700 border-purple-200',
        'sự-kiện': 'bg-green-100 text-green-700 border-green-200',
        'đào-tạo': 'bg-amber-100 text-amber-700 border-amber-200',
        'báo-cáo': 'bg-red-100 text-red-700 border-red-200',
        'thông-báo': 'bg-gray-100 text-gray-700 border-gray-200',
    }

    return (
        <Link href={`/user/truyenthong/${post.slug}`} className="group">
            <Card className="h-full hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden border-2 border-transparent hover:border-blue-200 bg-white">
                <CardHeader className="p-0 relative overflow-hidden">
                    <div className="relative w-full h-44 bg-gradient-to-br from-gray-100 to-gray-200">
                        {imageLoading && (
                            <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
                        )}
                        <Image
                            src={post.featured_image || "/placeholder.svg"}
                            alt={post.title}
                            fill
                            className={`object-cover group-hover:scale-110 transition-transform duration-500 ${
                                imageLoading ? 'opacity-0' : 'opacity-100'
                            }`}
                            loading="lazy"
                            onLoadingComplete={() => setImageLoading(false)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        {/* Badge on Image */}
                        <div className="absolute top-3 left-3">
                            <Badge 
                                className={`text-[10px] font-bold border shadow-lg backdrop-blur-sm ${badgeColors[post.post_type] || 'bg-gray-100 text-gray-700'}`}
                            >
                                {postTypeLabels[post.post_type] || post.post_type}
                            </Badge>
                        </div>
                        
                        {/* Read More Button */}
                        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full p-2 shadow-xl">
                                <ArrowRight className="w-3.5 h-3.5 text-white" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 flex flex-col gap-2.5">
                    <h3 className="font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors duration-300 text-sm leading-tight min-h-[2.5rem]">
                        {post.title}
                    </h3>

                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {post.description}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-gray-500 pt-2.5 border-t border-gray-100 mt-auto">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-blue-600" />
                            <span>{publishDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Eye className="w-3 h-3 text-blue-600" />
                            <span className="font-semibold">{post.view_count.toLocaleString('vi-VN')}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
