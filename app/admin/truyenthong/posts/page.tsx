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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Edit, FileText, Plus, Trash2 } from 'lucide-react'
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
        const variantMap: Record<string, 'warning' | 'success' | 'secondary'> = {
            draft: 'warning',
            published: 'success',
            hidden: 'secondary',
        }
        const labels: Record<string, string> = {
            draft: 'Nháp',
            published: 'Đã công bố',
            hidden: 'Ẩn',
        }
        return (
            <Badge variant={variantMap[status] || 'secondary'}>
                {labels[status] || status}
            </Badge>
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
            {/* Stats Dashboard */}
            <TruyenThongStats />
            
            {/* Create Button */}
            <div className="flex justify-between items-center mb-4">
                <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Tìm kiếm bài viết..."
                />
                <Link href="/admin/truyenthong/posts/create">
                    <Button variant="mindx">
                        <Plus className="h-4 w-4" />
                        Tạo bài viết
                    </Button>
                </Link>
            </div>

            {/* Tabs Filter */}
            <Tabs
                tabs={tabs}
                activeTab={filterStatus}
                onChange={(id) => setFilterStatus(id as 'all' | 'draft' | 'published' | 'hidden')}
            />

            {/* Posts Table */}
            <Card>
                {isLoading ? (
                    <TableSkeleton rows={5} columns={8} />
                ) : !posts || posts.length === 0 ? (
                    <EmptyState
                        icon={FileText}
                        title="Không tìm thấy bài viết"
                        description="Thử thay đổi bộ lọc hoặc tạo bài viết mới"
                        action={{
                            label: "Tạo bài viết",
                            onClick: () => window.location.href = '/admin/truyenthong/posts/create'
                        }}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Tiêu đề</TableHead>
                                    <TableHead>Loại</TableHead>
                                    <TableHead className="text-center">Trạng thái</TableHead>
                                    <TableHead>Ngày đăng</TableHead>
                                    <TableHead>Đối tượng</TableHead>
                                    <TableHead className="text-center">Lượt xem</TableHead>
                                    <TableHead className="text-center">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {posts.map((post, idx) => (
                                    <TableRow key={post.id}>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell className="font-medium max-w-xs truncate">
                                            {post.title}
                                        </TableCell>
                                        <TableCell>{post.post_type}</TableCell>
                                        <TableCell className="text-center">{getStatusBadge(post.status)}</TableCell>
                                        <TableCell>
                                            {post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-600">
                                            {post.audience}
                                        </TableCell>
                                        <TableCell className="text-center">{post.view_count?.toLocaleString('vi-VN') || 0}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 justify-center">
                                                <Link href={`/admin/truyenthong/posts/${post.slug}/edit`}>
                                                    <Button variant="ghost" size="icon-sm" title="Sửa" className="text-blue-700 hover:bg-blue-100">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteClick(post.slug)} title="Xóa" className="text-red-700 hover:bg-red-100">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </Card>

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
