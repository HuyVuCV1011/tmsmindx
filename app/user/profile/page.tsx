'use client'

import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import {
    Award,
    BookOpen,
    Calendar,
    ChevronDown,
    Eye,
    EyeOff,
    FileText,
    Image as ImageIcon,
    Mail,
    Plus,
    Shield,
    Trash2,
    Upload,
    User,
    X
} from 'lucide-react'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import useSWR from 'swr'

interface Certificate {
    id: number
    teacher_email: string
    certificate_name: string
    certificate_url: string
    certificate_type: string
    issue_date: string
    expiry_date: string
    description: string
    cloudinary_public_id: string
    created_at: string
}

interface PrivacySettings {
    id: number
    teacher_email: string
    show_birthday: boolean
    show_on_public_list: boolean
    show_phone: boolean
    show_personal_email: boolean
    created_at: string
    updated_at: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())
const BIRTHDAY_PRIVACY_SYNC_KEY = 'birthday-privacy-updated-at'

export default function TeacherProfilePage() {
    const { user } = useAuth()
    const [isUploadingCert, setIsUploadingCert] = useState(false)
    const [showCertModal, setShowCertModal] = useState(false)
    const [selectedCertImage, setSelectedCertImage] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const certTypeDropdownRef = useRef<HTMLDivElement>(null)
    const [isCertTypeOpen, setIsCertTypeOpen] = useState(false)
    const [selectedCertFile, setSelectedCertFile] = useState<File | null>(null)

    // Certificate form state
    const [certForm, setCertForm] = useState({
        name: '',
        type: '',
        issueDate: '',
        expiryDate: '',
        description: '',
    })

    useEffect(() => {
        if (!isCertTypeOpen) return

        const handleOutsideClick = (event: MouseEvent) => {
            if (!certTypeDropdownRef.current?.contains(event.target as Node)) {
                setIsCertTypeOpen(false)
            }
        }

        document.addEventListener('mousedown', handleOutsideClick)
        return () => document.removeEventListener('mousedown', handleOutsideClick)
    }, [isCertTypeOpen])

    // Fetch certificates
    const { data: certificatesData, mutate: mutateCertificates } = useSWR(
        user?.email ? `/api/teacher-certificates?email=${user.email}` : null,
        fetcher
    )

    // Fetch privacy settings
    const { data: privacyData, mutate: mutatePrivacy } = useSWR(
        user?.email ? `/api/teacher-privacy?email=${user.email}` : null,
        fetcher
    )

    // Fetch teacher info from API to get teaching level
    const { data: teacherData } = useSWR(
        user?.email ? `/api/teachers?email=${user.email}` : null,
        fetcher
    )

    const certificates = certificatesData?.data || []
    const privacySettings = privacyData?.data
    const teacherInfo = teacherData?.teacher // API returns { teacher: {...} }

    // Debug log to check teacher data
    console.log('Teacher Data:', teacherData)
    console.log('Teacher Info:', teacherInfo)
    console.log('Program Current:', teacherInfo?.programCurrent)

    // Handle privacy setting toggle
    const handlePrivacyToggle = async (setting: keyof Omit<PrivacySettings, 'id' | 'teacher_email' | 'created_at' | 'updated_at'>) => {
        if (!user?.email || !privacySettings) return

        const newValue = !privacySettings[setting]
        const toastId = toast.loading('Đang cập nhật...')

        try {
            const response = await fetch('/api/teacher-privacy', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacher_email: user.email,
                    ...privacySettings,
                    [setting]: newValue,
                }),
            })

            if (!response.ok) throw new Error('Failed to update')

            toast.success('Đã cập nhật cài đặt', { id: toastId })
            mutatePrivacy()

            // Invalidate birthdays cache nếu thay đổi show_birthday
            if (setting === 'show_birthday') {
                console.log('[Privacy] show_birthday changed, invalidating cache...')
                window.localStorage.setItem(BIRTHDAY_PRIVACY_SYNC_KEY, String(Date.now()))
                
                try {
                    await fetch('/api/birthdays/invalidate', { method: 'POST' })
                    console.log('[Privacy] Cache invalidated successfully')
                } catch (err) {
                    console.warn('[Privacy] Failed to invalidate cache:', err)
                }

                // Dispatch event để sidebar revalidate dữ liệu
                console.log('[Privacy] Dispatching privacy-setting-changed event')
                window.dispatchEvent(new CustomEvent('privacy-setting-changed'))
            }
        } catch (error) {
            console.error('Update privacy error:', error)
            toast.error('Lỗi khi cập nhật', { id: toastId })
        }
    }

    const validateCertificateFile = (file: File) => {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
        if (!validTypes.includes(file.type)) {
            return 'Chỉ hỗ trợ file ảnh (JPG, PNG, WEBP) hoặc PDF'
        }

        if (file.size > 10 * 1024 * 1024) {
            return 'Kích thước file tối đa 10MB'
        }

        return null
    }

    const handleCertificateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const validationError = validateCertificateFile(file)
        if (validationError) {
            toast.error(validationError)
            setSelectedCertFile(null)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
            return
        }

        setSelectedCertFile(file)
        toast.success('Đã chọn file chứng chỉ')
    }

    const handleSubmitCertificate = async () => {
        const file = selectedCertFile
        if (!file) {
            toast.error('Vui lòng chọn file chứng chỉ trước khi gửi')
            return
        }

        const validationError = validateCertificateFile(file)
        if (validationError) {
            toast.error(validationError)
            return
        }

        setIsUploadingCert(true)
        const toastId = toast.loading('Đang tải lên chứng chỉ...')

        try {
            // Get Cloudinary signature
            const signatureResponse = await fetch('/api/cloudinary-signature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder: 'teacher_certificates' }),
            })

            if (!signatureResponse.ok) throw new Error('Failed to get signature')

            const { signature, timestamp, cloudName, apiKey, folder } = await signatureResponse.json()

            // Upload to Cloudinary
            const formData = new FormData()
            formData.append('file', file)
            formData.append('signature', signature)
            formData.append('timestamp', timestamp.toString())
            formData.append('api_key', apiKey)
            formData.append('folder', folder)

            const uploadResponse = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
                {
                    method: 'POST',
                    body: formData,
                }
            )

            if (!uploadResponse.ok) throw new Error('Failed to upload to Cloudinary')

            const uploadData = await uploadResponse.json()

            // Save certificate to database
            const saveResponse = await fetch('/api/teacher-certificates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacher_email: user?.email,
                    certificate_name: certForm.name || file.name,
                    certificate_url: uploadData.secure_url,
                    certificate_type: certForm.type || 'Other',
                    issue_date: certForm.issueDate || null,
                    expiry_date: certForm.expiryDate || null,
                    description: certForm.description || null,
                    cloudinary_public_id: uploadData.public_id,
                }),
            })

            if (!saveResponse.ok) throw new Error('Failed to save certificate')

            toast.success('Tải lên chứng chỉ thành công!', { id: toastId })
            mutateCertificates()
            setShowCertModal(false)
            setCertForm({ name: '', type: '', issueDate: '', expiryDate: '', description: '' })
            setSelectedCertFile(null)
        } catch (error) {
            console.error('Upload error:', error)
            toast.error('Lỗi khi tải lên chứng chỉ', { id: toastId })
        } finally {
            setIsUploadingCert(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    // Handle delete certificate
    const handleDeleteCertificate = async (certId: number) => {
        if (!confirm('Bạn có chắc muốn xóa chứng chỉ này?')) return

        const toastId = toast.loading('Đang xóa...')

        try {
            const response = await fetch(
                `/api/teacher-certificates?id=${certId}&email=${user?.email}`,
                {
                    method: 'DELETE',
                }
            )

            if (!response.ok) throw new Error('Failed to delete')

            toast.success('Đã xóa chứng chỉ', { id: toastId })
            mutateCertificates()
        } catch (error) {
            console.error('Delete error:', error)
            toast.error('Lỗi khi xóa chứng chỉ', { id: toastId })
        }
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleDateString('vi-VN')
    }

    const getCertTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            'Language': 'bg-blue-100 text-blue-700 border-blue-200',
            'Technology': 'bg-purple-100 text-purple-700 border-purple-200',
            'Teaching': 'bg-green-100 text-green-700 border-green-200',
            'Other': 'bg-gray-100 text-gray-700 border-gray-200',
        }
        return colors[type] || colors['Other']
    }

    if (!user) return null

    return (
        <PageContainer padding="lg">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Profile Header */}
                <div className="bg-[#a1001f] rounded-3xl p-8 text-white shadow-2xl">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Avatar */}
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center shadow-2xl">
                                <User className="w-16 h-16 text-white" />
                            </div>
                            <button className="absolute bottom-0 right-0 w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                                <Upload className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Info */}
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl font-black mb-2">{user.displayName}</h1>
                            <div className="flex flex-col md:flex-row gap-4 text-white/90">
                                <div className="flex items-center gap-2 justify-center md:justify-start">
                                    <Mail className="w-5 h-5" />
                                    <span className="font-medium">{user.email}</span>
                                </div>
                                <div className="flex items-center gap-2 justify-center md:justify-start">
                                    <Award className="w-5 h-5" />
                                    <span className="font-semibold capitalize">{user.role}</span>
                                </div>
                                {teacherInfo?.status && (
                                    <div className="flex items-center gap-2 justify-center md:justify-start">
                                        <BookOpen className="w-5 h-5" />
                                        <span className="font-semibold">Khối: {teacherInfo.status}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Teacher Information Section */}
                {teacherInfo && (
                    <div className="bg-white rounded-3xl shadow-xl border border-[#f1d1d8] overflow-hidden">
                        <div className="p-6 border-b border-[#f1d1d8] bg-[#fff5f7] flex items-center gap-3">
                            <div className="w-12 h-12 bg-[#a1001f] rounded-xl flex items-center justify-center shadow-lg">
                                <User className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">Thông tin giáo viên</h2>
                                <p className="text-sm text-gray-500 font-medium">
                                    Thông tin chi tiết hồ sơ
                                </p>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-[#fff5f7] rounded-xl p-4 border border-[#f6e3e7] hover:border-[#d47a8b] transition-colors">
                                <p className="text-sm text-gray-500 font-medium mb-1">Mã GV</p>
                                <p className="font-bold text-gray-900 truncate" title={teacherInfo.code}>{teacherInfo.code || '---'}</p>
                            </div>
                            <div className="bg-[#fff5f7] rounded-xl p-4 border border-[#f6e3e7] hover:border-[#d47a8b] transition-colors">
                                <p className="text-sm text-gray-500 font-medium mb-1">Chức vụ</p>
                                <p className="font-bold text-gray-900 truncate" title={teacherInfo.position}>{teacherInfo.position || '---'}</p>
                            </div>
                            <div className="bg-[#fff5f7] rounded-xl p-4 border border-[#f6e3e7] hover:border-[#d47a8b] transition-colors">
                                <p className="text-sm text-gray-500 font-medium mb-1">Ngày bắt đầu</p>
                                <p className="font-bold text-gray-900 truncate" title={teacherInfo.startDate}>{teacherInfo.startDate || '---'}</p>
                            </div>
                            <div className="bg-[#fff5f7] rounded-xl p-4 border border-[#f6e3e7] hover:border-[#d47a8b] transition-colors">
                                <p className="text-sm text-gray-500 font-medium mb-1">Khối</p>
                                <p className="font-bold text-gray-900 truncate" title={teacherInfo.status}>{teacherInfo.status || '---'}</p>
                            </div>
                            <div className="bg-[#fff5f7] rounded-xl p-4 border border-[#f6e3e7] hover:border-[#d47a8b] transition-colors">
                                <p className="text-sm text-gray-500 font-medium mb-1">Cơ sở (In)</p>
                                <p className="font-bold text-gray-900 truncate" title={teacherInfo.branchIn}>{teacherInfo.branchIn || '---'}</p>
                            </div>
                             <div className="bg-[#fff5f7] rounded-xl p-4 border border-[#f6e3e7] hover:border-[#d47a8b] transition-colors">
                                <p className="text-sm text-gray-500 font-medium mb-1">Onboard bởi</p>
                                <p className="font-bold text-gray-900 truncate" title={teacherInfo.onboardBy}>{teacherInfo.onboardBy || '---'}</p>
                            </div>
                            <div className="bg-[#fff5f7] rounded-xl p-4 border border-[#f6e3e7] hover:border-[#d47a8b] transition-colors md:col-span-2">
                                <p className="text-sm text-gray-500 font-medium mb-1">Email cá nhân</p>
                                <p className="font-bold text-gray-900 truncate" title={teacherInfo.emailPersonal}>{teacherInfo.emailPersonal || '---'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Privacy Settings Section */}
                <div className="bg-white rounded-3xl shadow-xl border border-[#f1d1d8] overflow-hidden">
                    <div className="p-6 border-b border-[#f1d1d8] bg-[#fff5f7] flex items-center gap-3">
                        <div className="h-12 w-12 min-h-12 min-w-12 shrink-0 rounded-xl bg-[#a1001f] shadow-lg flex items-center justify-center">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900">Cài đặt quyền riêng tư</h2>
                            <p className="text-sm text-gray-500 font-medium">
                                Kiểm soát thông tin hiển thị trên trang truyền thông
                            </p>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Show Birthday Toggle */}
                        <div className="flex flex-col gap-3 p-4 bg-[#fff5f7] rounded-xl border border-[#f1d1d8] hover:border-[#d47a8b] transition-all sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4 sm:pr-4">
                                <div className="w-10 h-10 bg-[#f9e2e8] rounded-lg flex items-center justify-center shrink-0">
                                    <Calendar className="w-5 h-5 text-[#a1001f]" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 mb-1">Hiển thị sinh nhật</h3>
                                    <p className="text-sm text-gray-600">
                                        Cho phép hiển thị sinh nhật của bạn trong sidebar &ldquo;Sinh nhật tháng&rdquo; trên trang truyền thông
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePrivacyToggle('show_birthday')}
                                disabled={!privacySettings}
                                aria-label="Bật/tắt hiển thị sinh nhật"
                                className={`relative inline-flex h-9 w-16 self-end items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#a1001f] focus:ring-offset-2 disabled:opacity-50 sm:h-8 sm:w-14 sm:self-center ${
                                    privacySettings?.show_birthday ? 'bg-[#a1001f]' : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg transition-transform sm:h-6 sm:w-6 ${
                                        privacySettings?.show_birthday ? 'translate-x-8 sm:translate-x-7' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Show on Public List Toggle */}
                        <div className="flex flex-col gap-3 p-4 bg-[#fff5f7] rounded-xl border border-[#f1d1d8] hover:border-[#d47a8b] transition-all sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4 sm:pr-4">
                                <div className="w-10 h-10 bg-[#f9e2e8] rounded-lg flex items-center justify-center shrink-0">
                                    {privacySettings?.show_on_public_list ? <Eye className="w-5 h-5 text-[#a1001f]" /> : <EyeOff className="w-5 h-5 text-[#a1001f]" />}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 mb-1">Hiển thị trong danh sách công khai</h3>
                                    <p className="text-sm text-gray-600">
                                        Cho phép hiển thị thông tin của bạn trong danh sách giáo viên công khai
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePrivacyToggle('show_on_public_list')}
                                disabled={!privacySettings}
                                aria-label="Bật/tắt hiển thị trong danh sách công khai"
                                className={`relative inline-flex h-9 w-16 self-end items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#a1001f] focus:ring-offset-2 disabled:opacity-50 sm:h-8 sm:w-14 sm:self-center ${
                                    privacySettings?.show_on_public_list ? 'bg-[#a1001f]' : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg transition-transform sm:h-6 sm:w-6 ${
                                        privacySettings?.show_on_public_list ? 'translate-x-8 sm:translate-x-7' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Show Phone Toggle */}
                        <div className="flex flex-col gap-3 p-4 bg-[#fff5f7] rounded-xl border border-[#f1d1d8] hover:border-[#d47a8b] transition-all sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4 sm:pr-4">
                                <div className="w-10 h-10 bg-[#f9e2e8] rounded-lg flex items-center justify-center shrink-0">
                                    <Mail className="w-5 h-5 text-[#a1001f]" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 mb-1">Hiển thị số điện thoại</h3>
                                    <p className="text-sm text-gray-600">
                                        Cho phép hiển thị số điện thoại của bạn công khai (nếu có)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePrivacyToggle('show_phone')}
                                disabled={!privacySettings}
                                aria-label="Bật/tắt hiển thị số điện thoại"
                                className={`relative inline-flex h-9 w-16 self-end items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#a1001f] focus:ring-offset-2 disabled:opacity-50 sm:h-8 sm:w-14 sm:self-center ${
                                    privacySettings?.show_phone ? 'bg-[#a1001f]' : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg transition-transform sm:h-6 sm:w-6 ${
                                        privacySettings?.show_phone ? 'translate-x-8 sm:translate-x-7' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Show Personal Email Toggle */}
                        <div className="flex flex-col gap-3 p-4 bg-[#fff5f7] rounded-xl border border-[#f1d1d8] hover:border-[#d47a8b] transition-all sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4 sm:pr-4">
                                <div className="w-10 h-10 bg-[#f9e2e8] rounded-lg flex items-center justify-center shrink-0">
                                    <Mail className="w-5 h-5 text-[#a1001f]" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 mb-1">Hiển thị email cá nhân</h3>
                                    <p className="text-sm text-gray-600">
                                        Cho phép hiển thị email cá nhân của bạn (khác với email công ty)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handlePrivacyToggle('show_personal_email')}
                                disabled={!privacySettings}
                                aria-label="Bật/tắt hiển thị email cá nhân"
                                className={`relative inline-flex h-9 w-16 self-end items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#a1001f] focus:ring-offset-2 disabled:opacity-50 sm:h-8 sm:w-14 sm:self-center ${
                                    privacySettings?.show_personal_email ? 'bg-[#a1001f]' : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg transition-transform sm:h-6 sm:w-6 ${
                                        privacySettings?.show_personal_email ? 'translate-x-8 sm:translate-x-7' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        <div className="mt-6 p-4 bg-[#fff5f7] border border-[#f1d1d8] rounded-xl">
                            <div className="flex gap-3">
                                <Shield className="w-5 h-5 text-[#a1001f] shrink-0 mt-0.5" />
                                <div className="text-sm text-[#6b1223]">
                                    <p className="font-semibold mb-1">Lưu ý về quyền riêng tư</p>
                                    <p>
                                        Các cài đặt này chỉ ảnh hưởng đến thông tin hiển thị trên trang truyền thông công khai. 
                                        Quản lý và ban lãnh đạo vẫn có thể truy cập thông tin đầy đủ của bạn.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Certificates Section */}
                <div className="bg-white rounded-3xl shadow-xl border border-[#f1d1d8] overflow-hidden">
                    {/* Header */}
                    <div className="p-4 sm:p-6 border-b border-[#f1d1d8] bg-[#fff5f7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#a1001f] rounded-xl flex items-center justify-center shadow-lg shrink-0">
                                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-[28px] sm:text-2xl font-black text-gray-900 leading-tight">Chứng chỉ của tôi</h2>
                                <p className="text-xs sm:text-sm text-gray-500 font-medium">
                                    {certificates.length} chứng chỉ
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => setShowCertModal(true)}
                            className="h-10 w-full sm:w-auto px-3 sm:px-4 flex items-center justify-center gap-2 bg-[#a1001f] hover:bg-[#870019] text-white transition-all duration-200 rounded-xl whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm">Thêm chứng chỉ</span>
                        </Button>
                    </div>

                    {/* Certificates Grid */}
                    <div className="p-4 sm:p-6">
                        {certificates.length === 0 ? (
                            <div className="text-center py-10 sm:py-16">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Chưa có chứng chỉ</h3>
                                <p className="text-gray-500">Thêm chứng chỉ đầu tiên của bạn</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {certificates.map((cert: Certificate) => (
                                    <div
                                        key={cert.id}
                                        className="group bg-white border-2 border-gray-200 rounded-2xl overflow-hidden hover:shadow-2xl hover:border-[#d47a8b] transition-all duration-300 hover:-translate-y-1"
                                    >
                                        {/* Certificate Image */}
                                        <div
                                            className="h-48 bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center cursor-pointer relative overflow-hidden"
                                            onClick={() => setSelectedCertImage(cert.certificate_url)}
                                        >
                                            {cert.certificate_url.includes('.pdf') ? (
                                                <FileText className="w-16 h-16 text-gray-400" />
                                            ) : (
                                                <Image
                                                    src={cert.certificate_url}
                                                    alt={cert.certificate_name}
                                                    fill
                                                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                                                />
                                            )}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>

                                        {/* Certificate Info */}
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="font-bold text-gray-900 line-clamp-2 flex-1">
                                                    {cert.certificate_name}
                                                </h3>
                                                <button
                                                    onClick={() => handleDeleteCertificate(cert.id)}
                                                    className="shrink-0 w-8 h-8 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className={`inline-block px-3 py-1 rounded-lg text-xs font-bold border ${getCertTypeColor(cert.certificate_type)}`}>
                                                {cert.certificate_type}
                                            </div>

                                            {cert.issue_date && (
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>Cấp: {formatDate(cert.issue_date)}</span>
                                                </div>
                                            )}

                                            {cert.description && (
                                                <p className="text-sm text-gray-600 line-clamp-2">
                                                    {cert.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Certificate Modal */}
            {showCertModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start pt-20 sm:items-center sm:justify-center sm:pt-0 justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-[#a1001f] p-6 border-b border-[#870019] flex items-center justify-between">
                            <h2 className="text-2xl font-black text-white">Thêm chứng chỉ mới</h2>
                            <button
                                onClick={() => {
                                    setShowCertModal(false)
                                    setIsCertTypeOpen(false)
                                    setSelectedCertFile(null)
                                }}
                                className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">
                            {/* Certificate Name */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Tên chứng chỉ *
                                </label>
                                <input
                                    type="text"
                                    value={certForm.name}
                                    onChange={(e) => setCertForm({ ...certForm, name: e.target.value })}
                                    placeholder="VD: IELTS 7.5, AWS Certified, etc."
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#a1001f] focus:ring-4 focus:ring-[#f9e2e8] outline-none transition-all"
                                />
                            </div>

                            {/* Certificate Type */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Loại chứng chỉ
                                </label>
                                <div ref={certTypeDropdownRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsCertTypeOpen((prev) => !prev)}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#a1001f] focus:ring-4 focus:ring-[#f9e2e8] outline-none transition-all text-left flex items-center justify-between"
                                        aria-haspopup="listbox"
                                        aria-expanded={isCertTypeOpen}
                                    >
                                        <span className={certForm.type ? 'text-gray-900' : 'text-gray-500'}>
                                            {certForm.type === 'Language'
                                                ? 'Ngoại ngữ'
                                                : certForm.type === 'Technology'
                                                    ? 'Công nghệ'
                                                    : certForm.type === 'Teaching'
                                                        ? 'Sư phạm'
                                                        : certForm.type === 'Other'
                                                            ? 'Khác'
                                                            : 'Chọn loại'}
                                        </span>
                                        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isCertTypeOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isCertTypeOpen && (
                                        <div className="absolute z-50 mt-2 w-full rounded-xl border border-[#f1d1d8] bg-white shadow-xl overflow-hidden">
                                            {[
                                                { value: '', label: 'Chọn loại' },
                                                { value: 'Language', label: 'Ngoại ngữ' },
                                                { value: 'Technology', label: 'Công nghệ' },
                                                { value: 'Teaching', label: 'Sư phạm' },
                                                { value: 'Other', label: 'Khác' },
                                            ].map((option) => (
                                                <button
                                                    key={`${option.value || 'empty'}-${option.label}`}
                                                    type="button"
                                                    onClick={() => {
                                                        setCertForm({ ...certForm, type: option.value })
                                                        setIsCertTypeOpen(false)
                                                    }}
                                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${certForm.type === option.value
                                                            ? 'bg-[#fff5f7] text-[#a1001f] font-semibold'
                                                            : 'text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Ngày cấp
                                    </label>
                                    <input
                                        type="date"
                                        value={certForm.issueDate}
                                        onChange={(e) => setCertForm({ ...certForm, issueDate: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#a1001f] focus:ring-4 focus:ring-[#f9e2e8] outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Ngày hết hạn
                                    </label>
                                    <input
                                        type="date"
                                        value={certForm.expiryDate}
                                        onChange={(e) => setCertForm({ ...certForm, expiryDate: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#a1001f] focus:ring-4 focus:ring-[#f9e2e8] outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Mô tả
                                </label>
                                <textarea
                                    value={certForm.description}
                                    onChange={(e) => setCertForm({ ...certForm, description: e.target.value })}
                                    placeholder="Thông tin bổ sung về chứng chỉ..."
                                    rows={3}
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#a1001f] focus:ring-4 focus:ring-[#f9e2e8] outline-none transition-all resize-none"
                                />
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Tải lên file *
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleCertificateUpload}
                                    disabled={isUploadingCert}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingCert}
                                    className="w-full px-6 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-[#a1001f] hover:bg-[#fff5f7] transition-all flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Upload className="w-8 h-8 text-gray-400" />
                                    <span className="text-sm font-semibold text-gray-600">
                                        {isUploadingCert
                                            ? 'Đang tải lên...'
                                            : selectedCertFile
                                                ? selectedCertFile.name
                                                : 'Chọn ảnh hoặc PDF (tối đa 10MB)'}
                                    </span>
                                </button>
                                <p className="text-xs text-gray-500 mt-2">
                                    Hỗ trợ: JPG, PNG, WEBP, PDF
                                </p>
                            </div>

                            <div className="mt-4 border-t border-[#f1d1d8] pt-3">
                                <Button
                                    type="button"
                                    onClick={handleSubmitCertificate}
                                    disabled={isUploadingCert || !selectedCertFile}
                                    className="w-full bg-[#a1001f] hover:bg-[#870019] text-white"
                                >
                                    {isUploadingCert ? 'Đang gửi...' : 'Gửi thông tin'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {selectedCertImage && (
                <div
                    className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedCertImage(null)}
                >
                    <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
                        <button
                            onClick={() => setSelectedCertImage(null)}
                            className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>
                        <Image
                            src={selectedCertImage}
                            alt="Certificate preview"
                            width={1200}
                            height={900}
                            className="max-h-[90vh] w-auto object-contain rounded-2xl"
                        />
                    </div>
                </div>
            )}
        </PageContainer>
    )
}
