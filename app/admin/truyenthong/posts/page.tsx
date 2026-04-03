'use client'

import { Card } from '@/components/Card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageContainer } from '@/components/PageContainer'
import { SearchBar } from '@/components/SearchBar'
import { TableSkeleton } from '@/components/skeletons'
import { Tabs } from '@/components/Tabs'
import TruyenThongStats from '@/components/truyenthong-stats'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit, FileText, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'
import useSWR from 'swr'

interface Post {
    id: number
    slug: string
    title: string
    post_type: string
    status: 'draft' | 'published' | 'hidden'
    published_at: string
    audience: string
    view_count: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PostsManagementPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published' | 'hidden'>('all')

    // Construct query URL
    const queryParams = new URLSearchParams()
    if (filterStatus !== 'all') queryParams.append('status', filterStatus)
    if (searchTerm) queryParams.append('search', searchTerm)

    const { data: posts, isLoading, mutate } = useSWR<Post[]>(
        `/api/truyenthong/posts?${queryParams.toString()}`,
        fetcher
    )

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            published: 'bg-green-100 text-green-700',
            draft: 'bg-amber-100 text-amber-700',
            hidden: 'bg-red-100 text-red-700',
        }
        const labels: Record<string, string> = {
            published: 'Công bố',
            draft: 'Nháp',
            hidden: 'Ẩn',
        }
        return (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
                {labels[status] || status}
            </span>
        )
    }

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [postToDelete, setPostToDelete] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDeleteClick = (slug: string) => {
        setPostToDelete(slug)
        setDeleteConfirmOpen(true)
    }

    const confirmDelete = async () => {
        if (!postToDelete) return

        setIsDeleting(true)
        
        // Optimistic update: Remove from UI immediately
        const previousPosts = posts
        mutate(posts?.filter(p => p.slug !== postToDelete), false)
        setDeleteConfirmOpen(false)
        
        try {
            const res = await fetch(`/api/truyenthong/posts/${postToDelete}`, {
                method: 'DELETE',
            })

            if (!res.ok) throw new Error('Failed to delete')

            toast.success('Đã xóa bài viết thành công')
            mutate() // Revalidate from server
        } catch {
            toast.error('Có lỗi xảy ra khi xóa bài viết')
            // Revert on error
            mutate(previousPosts, false)
        } finally {
            setIsDeleting(false)
            setPostToDelete(null)
        }
    }

    const tabs = [
        { id: 'all', label: 'Tất cả', count: posts?.length || 0 },
        { id: 'draft', label: 'Nháp', count: posts?.filter(p => p.status === 'draft').length || 0 },
        { id: 'published', label: 'Công bố', count: posts?.filter(p => p.status === 'published').length || 0 },
        { id: 'hidden', label: 'Ẩn', count: posts?.filter(p => p.status === 'hidden').length || 0 },
    ]

    return (
        <PageContainer
            title="Quản lý bài viết"
            description={`Tổng cộng: ${posts?.length || 0} bài viết`}
        >
            <div className="flex items-center justify-between mb-6">
                <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link href="/admin/truyenthong">
                        <ArrowLeft className="h-4 w-4" />
                        Quay lại
                    </Link>
                </Button>
                <Button asChild variant="mindx" className="gap-2 shadow-sm font-semibold">
                    <Link href="/admin/truyenthong/posts/create">
                        <Plus className="h-4 w-4" />
                        Tạo bài viết
                    </Link>
                </Button>
            </div>

            {/* Stats Dashboard */}
            <TruyenThongStats />
            
            {/* Actions Toolbar */}
            <div className="mb-4">
                <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Tìm kiếm bài viết..."
                />
            </div>

            {/* Tabs Filter */}
            <Tabs
                tabs={tabs}
                activeTab={filterStatus}
                onChange={(id) => setFilterStatus(id as 'all' | 'draft' | 'published' | 'hidden')}
            />

            {/* Posts List */}
            <div className="mb-8">
                {isLoading ? (
                    <TableSkeleton rows={5} columns={8} />
                ) : !posts || posts.length === 0 ? (
                    <Card>
                        <EmptyState
                            icon={FileText}
                            title="Không tìm thấy bài viết"
                            description="Thử thay đổi bộ lọc hoặc tạo bài viết mới"
                            action={{
                                label: "Tạo bài viết",
                                onClick: () => window.location.href = '/admin/truyenthong/posts/create'
                            }}
                        />
                    </Card>
                ) : (
                    <div className="space-y-2 relative border-t border-transparent">
                        {posts.map((post, idx) => (
                            <div key={post.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-gray-200 transition-all group">
                                {/* Left Section - Info */}
                                <div className="flex-1 min-w-0 pr-4 w-full sm:w-auto">
                                    <p className="font-semibold text-sm truncate group-hover:text-blue-600 transition-colors">
                                        {post.title}
                                    </p>
                                    
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <p className="text-xs text-gray-500">
                                            {post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : 'N/A'}
                                        </p>
                                        
                                        {getStatusBadge(post.status)}
                                        
                                        <span className="text-[10px] px-2 py-0.5 bg-gray-200/50 text-gray-600 rounded-full font-semibold border border-gray-100">
                                            {post.post_type}
                                        </span>
                                        
                                        <span className="text-[10px] px-2 py-0.5 bg-gray-200/50 text-gray-600 rounded-full font-semibold border border-gray-100 shrink-0 truncate max-w-[120px]">
                                            {post.audience}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Right Section - Stats & Actions */}
                                <div className="flex items-center gap-4 mt-3 sm:mt-0 w-full sm:w-auto justify-end border-t sm:border-0 border-gray-200 pt-3 sm:pt-0">
                                    {/* Views */}
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm font-bold text-gray-900">
                                            {post.view_count?.toLocaleString('vi-VN') || 0}
                                        </div>
                                        <div className="text-[10px] text-gray-500">lượt xem</div>
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="flex gap-1">
                                        <Link href={`/admin/truyenthong/posts/${post.slug}/edit`}>
                                            <Button variant="ghost" size="icon" title="Sửa" className="h-8 w-8 text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(post.slug)} title="Xóa" className="h-8 w-8 text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => { setDeleteConfirmOpen(false); setPostToDelete(null); }}
                onConfirm={confirmDelete}
                title="Xóa bài viết"
                message="Bạn có chắc chắn muốn xóa bài viết này? Hành động này không thể hoàn tác."
                type="danger"
                confirmText={isDeleting ? 'Đang xóa...' : 'Xóa'}
                cancelText="Hủy"
            />
        </PageContainer>
    )
}
