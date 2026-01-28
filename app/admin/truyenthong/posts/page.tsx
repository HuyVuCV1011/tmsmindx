'use client'

import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageContainer } from '@/components/PageContainer'
import { SearchBar } from '@/components/SearchBar'
import { Tabs } from '@/components/Tabs'
import { Edit, FileText, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'
import useSWR from 'swr'

interface Post {
    id: number
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

    const { data: posts, error, isLoading, mutate } = useSWR<Post[]>(
        `/api/truyenthong/posts?${queryParams.toString()}`,
        fetcher
    )

    const getStatusBadge = (status: string) => {
        const styles = {
            draft: 'bg-amber-100 text-amber-700',
            published: 'bg-green-100 text-green-700',
            hidden: 'bg-gray-100 text-gray-700',
        }
        const labels = {
            draft: 'Nháp',
            published: 'Đã công bố',
            hidden: 'Ẩn',
        }
        return (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
                {labels[status as keyof typeof labels] || status}
            </span>
        )
    }

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [postToDelete, setPostToDelete] = useState<number | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDeleteClick = (id: number) => {
        setPostToDelete(id)
        setDeleteConfirmOpen(true)
    }

    const confirmDelete = async () => {
        if (!postToDelete) return

        setIsDeleting(true)
        try {
            const res = await fetch(`/api/truyenthong/posts/${postToDelete}`, {
                method: 'DELETE',
            })

            if (!res.ok) throw new Error('Failed to delete')

            toast.success('Đã xóa bài viết thành công')
            mutate(posts?.filter(p => p.id !== postToDelete), false)
            setDeleteConfirmOpen(false)
        } catch (err) {
            toast.error('Có lỗi xảy ra khi xóa bài viết')
            mutate()
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

    if (isLoading) {
        return <LoadingSpinner text="Đang tải bài viết..." />
    }

    return (
        <PageContainer
            title="Quản lý bài viết"
            description={`Tổng cộng: ${posts?.length || 0} bài viết`}
        >
            {/* Create Button */}
            <div className="flex justify-between items-center mb-4">
                <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Tìm kiếm bài viết..."
                />
                <Link href="/admin/truyenthong/posts/create">
                    <button className="flex items-center gap-2 bg-[#a1001f] hover:bg-[#c41230] text-white px-4 py-2 rounded-lg font-semibold transition-colors ml-4">
                        <Plus className="h-4 w-4" />
                        Tạo bài viết
                    </button>
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
                {!posts || posts.length === 0 ? (
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
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-y border-gray-200">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold">#</th>
                                    <th className="px-3 py-2 text-left font-semibold">Tiêu đề</th>
                                    <th className="px-3 py-2 text-left font-semibold">Loại</th>
                                    <th className="px-3 py-2 text-center font-semibold">Trạng thái</th>
                                    <th className="px-3 py-2 text-left font-semibold">Ngày đăng</th>
                                    <th className="px-3 py-2 text-left font-semibold">Đối tượng</th>
                                    <th className="px-3 py-2 text-center font-semibold">Lượt xem</th>
                                    <th className="px-3 py-2 text-center font-semibold">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {posts.map((post, idx) => (
                                    <tr key={post.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2">{idx + 1}</td>
                                        <td className="px-3 py-2 font-medium max-w-xs truncate">
                                            {post.title}
                                        </td>
                                        <td className="px-3 py-2">{post.post_type}</td>
                                        <td className="px-3 py-2 text-center">{getStatusBadge(post.status)}</td>
                                        <td className="px-3 py-2">
                                            {post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-gray-600">
                                            {post.audience}
                                        </td>
                                        <td className="px-3 py-2 text-center">{post.view_count?.toLocaleString('vi-VN') || 0}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex gap-1 justify-center">
                                                <Link href={`/admin/truyenthong/posts/${post.id}/edit`}>
                                                    <button
                                                        className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                                        title="Sửa"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                </Link>
                                                <button
                                                    onClick={() => handleDeleteClick(post.id)}
                                                    className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Delete Confirmation Modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full">
                        <h3 className="text-lg font-bold mb-2">Xóa bài viết</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Bạn có chắc chắn muốn xóa bài viết này? Hành động này không thể hoàn tác.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => { setDeleteConfirmOpen(false); setPostToDelete(null); }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                disabled={isDeleting}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                            >
                                {isDeleting ? 'Đang xóa...' : 'Xóa'}
                            </button>
                        </div>
                    </Card>
                </div>
            )}
        </PageContainer>
    )
}
