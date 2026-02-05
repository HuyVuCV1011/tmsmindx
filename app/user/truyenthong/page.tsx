'use client'

import React, { useEffect, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight, Filter, Search, Flame, TrendingUp } from 'lucide-react'

import PostCard from '@/components/post-card'
import Slider from '@/components/slider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageContainer } from '@/components/PageContainer'
import { cn } from '@/lib/utils'

// Skeleton Imports (Inline for simplicity or import if available)
import { PostCardSkeleton } from '@/components/skeletons'

interface Post {
    id: string | number
    slug: string
    title: string
    description: string
    content: string
    featured_image: string
    banner_image: string
    post_type: string
    published_at: string
    view_count: number
    created_at: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function CommunicationsPage() {
    const { data: posts = [], isLoading } = useSWR<Post[]>('/api/truyenthong/posts?status=published', fetcher)
    const [filteredPosts, setFilteredPosts] = useState<Post[]>([])
    const [selectedFilter, setSelectedFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')

    // Initialize filtered posts
    useEffect(() => {
        let result = posts

        // Filter by Type
        if (selectedFilter !== 'all') {
            result = result.filter(post => post.post_type === selectedFilter)
        }

        // Filter by Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(post =>
                post.title.toLowerCase().includes(query) ||
                post.description.toLowerCase().includes(query)
            )
        }

        setFilteredPosts(result)
    }, [selectedFilter, searchQuery, posts])

    // Derived Data
    const featuredPosts = posts.slice(0, 5) // Top 5 for Slider
    // Sort by views for "Trending"
    const trendingPosts = [...posts].sort((a, b) => b.view_count - a.view_count).slice(0, 5)

    const postTypes = [
        { value: 'all', label: 'Tất cả' },
        { value: 'tin-tức', label: 'Tin tức' },
        { value: 'chính-sách', label: 'Chính sách' },
        { value: 'sự-kiện', label: 'Sự kiện' },
        { value: 'đào-tạo', label: 'Đào tạo' },
        { value: 'báo-cáo', label: 'Báo cáo' },
        { value: 'thông-báo', label: 'Thông báo' },
    ]

    return (
        <PageContainer>
            <div className="bg-gray-50/50 min-h-screen pb-20">
                {/* Header Section */}
                <div className="bg-white border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Truyền Thông Nội Bộ</h1>
                                <p className="text-gray-500 mt-2 font-light text-lg">Cập nhật tin tức, sự kiện và thông báo mới nhất</p>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Tìm kiếm bài viết..."
                                    className="pl-10 w-full md:w-80 bg-gray-50 border-gray-200 focus:bg-white transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 md:px-6 pt-8 space-y-12">

                    {/* Hero Slider */}
                    {!isLoading && posts.length > 0 && (
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <Slider posts={featuredPosts} />
                        </section>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        {/* Main Stream (Left 8 Cols) */}
                        <div className="lg:col-span-8 flex flex-col gap-8">

                            {/* Sticky Filter Bar */}
                            <div className="sticky top-20 z-30 bg-white/80 backdrop-blur-xl border border-gray-200/50 p-2 rounded-2xl shadow-sm flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
                                <div className="flex p-1 gap-1">
                                    {postTypes.map(type => (
                                        <button
                                            key={type.value}
                                            onClick={() => setSelectedFilter(type.value)}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
                                                selectedFilter === type.value
                                                    ? "bg-gray-900 text-white shadow-md"
                                                    : "bg-transparent text-gray-600 hover:bg-gray-100"
                                            )}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Posts Grid */}
                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[...Array(4)].map((_, i) => <PostCardSkeleton key={i} />)}
                                </div>
                            ) : filteredPosts.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                                    {filteredPosts.map(post => (
                                        <div key={post.id}>
                                            <PostCard post={post} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Filter className="w-6 h-6 text-gray-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">Không tìm thấy bài viết</h3>
                                    <p className="text-gray-500">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                                </div>
                            )}

                        </div>

                        {/* Sidebar (Right 4 Cols) */}
                        <div className="lg:col-span-4 space-y-8">

                            {/* Trending Section */}
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 sticky top-24">
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="p-2 bg-rose-50 rounded-lg text-rose-600">
                                        <Flame className="w-5 h-5" />
                                    </span>
                                    <h3 className="font-bold text-lg text-gray-900">Đọc nhiều nhất</h3>
                                </div>

                                <div className="space-y-6">
                                    {isLoading ? (
                                        [...Array(3)].map((_, i) => (
                                            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                                        ))
                                    ) : trendingPosts.map((post, index) => (
                                        <Link
                                            key={post.id}
                                            href={`/user/truyenthong/${post.slug || post.id}`}
                                            className="group flex gap-4 items-start"
                                        >
                                            <span className="text-4xl font-black text-gray-100 leading-[0.8] tabular-nums group-hover:text-blue-100 transition-colors">
                                                {index + 1}
                                            </span>
                                            <div className="space-y-1">
                                                <h4 className="font-bold text-gray-700 group-hover:text-blue-600 transition-colors line-clamp-2 text-sm leading-relaxed">
                                                    {post.title}
                                                </h4>
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <TrendingUp className="w-3 h-3" />
                                                    {post.view_count.toLocaleString()} lượt xem
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>

                                <div className="mt-6 pt-6 border-t border-gray-50">
                                    <Button variant="outline" className="w-full justify-between group rounded-xl">
                                        Xem tất cả bảng xếp hạng
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors" />
                                    </Button>
                                </div>
                            </div>

                            {/* Newsletter / CTA */}
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

                                <h3 className="font-bold text-xl mb-2 relative z-10">Đăng ký nhận tin</h3>
                                <p className="text-blue-100 text-sm mb-6 relative z-10 font-light">
                                    Nhận thông báo về các sự kiện và tin tức quan trọng hàng tuần trực tiếp vào email.
                                </p>
                                <div className="relative z-10 space-y-3">
                                    <Input
                                        placeholder="Email của bạn"
                                        className="bg-white/10 border-white/20 text-white placeholder:text-blue-200/50 backdrop-blur-sm focus:bg-white/20"
                                    />
                                    <Button className="w-full bg-white text-blue-600 hover:bg-blue-50 font-bold shadow-lg">
                                        Đăng ký ngay
                                    </Button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}
