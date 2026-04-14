'use client'

import { useAuth } from '@/lib/auth-context'
import {
  ChevronLeft,
  ChevronRight,
  MessageCircleMore,
  UploadCloud,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const FEEDBACK_PAGE_OPTIONS = [
  { path: '/user/home', title: 'Trang chủ' },
  { path: '/user/truyenthong', title: 'Truyền thông nội bộ' },
  { path: '/user/thong-tin-giao-vien', title: 'Thông tin của tôi' },
  { path: '/user/hoat-dong-hang-thang', title: 'Hoạt động hàng tháng' },
  { path: '/user/xin-nghi-mot-buoi', title: 'Tạo yêu cầu xin nghỉ' },
  { path: '/user/nhan-lop-1-buoi', title: 'Danh sách nhận lớp 1 buổi' },
  { path: '/user/dao-tao-nang-cao', title: 'Đào tạo nâng cao' },
  { path: '/user/assignments', title: 'Quản lý kiểm tra' },
  { path: '/user/giaitrinh', title: 'Giải trình điểm kiểm tra' },
  { path: '/user/quy-trinh-quy-dinh', title: 'Quy trình & Quy định' },
  { path: '/user/quan-ly-phan-hoi', title: 'Quản lý phản hồi' },
]

const getFallbackPageTitle = (path: string) => {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return 'Trang hiện tại'
  const raw = segments[segments.length - 1]
  return raw
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
export default function UserFeedbackWidget() {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [selectedScreenPath, setSelectedScreenPath] = useState(pathname)
  const [images, setImages] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [previewImages, setPreviewImages] = useState<string[] | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)

  const selectedPageTitle = useMemo(() => {
    const selected = FEEDBACK_PAGE_OPTIONS.find(
      (item) => item.path === selectedScreenPath,
    )
    return selected?.title ?? getFallbackPageTitle(selectedScreenPath)
  }, [selectedScreenPath])

  useEffect(() => {
    if (open) {
      setSelectedScreenPath(pathname)
    }
  }, [open, pathname])

  const canSubmit = useMemo(
    () => content.trim().length > 0 && !submitting,
    [content, submitting],
  )

  useEffect(() => {
    if (!open && !previewImages) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (previewImages) {
          setPreviewImages(null)
          return
        }
        if (open) setOpen(false)
        return
      }

      if (!previewImages || previewImages.length === 0) return
      if (event.key === 'ArrowLeft') {
        setPreviewIndex(
          (prev) => (prev - 1 + previewImages.length) % previewImages.length,
        )
      } else if (event.key === 'ArrowRight') {
        setPreviewIndex((prev) => (prev + 1) % previewImages.length)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, previewImages])

  const uploadImages = async () => {
    if (images.length === 0) return [] as string[]
    const uploaded = await Promise.all(
      images.map(async (image) => {
        const formData = new FormData()
        formData.append('file', image)
        const response = await fetch('/api/feedback/upload-image', {
          method: 'POST',
          body: formData,
        })
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Không thể upload ảnh')
        }
        return data.storagePath || data.url
      }),
    )
    return uploaded.filter(Boolean)
  }

  const handleSubmit = async () => {
    if (!user?.email || !canSubmit) return
    try {
      setSubmitting(true)
      const imageUrls = await uploadImages()
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestEmail: user.email,
          userName: user.displayName,
          screenPath: selectedScreenPath,
          content: content.trim(),
          suggestion: suggestion.trim(),
          imageUrls,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Không thể gửi feedback')
      }

      setContent('')
      setSuggestion('')
      setImages([])
      toast.success('Đã gửi ý kiến phản hồi')
      setOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Lỗi gửi feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full bg-[#a1001f] text-white shadow-lg hover:bg-[#870019] transition-colors flex items-center justify-center"
          title="Feedback"
        >
          <MessageCircleMore className="h-6 w-6" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="w-full max-w-2xl max-h-[88vh] bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden flex flex-col">
            <div className="bg-[#a1001f] px-4 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">
                  Gửi ý kiến phản hồi
                </h3>
                <p className="text-xs text-white/85 mt-0.5">
                  Giúp hệ thống xử lý phản hồi nhanh và chính xác hơn
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto min-h-0">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Nội dung
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder="Mô tả vấn đề hoặc góp ý của bạn..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Đề xuất
                </label>
                <textarea
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  rows={3}
                  placeholder="Bạn muốn cải thiện như thế nào?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Đang ở trang nào
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={selectedScreenPath}
                    onChange={(e) => setSelectedScreenPath(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {FEEDBACK_PAGE_OPTIONS.map((option) => (
                      <option key={option.path} value={option.path}>
                        {option.title}
                      </option>
                    ))}
                    {!FEEDBACK_PAGE_OPTIONS.some(
                      (option) => option.path === selectedScreenPath,
                    ) && (
                      <option value={selectedScreenPath}>
                        {selectedPageTitle}
                      </option>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedScreenPath) return
                      setOpen(false)
                      router.push(selectedScreenPath)
                    }}
                    className="shrink-0 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Đi tới trang
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Trang đang chọn:{' '}
                  <span className="font-medium">{selectedPageTitle}</span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Ảnh minh họa
                </label>
                <label className="border-2 border-dashed border-gray-300 rounded-xl p-4 block cursor-pointer hover:border-[#a1001f]/40 hover:bg-[#a1001f]/2 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) =>
                      setImages(Array.from(e.target.files || []))
                    }
                  />
                  <div
                    className="min-h-16 flex items-center justify-center text-center gap-2 text-sm text-gray-600"
                    onPaste={(e) => {
                      const fileItems = Array.from(e.clipboardData.items || [])
                        .filter((item) => item.type.startsWith('image/'))
                        .map((item) => item.getAsFile())
                        .filter((file): file is File => Boolean(file))
                      if (fileItems.length > 0) {
                        e.preventDefault()
                        setImages((prev) => [...prev, ...fileItems])
                      }
                    }}
                  >
                    <UploadCloud className="h-4 w-4" />
                    Chọn ảnh, kéo-thả, hoặc dán ảnh (Ctrl+V)
                  </div>
                </label>
                {images.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 overflow-x-auto">
                    {images.slice(0, 3).map((file, idx) => (
                      <div
                        key={file.name + file.size + idx}
                        className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-24 h-24 object-cover"
                        />                        <button
                          type="button"
                          onClick={() =>
                            setImages((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="absolute top-1 right-1 bg-black/60 text-white rounded p-0.5 hover:bg-red-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {images.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          const urls = images.map((file) =>
                            URL.createObjectURL(file),
                          )
                          setPreviewImages(urls)
                          setPreviewIndex(3)
                        }}
                        className="w-24 h-24 shrink-0 rounded-lg border border-gray-300 bg-gray-50 text-sm font-semibold text-gray-700"
                      >
                        +{images.length - 3}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="w-full px-4 py-2.5 rounded-lg bg-[#a1001f] text-white text-sm font-medium hover:bg-[#870019] disabled:opacity-60"
              >
                {submitting ? 'Đang gửi...' : 'Gửi ý kiến phản hồi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImages && previewImages.length > 0 && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl">
            <button
              type="button"
              onClick={() => setPreviewImages(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="bg-black rounded-xl overflow-hidden border border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImages[previewIndex]}
                alt={`feedback-${previewIndex + 1}`}
                className="w-full max-h-[78vh] object-contain"
              />
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setPreviewIndex(
                    (prev) =>
                      (prev - 1 + previewImages.length) % previewImages.length,
                  )
                }
                className="text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-white">
                {previewIndex + 1} / {previewImages.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPreviewIndex((prev) => (prev + 1) % previewImages.length)
                }
                className="text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
