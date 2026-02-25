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

    const [thumbnailPreview, setThumbnailPreview] = useState<string>('')
    const [bannerPreview, setBannerPreview] = useState<string>('')
    const [previousThumbnail, setPreviousThumbnail] = useState<string>('')
    const [previousBanner, setPreviousBanner] = useState<string>('')
    const [previousThumbnailFile, setPreviousThumbnailFile] = useState<File | null>(null)
    const [previousBannerFile, setPreviousBannerFile] = useState<File | null>(null)

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
            // Set preview images from existing data
            if (postData.featured_image) {
                setThumbnailPreview(postData.featured_image)
            }
            if (postData.banner_image) {
                setBannerPreview(postData.banner_image)
            }
        }
    }, [postData])

    // Handle Ctrl+Z for undo delete
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault()
                
                // Restore thumbnail if it was deleted
                if (!thumbnailPreview && previousThumbnail) {
                    setThumbnailPreview(previousThumbnail)
                    if (previousThumbnailFile) {
                        setFiles(prev => ({ ...prev, thumbnail: previousThumbnailFile }))
                    }
                    setPreviousThumbnail('')
                    setPreviousThumbnailFile(null)
                    toast.success('Đã khôi phục ảnh thumbnail')
                    return
                }
                
                // Restore banner if it was deleted
                if (!bannerPreview && previousBanner) {
                    setBannerPreview(previousBanner)
                    if (previousBannerFile) {
                        setFiles(prev => ({ ...prev, banner: previousBannerFile }))
                    }
                    setPreviousBanner('')
                    setPreviousBannerFile(null)
                    toast.success('Đã khôi phục ảnh banner')
                    return
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [thumbnailPreview, bannerPreview, previousThumbnail, previousBanner, previousThumbnailFile, previousBannerFile])

    const handleImageFile = (file: File, type: 'thumbnail' | 'banner') => {
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Kích thước ảnh không được vượt quá 5MB')
            return
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn file ảnh')
            return
        }

        // Set file
        setFiles(prev => ({ ...prev, [type]: file }))

        // Show preview
        const reader = new FileReader()
        reader.onloadend = () => {
            if (type === 'thumbnail') {
                setThumbnailPreview(reader.result as string)
            } else {
                setBannerPreview(reader.result as string)
            }
        }
        reader.readAsDataURL(file)

        toast.success(`Đã chọn ảnh ${type === 'thumbnail' ? 'thumbnail' : 'banner'}. Ảnh sẽ được tải lên khi bạn lưu.`)
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>, type: 'thumbnail' | 'banner') => {
        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            
            if (item.type.startsWith('image/')) {
                e.preventDefault()
                const file = item.getAsFile()
                if (!file) continue

                handleImageFile(file, type)
                break
            }
        }
    }

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
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                <Link href="/admin/truyenthong/posts">
                    <Button variant="ghost" size="sm" className="gap-2 hover:bg-gray-100 transition-all hover:-translate-x-0.5">
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại
                    </Button>
                </Link>
                <div className="h-5 w-px bg-gray-300" />
                <h2 className="text-xl font-bold text-gray-900">Chỉnh sửa bài viết</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* Basic Info */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3">
                                <h3 className="text-sm font-bold text-gray-900">Thông tin cơ bản</h3>
                            </div>
                            <div className="space-y-4 p-5">
                                <div className="space-y-2">
                                    <Label htmlFor="title" className={`text-sm font-semibold ${errors.title ? 'text-red-500' : 'text-gray-700'}`}>Tiêu đề</Label>
                                    <Input
                                        id="title"
                                        placeholder="Nhập tiêu đề bài viết"
                                        value={formData.title}
                                        onChange={e => {
                                            setFormData({ ...formData, title: e.target.value })
                                            if (errors.title) setErrors({ ...errors, title: '' })
                                        }}
                                        className={`h-10 ${errors.title ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                                    />
                                    {errors.title && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1">
                                            <AlertCircle className="w-3 h-3" />
                                            <span className="text-xs">{errors.title}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description" className={`text-sm font-semibold ${errors.description ? 'text-red-500' : 'text-gray-700'}`}>Mô tả ngắn</Label>
                                    <Input
                                        id="description"
                                        placeholder="Nhập mô tả ngắn (1-2 dòng)"
                                        value={formData.description}
                                        onChange={e => {
                                            setFormData({ ...formData, description: e.target.value })
                                            if (errors.description) setErrors({ ...errors, description: '' })
                                        }}
                                        className={`h-10 ${errors.description ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                                    />
                                    {errors.description && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1">
                                            <AlertCircle className="w-3 h-3" />
                                            <span className="text-xs">{errors.description}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="content" className={`text-sm font-semibold ${errors.content ? 'text-red-500' : 'text-gray-700'}`}>Nội dung bài viết</Label>
                                    <RichTextEditor
                                        content={formData.content}
                                        onChange={(html) => {
                                            setFormData({ ...formData, content: html })
                                            if (errors.content) setErrors({ ...errors, content: '' })
                                        }}
                                        error={errors.content}
                                    />
                                    {errors.content && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1">
                                            <AlertCircle className="w-3 h-3" />
                                            <span className="text-xs">{errors.content}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Media */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Hình ảnh
                                </h3>
                            </div>
                            <div className="space-y-5 p-5">
                                {/* Thumbnail Upload */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                                        Hình ảnh nhỏ (Thumbnail)
                                    </Label>
                                    <div onPaste={(e) => handlePaste(e, 'thumbnail')} className="group">
                                        {thumbnailPreview ? (
                                            <div className="relative">
                                                <div className="relative overflow-hidden rounded-xl border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                                    <Image 
                                                        src={thumbnailPreview} 
                                                        alt="Thumbnail preview" 
                                                        width={400} 
                                                        height={250} 
                                                        className="rounded-lg w-full h-auto object-cover shadow-md" 
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // Save current state for undo
                                                        setPreviousThumbnail(thumbnailPreview)
                                                        setPreviousThumbnailFile(files.thumbnail)
                                                        
                                                        setThumbnailPreview('')
                                                        setFiles(prev => ({ ...prev, thumbnail: null }))
                                                        toast.success('Đã xóa ảnh thumbnail. Nhấn Ctrl+Z để khôi phục')
                                                    }}
                                                    className="absolute -top-2 -right-2 p-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl hover:scale-110"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 hover:from-blue-50 hover:to-indigo-50 transition-all">
                                                <div className="text-center">
                                                    <svg className="w-12 h-12 text-blue-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <p className="text-sm font-semibold text-gray-700 mb-1">Chọn hoặc dán ảnh thumbnail</p>
                                                    <p className="text-xs text-gray-500 mb-3">
                                                        <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">Ctrl</kbd>
                                                        {' + '}
                                                        <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">V</kbd>
                                                        {' để dán ảnh'}
                                                    </p>
                                                    <p className="text-xs text-gray-400">JPG, PNG, GIF (tối đa 5MB)</p>
                                                </div>
                                            </div>
                                        )}
                                        <Input
                                            id="thumbnail"
                                            type="file"
                                            accept="image/*"
                                            onChange={e => {
                                                const file = e.target.files?.[0]
                                                if (file) handleImageFile(file, 'thumbnail')
                                            }}
                                            className="mt-2 h-10 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-200"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs">
                                        <span className="bg-white px-2 text-gray-400">và</span>
                                    </div>
                                </div>

                                {/* Banner Upload */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                                        Hình ảnh lớn (Banner)
                                    </Label>
                                    <div onPaste={(e) => handlePaste(e, 'banner')} className="group">
                                        {bannerPreview ? (
                                            <div className="relative">
                                                <div className="relative overflow-hidden rounded-xl border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                                                    <Image 
                                                        src={bannerPreview} 
                                                        alt="Banner preview" 
                                                        width={600} 
                                                        height={300} 
                                                        className="rounded-lg w-full h-auto object-cover shadow-md" 
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // Save current state for undo
                                                        setPreviousBanner(bannerPreview)
                                                        setPreviousBannerFile(files.banner)
                                                        
                                                        setBannerPreview('')
                                                        setFiles(prev => ({ ...prev, banner: null }))
                                                        toast.success('Đã xóa ảnh banner. Nhấn Ctrl+Z để khôi phục')
                                                    }}
                                                    className="absolute -top-2 -right-2 p-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl hover:scale-110"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 hover:from-indigo-50 hover:to-purple-50 transition-all">
                                                <div className="text-center">
                                                    <svg className="w-12 h-12 text-indigo-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h18M3 12h18M3 16h18" />
                                                    </svg>
                                                    <p className="text-sm font-semibold text-gray-700 mb-1">Chọn hoặc dán ảnh banner</p>
                                                    <p className="text-xs text-gray-500 mb-3">
                                                        <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">Ctrl</kbd>
                                                        {' + '}
                                                        <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm">V</kbd>
                                                        {' để dán ảnh'}
                                                    </p>
                                                    <p className="text-xs text-gray-400">JPG, PNG, GIF (tối đa 5MB)</p>
                                                </div>
                                            </div>
                                        )}
                                        <Input
                                            id="banner"
                                            type="file"
                                            accept="image/*"
                                            onChange={e => {
                                                const file = e.target.files?.[0]
                                                if (file) handleImageFile(file, 'banner')
                                            }}
                                            className="mt-2 h-10 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-5">
                        {/* Type & Status */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3">
                                <h3 className="text-sm font-bold text-gray-900">Cài đặt</h3>
                            </div>
                            <div className="space-y-4 p-5">
                                <div className="space-y-2">
                                    <Label htmlFor="type" className="text-sm font-semibold text-gray-700">Loại bài viết</Label>
                                    <select
                                        id="type"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-sm"
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
                                    <Label htmlFor="audience" className="text-sm font-semibold text-gray-700">Đối tượng xem</Label>
                                    <select
                                        id="audience"
                                        value={formData.audience}
                                        onChange={e =>
                                            setFormData({ ...formData, audience: e.target.value })
                                        }
                                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-sm"
                                    >
                                        <option value="toàn-công-ty">Toàn công ty</option>
                                        <option value="bộ-phận-hr">Bộ phận HR</option>
                                        <option value="quản-lý">Quản lý cấp cao</option>
                                        <option value="kỹ-thuật">Bộ phận kỹ thuật</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="status" className="text-sm font-semibold text-gray-700">Trạng thái</Label>
                                    <select
                                        id="status"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-sm"
                                    >
                                        <option value="draft">Nháp</option>
                                        <option value="published">Công bố</option>
                                        <option value="hidden">Ẩn</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="publishDate" className={`text-sm font-semibold ${errors.publishDate ? 'text-red-500' : 'text-gray-700'}`}>Ngày đăng</Label>
                                    <Input
                                        id="publishDate"
                                        type="datetime-local"
                                        value={formData.publishDate}
                                        onChange={e => {
                                            setFormData({ ...formData, publishDate: e.target.value })
                                            if (errors.publishDate) setErrors({ ...errors, publishDate: '' })
                                        }}
                                        className={`h-10 ${errors.publishDate ? 'border-red-500 bg-red-50/30' : 'border-gray-300'}`}
                                    />
                                    {errors.publishDate && (
                                        <div className="flex items-center gap-1.5 text-red-500 mt-1">
                                            <AlertCircle className="w-3 h-3" />
                                            <span className="text-xs">{errors.publishDate}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2.5 p-4 bg-white border rounded-xl shadow-sm border-gray-200">
                            <Button type="submit" className="w-full h-11 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all hover:shadow-lg" disabled={loading}>
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Cập nhật
                            </Button>
                            <Link href="/admin/truyenthong/posts" className="w-full">
                                <Button type="button" variant="outline" className="w-full h-11 text-sm hover:bg-gray-100 hover:border-gray-300 transition-all font-semibold">
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
