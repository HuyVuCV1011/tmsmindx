'use client'

import PostCard from '@/components/post-card'
import { PostCardSkeleton } from '@/components/skeletons'
import Slider from '@/components/slider'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/PageContainer'
import { ChevronLeft, ChevronRight, Inbox, Filter } from 'lucide-react'
import { useEffect, useState } from 'react'
import useSWR from 'swr'

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

export default function HomePage() {
    const { data: posts = [], isLoading } = useSWR<Post[]>('/api/truyenthong/posts?status=published', fetcher)
    const [filteredPosts, setFilteredPosts] = useState<Post[]>([])
    const [selectedFilter, setSelectedFilter] = useState<string>('all')
    const [currentPage, setCurrentPage] = useState(1)
    const postsPerPage = 6

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

    const getPostTypeCount = (type: string) => {
        if (type === 'all') return posts.length
        return posts.filter(post => post.post_type === type).length
    }

    return (
        <PageContainer>
            <div className="max-w-7xl mx-auto">
                {isLoading ? (
                    <div className="space-y-8">
                        {/* Slider Skeleton */}
                        <div className="w-full h-64 md:h-96 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-2xl animate-pulse shadow-lg"></div>
                        
                        {/* Posts Grid Skeleton */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {[...Array(8)].map((_, i) => (
                                <PostCardSkeleton key={i} />
                            ))}
                        </div>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-dashed border-blue-200">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl mb-6 shadow-lg">
                            <Inbox className="w-16 h-16 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Chưa có bài viết nào</h3>
                        <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                            Hiện tại chưa có tin tức hoặc thông báo nào được đăng tải.
                            Vui lòng quay lại sau để xem nội dung mới nhất!
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Slider Section */}
                        <section className="mb-10">
                            <Slider posts={posts.slice(0, 5)} />
                        </section>

                        {/* News Section */}
                        <section>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-5">
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-6 w-1 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full shadow-sm"></div>
                                        <div>
                                            <h2 className="text-lg md:text-xl font-bold text-gray-900">Tất cả bài viết</h2>
                                            <p className="text-[10px] text-gray-500">{filteredPosts.length} bài viết</p>
                                        </div>
                                    </div>

                                    {/* Filter */}
                                    <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
                                        <Filter className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                        <div className="flex gap-1.5">
                                            {postTypes.map(type => (
                                                <button
                                                    key={type.value}
                                                    onClick={() => setSelectedFilter(type.value)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                                        selectedFilter === type.value 
                                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' 
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {type.label}
                                                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                        selectedFilter === type.value 
                                                            ? 'bg-white/25 text-white' 
                                                            : 'bg-white text-gray-600'
                                                    }`}>
                                                        {getPostTypeCount(type.value)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Posts Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {currentPosts.map(post => (
                                    <PostCard key={post.id} post={post} />
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                                    <p className="text-sm text-gray-600">
                                        Hiển thị <span className="font-semibold text-gray-900">{indexOfFirstPost + 1}-{Math.min(indexOfLastPost, filteredPosts.length)}</span> trong <span className="font-semibold text-gray-900">{filteredPosts.length}</span> bài viết
                                    </p>
                                    
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                            className="gap-1"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Trước
                                        </Button>

                                        <div className="flex gap-1">
                                            {[...Array(totalPages)].map((_, i) => {
                                                // Show first, last, current, and adjacent pages
                                                const pageNum = i + 1
                                                const showPage = pageNum === 1 || 
                                                               pageNum === totalPages || 
                                                               Math.abs(pageNum - currentPage) <= 1
                                                const showEllipsis = (pageNum === 2 && currentPage > 3) || 
                                                                   (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                                                
                                                if (!showPage && !showEllipsis) return null
                                                
                                                if (showEllipsis) {
                                                    return <span key={i} className="px-2 py-1 text-gray-400">...</span>
                                                }
                                                
                                                return (
                                                    <Button
                                                        key={i + 1}
                                                        variant={currentPage === pageNum ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className="w-9 h-9 p-0"
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                )
                                            })}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                            className="gap-1"
                                        >
                                            Sau
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </PageContainer>
    )
}
