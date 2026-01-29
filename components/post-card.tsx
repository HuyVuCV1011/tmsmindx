'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, Calendar } from 'lucide-react'

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

    const badgeVariants: Record<string, string> = {
        'tin-tức': 'default',
        'chính-sách': 'secondary',
        'sự-kiện': 'outline',
        'đào-tạo': 'default',
        'báo-cáo': 'secondary',
        'thông-báo': 'outline',
    }

    return (
        <Link href={`/user/truyenthong/${post.slug}`}>
            <Card className="h-full hover:shadow-lg transition-shadow duration-300 cursor-pointer overflow-hidden">
                <CardHeader className="p-0">
                    <div className="relative w-full h-48 bg-muted">
                        <Image
                            src={post.featured_image || "/placeholder.svg"}
                            alt={post.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-4 flex flex-col gap-3">
                    <div>
                        <Badge variant={badgeVariants[post.post_type] as any} className="mb-2">
                            {postTypeLabels[post.post_type] || post.post_type}
                        </Badge>
                        <h3 className="font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors">
                            {post.title}
                        </h3>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                        <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{publishDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            <span>{post.view_count.toLocaleString('vi-VN')}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
