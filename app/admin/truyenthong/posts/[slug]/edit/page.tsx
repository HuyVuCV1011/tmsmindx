'use client'

import React, { useState, useEffect } from "react"
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import toast from 'react-hot-toast'
import useSWR from 'swr'
import dynamic from 'next/dynamic'

// Dynamic import for RichTextEditor to avoid SSR issues
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
    ssr: false,
    loading: () => <div className="border rounded-xl p-4 min-h-75 animate-pulse bg-muted/20">Đang tải editor...</div>
})

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function EditPostPage() {
    const router = useRouter()
    const params = useParams()
    const slug = params?.slug

    // Using SWR for initial data fetch
    const { data: postData, error, isLoading: isFetching } = useSWR(
        slug ? `/api/truyenthong/posts/${slug}` : null,
        fetcher
    )

    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        content: '',
        type: 'tin-tức',
        status: 'draft',
        audience: 'toàn-công-ty',
        publishDate: '',
    })

    const [errors, setErrors] = useState<Record<string, string>>({})

    const [files, setFiles] = useState<{
        thumbnail: File | null;
        banner: File | null;
    }>({
        thumbnail: null,
        banner: null
    })

    // Populate form data when postData is loaded
    useEffect(() => {
        if (postData && !postData.error) {
            setFormData({
                title: postData.title || '',
                description: postData.description || '',
                content: postData.content || '',
                type: postData.post_type || 'tin-tức',
                status: postData.status || 'draft',
                audience: postData.audience || 'toàn-công-ty',
                // Format date for datetime-local input: YYYY-MM-DDThh:mm
                publishDate: postData.published_at ? new Date(postData.published_at).toISOString().slice(0, 16) : '',
            })
        }
    }, [postData])

    const uploadImage = async (file: File) => {
        const formData = new FormData()
        formData.append('image', file)

        const res = await fetch('/api/upload-thumbnail', {
            method: 'POST',
            body: formData
        })

        if (!res.ok) throw new Error('Failed to upload image')

        const data = await res.json()
        return data.url
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrors({})

        // Validation
        const newErrors: Record<string, string> = {}
        if (!formData.title.trim()) newErrors.title = 'Tiêu đề không được để trống'
        if (!formData.description.trim()) newErrors.description = 'Mô tả ngắn không được để trống'
        if (!formData.publishDate) newErrors.publishDate = 'Ngày đăng không được để trống'
        if (!formData.content.trim()) newErrors.content = 'Nội dung không được để trống'

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors)
            toast.error('Vui lòng kiểm tra lại các thông tin còn thiếu')
            return
        }

        setLoading(true)

        try {
            let featured_image = postData.featured_image
            let banner_image = postData.banner_image

            // Upload new images if selected
            if (files.thumbnail) {
                featured_image = await uploadImage(files.thumbnail)
            }
            if (files.banner) {
                banner_image = await uploadImage(files.banner)
            }

            const payload = {
                title: formData.title,
                description: formData.description,
                content: formData.content,
                post_type: formData.type,
                status: formData.status,
                audience: formData.audience,
                published_at: formData.publishDate ? new Date(formData.publishDate).toISOString() : new Date().toISOString(),
                featured_image,
                banner_image
            }

            const res = await fetch(`/api/truyenthong/posts/${slug}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error('Failed to update post')

            toast.success('Bài viết đã được cập nhật thành công!')
            router.push('/admin/truyenthong/posts')
        } catch (error) {
            console.error(error)
            toast.error('Có lỗi xảy ra khi cập nhật bài viết')
        } finally {
            setLoading(false)
        }
    }

    if (isFetching) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || (postData && postData.error)) {
        return (
            <div className="flex flax-col items-center justify-center h-40">
                <p className="text-destructive font-medium">Không tìm thấy bài viết hoặc có lỗi xảy ra.</p>
                <Link href="/admin/truyenthong/posts">
                    <Button variant="link">Quay lại danh sách</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 py-2 border-b border-border/50 mb-6 bg-card -mx-4 px-4 sticky top-0 z-10 shadow-sm">
                <Link href="/admin/truyenthong/posts">
                    <Button variant="ghost" size="sm" className="gap-2 hover:bg-muted/80 transition-all hover:-translate-x-1 cursor-pointer">
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại
                    </Button>
                </Link>
                <div className="h-6 w-px bg-border mx-2" />
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Chỉnh sửa bài viết</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Basic Info */}
                        <Card className="shadow-md border-primary/10">
                            <CardHeader className="border-b bg-muted/20">
                                <CardTitle className="text-base font-semibold text-primary">Thông tin cơ bản</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="title" className={`${errors.title ? 'text-red-500' : 'group-focus-within:text-primary'} transition-colors font-medium`}>Tiêu đề</Label>
                                    </div>
                                    <Input
                                        id="title"
                                        placeholder="Nhập tiêu đề bài viết"
                                        value={formData.title}
                                        onChange={e => {
                                            setFormData({ ...formData, title: e.target.value })
                                            if (errors.title) setErrors({ ...errors, title: '' })
                                        }}
                                        className={`focus-visible:ring-primary/50 transition-all h-11 ${errors.title ? 'border-red-500 bg-red-50/30 focus-visible:ring-red-500/20 shadow-sm shadow-red-100' : ''}`}
                                    />
                                    {errors.title && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span className="text-[11px] font-medium leading-none">{errors.title}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="description" className={`${errors.description ? 'text-red-500' : 'group-focus-within:text-primary'} transition-colors font-medium`}>Mô tả ngắn</Label>
                                    </div>
                                    <Input
                                        id="description"
                                        placeholder="Nhập mô tả ngắn (1-2 dòng)"
                                        value={formData.description}
                                        onChange={e => {
                                            setFormData({ ...formData, description: e.target.value })
                                            if (errors.description) setErrors({ ...errors, description: '' })
                                        }}
                                        className={`focus-visible:ring-primary/50 transition-all h-11 ${errors.description ? 'border-red-500 bg-red-50/30 focus-visible:ring-red-500/20 shadow-sm shadow-red-100' : ''}`}
                                    />
                                    {errors.description && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span className="text-[11px] font-medium leading-none">{errors.description}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="content" className={`${errors.content ? 'text-red-500' : 'group-focus-within:text-primary'} transition-colors font-medium`}>Nội dung bài viết</Label>
                                    </div>
                                    <RichTextEditor
                                        content={formData.content}
                                        onChange={(html) => {
                                            setFormData({ ...formData, content: html })
                                            if (errors.content) setErrors({ ...errors, content: '' })
                                        }}
                                        error={errors.content}
                                    />
                                    {errors.content && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span className="text-[11px] font-medium leading-none">{errors.content}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Media */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Hình ảnh</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2 cursor-pointer">
                                    <Label htmlFor="thumbnail">Hình ảnh nút nhỏ</Label>
                                    {postData?.featured_image && (
                                        <div className="mb-2">
                                            <p className="text-xs text-muted-foreground mb-1">Hiện tại:</p>
                                            <Image src={postData.featured_image} alt="Thumbnail cũ" width={80} height={80} className="h-20 w-auto object-cover rounded" />
                                        </div>
                                    )}
                                    <Input
                                        id="thumbnail"
                                        type="file"
                                        accept="image/*"
                                        className=" cursor-pointer"
                                        onChange={e => setFiles({ ...files, thumbnail: e.target.files?.[0] || null })}
                                    />
                                </div>

                                <div className="space-y-2 cursor-pointer">
                                    <Label htmlFor="banner">Hình ảnh banner</Label>
                                    {postData?.banner_image && (
                                        <div className="mb-2">
                                            <p className="text-xs text-muted-foreground mb-1">Hiện tại:</p>
                                            <Image src={postData.banner_image} alt="Banner cũ" width={80} height={80} className="h-20 w-auto object-cover rounded" />
                                        </div>
                                    )}
                                    <Input
                                        id="banner"
                                        type="file"
                                        accept="image/*"
                                        className=" cursor-pointer"
                                        onChange={e => setFiles({ ...files, banner: e.target.files?.[0] || null })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Type & Status */}
                        <Card className="shadow-md border-primary/10">
                            <CardHeader className="border-b bg-muted/20">
                                <CardTitle className="text-base font-semibold text-primary">Cài đặt</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="space-y-2">
                                    <Label htmlFor="type">Loại bài viết</Label>
                                    <select
                                        id="type"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="cursor-pointer w-full px-3 py-2 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all shadow-sm"
                                    >
                                        <option value="tin-tức">Tin tức</option>
                                        <option value="chính-sách">Chính sách</option>
                                        <option value="sự-kiện">Sự kiện</option>
                                        <option value="đào-tạo">Đào tạo</option>
                                        <option value="báo-cáo">Báo cáo</option>
                                        <option value="thông-báo">Thông báo</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="audience">Đối tượng xem</Label>
                                    <select
                                        id="audience"
                                        value={formData.audience}
                                        onChange={e =>
                                            setFormData({ ...formData, audience: e.target.value })
                                        }
                                        className="cursor-pointer w-full px-3 py-2 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all shadow-sm"
                                    >
                                        <option value="toàn-công-ty">Toàn công ty</option>
                                        <option value="bộ-phận-hr">Bộ phận HR</option>
                                        <option value="quản-lý">Quản lý cấp cao</option>
                                        <option value="kỹ-thuật">Bộ phận kỹ thuật</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="status">Trạng thái</Label>
                                    <select
                                        id="status"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="cursor-pointer w-full px-3 py-2 border border-border rounded-xl bg-background text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all shadow-sm"
                                    >
                                        <option value="draft">Nháp</option>
                                        <option value="published">Công bố</option>
                                        <option value="hidden">Ẩn</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="publishDate" className={`${errors.publishDate ? 'text-red-500' : ''} font-medium`}>Ngày đăng</Label>
                                    <Input
                                        id="publishDate"
                                        type="datetime-local"
                                        value={formData.publishDate}
                                        onChange={e => {
                                            setFormData({ ...formData, publishDate: e.target.value })
                                            if (errors.publishDate) setErrors({ ...errors, publishDate: '' })
                                        }}
                                        className={`rounded-xl h-11 focus-visible:ring-primary/50 ${errors.publishDate ? 'border-red-500 bg-red-50/30 focus-visible:ring-red-500/20 shadow-sm shadow-red-100' : ''}`}
                                    />
                                    {errors.publishDate && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span className="text-[11px] font-medium leading-none">{errors.publishDate}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 p-4 bg-card border rounded-xl shadow-lg border-primary/10">
                            <Button type="submit" className="w-full py-6 text-lg font-bold bg-primary hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-primary/20 cursor-pointer" disabled={loading}>
                                {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                                Cập nhật
                            </Button>
                            <Link href="/admin/truyenthong/posts" className="w-full">
                                <Button type="button" variant="outline" className="w-full py-6 text-base hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all font-medium cursor-pointer">
                                    Hủy bỏ
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    )
}
