'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { Search, Plus, Edit2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import DeleteConfirmationModal from '@/components/delete-confirmation-modal'

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

    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [postToDelete, setPostToDelete] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Open modal
    const handleDeleteClick = (slug: string) => {
        setPostToDelete(slug)
        setDeleteModalOpen(true)
    }

    // Actual delete function
    const confirmDelete = async () => {
        if (!postToDelete) return

        setIsDeleting(true)
        try {
            const res = await fetch(`/api/truyenthong/posts/${postToDelete}`, {
                method: 'DELETE',
            })

            if (!res.ok) throw new Error('Failed to delete')

            toast.success('Đã xóa bài viết thành công')
            mutate(posts?.filter(p => p.slug !== postToDelete), false) // Optimistic update
            setDeleteModalOpen(false)
        } catch (err) {
            toast.error('Có lỗi xảy ra khi xóa bài viết')
            mutate() // Revert on error
        } finally {
            setIsDeleting(false)
            setPostToDelete(null)
        }
    }

    const getStatusBadge = (status: string) => {
        const variants = {
            draft: 'secondary',
            published: 'default',
            hidden: 'outline',
        }
        const labels = {
            draft: 'Nháp',
            published: 'Đã công bố',
            hidden: 'Ẩn',
        }
        return (
            <Badge variant={variants[status as keyof typeof variants] as any}>
                {labels[status as keyof typeof labels] || status}
            </Badge>
        )
    }

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-col md:flex-row gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Quản lý bài viết</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Tổng cộng: {posts?.length || 0} bài viết
                        </p>
                    </div>
                    <Link href="/admin/truyenthong/posts/create">
                        <Button className="gap-2 bg-primary hover:bg-primary/90 transition-all hover:scale-105 shadow-md cursor-pointer">
                            <Plus className="w-4 h-4" />
                            Tạo bài viết mới
                        </Button>
                    </Link>
                </div>

                {/* Filter Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Tìm kiếm & Lọc</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Tìm kiếm bài viết..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="flex gap-2">
                                {(['all', 'draft', 'published', 'hidden'] as const).map(status => (
                                    <Button
                                        key={status}
                                        variant={filterStatus === status ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilterStatus(status)}
                                        className="text-xs cursor-pointer"
                                    >
                                        {status === 'all' && 'Tất cả'}
                                        {status === 'draft' && 'Nháp'}
                                        {status === 'published' && 'Công bố'}
                                        {status === 'hidden' && 'Ẩn'}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Posts Table */}
                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tiêu đề</TableHead>
                                <TableHead>Loại</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead>Ngày đăng</TableHead>
                                <TableHead>Đối tượng xem</TableHead>
                                <TableHead>Lượt xem</TableHead>
                                <TableHead className="text-right">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        Đang tải dữ liệu...
                                    </TableCell>
                                </TableRow>
                            ) : posts && posts.length > 0 ? (
                                posts.map(post => (
                                    <TableRow key={post.id} className="hover:bg-muted/80 transition-colors group">
                                        <TableCell className="font-medium max-w-xs truncate">
                                            {post.title}
                                        </TableCell>
                                        <TableCell>{post.post_type}</TableCell>
                                        <TableCell>{getStatusBadge(post.status)}</TableCell>
                                        <TableCell>
                                            {post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : '-'}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {post.audience}
                                        </TableCell>
                                        <TableCell>{post.view_count?.toLocaleString('vi-VN') || 0}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            {/* Link to Edit Page - assuming standardized route */}
                                            <Link href={`/admin/truyenthong/posts/${post.slug}/edit`}>
                                                <Button variant="ghost" size="sm" className="hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer">
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteClick(post.slug)}
                                                className="hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        <p className="text-muted-foreground">Không tìm thấy bài viết nào</p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Card>

                <DeleteConfirmationModal
                    isOpen={deleteModalOpen}
                    onClose={() => setDeleteModalOpen(false)}
                    onConfirm={confirmDelete}
                    isDeleting={isDeleting}
                    title="Xóa bài viết"
                    description="Bạn có chắc chắn muốn xóa bài viết này? Hành động này không thể hoàn tác và bài viết sẽ bị xóa vĩnh viễn khỏi hệ thống."
                />
            </div>
        </Suspense>
    )
}
