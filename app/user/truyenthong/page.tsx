'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Slider from '@/components/slider'
import PostCard from '@/components/post-card'

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

export default function HomePage() {
    const [posts, setPosts] = useState<Post[]>([])
    const [filteredPosts, setFilteredPosts] = useState<Post[]>([])
    const [selectedFilter, setSelectedFilter] = useState<string>('all')
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const postsPerPage = 6

    useEffect(() => {
        const fetchPosts = async () => {
            setLoading(true)
            try {
                // lấy các bài viết có trạng thái công khai
                const res = await fetch('/api/truyenthong/posts?status=published')
                if (!res.ok) throw new Error('Failed to fetch')
                const data = await res.json()
                setPosts(data)
            } catch (error) {
                console.error("Error fetching posts:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchPosts()
    }, [])

    useEffect(() => {
        if (selectedFilter === 'all') {
            setFilteredPosts(posts)
        } else {
            setFilteredPosts(posts.filter(post => post.post_type === selectedFilter))
        }
        setCurrentPage(1)
    }, [selectedFilter, posts])

    const postTypes = [
        { value: 'all', label: 'Tất cả' },
        { value: 'tin-tức', label: 'Tin tức' },
        { value: 'chính-sách', label: 'Chính sách' },
        { value: 'sự-kiện', label: 'Sự kiện' },
        { value: 'đào-tạo', label: 'Đào tạo' },
        { value: 'báo-cáo', label: 'Báo cáo' },
        { value: 'thông-báo', label: 'Thông báo' },
    ]

    // Pagination
    const indexOfLastPost = currentPage * postsPerPage
    const indexOfFirstPost = indexOfLastPost - postsPerPage
    const currentPosts = filteredPosts.slice(indexOfFirstPost, indexOfLastPost)
    const totalPages = Math.ceil(filteredPosts.length / postsPerPage)

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold text-primary">Truyền Thông Nội Bộ</h1>
                    <p className="text-sm text-muted-foreground mt-1">Chia sẻ tin tức và thông báo từ công ty</p>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        {/* Simple loading state or keep existing skeleton structure if preferred, 
                             but simplicity matches the request for "clean" UI. 
                             Let's reuse the skeleton grid for better UX during load if we want, 
                             but simplest is to just wait. 
                             Actually, let's keep the skeletons but we need to conditionally render the headers.
                         */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                            {[...Array(6)].map((_, i) => (
                                <Card key={i} className="animate-pulse">
                                    <CardContent className="p-0">
                                        <div className="w-full h-40 bg-muted rounded-t-lg" />
                                        <div className="p-4 space-y-3">
                                            <div className="h-4 bg-muted rounded w-3/4" />
                                            <div className="h-3 bg-muted rounded w-full" />
                                            <div className="h-3 bg-muted rounded w-2/3" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500">
                        <div className="bg-muted p-6 rounded-full mb-6">
                            <Inbox className="w-12 h-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground mb-2">Chưa có bài viết nào</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto">
                            Hiện tại chưa có tin tức hoặc thông báo nào được đăng tải.
                            Vui lòng quay lại sau!
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Slider Section */}
                        <section className="mb-12">
                            <h2 className="text-xl font-semibold text-foreground mb-4">Tin nổi bật</h2>
                            <Slider posts={posts.slice(0, 5)} />
                        </section>

                        {/* News Section */}
                        <section>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                                <h2 className="text-xl font-semibold text-foreground">Tin tức mới nhất</h2>

                                {/* Filter */}
                                <div className="flex flex-wrap gap-2">
                                    {postTypes.map(type => (
                                        <Button
                                            key={type.value}
                                            variant={selectedFilter === type.value ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setSelectedFilter(type.value)}
                                            className="text-xs"
                                        >
                                            {type.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Posts Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                {currentPosts.map(post => (
                                    <PostCard key={post.id} post={post} />
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 mt-8">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>

                                    <div className="flex gap-1">
                                        {[...Array(totalPages)].map((_, i) => (
                                            <Button
                                                key={i + 1}
                                                variant={currentPage === i + 1 ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setCurrentPage(i + 1)}
                                                className="w-9 h-9 p-0"
                                            >
                                                {i + 1}
                                            </Button>
                                        ))}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>
        </div>
    )
}
