'use client'

import { useAuth } from '@/lib/auth-context'
import { PageContainer } from '@/components/PageContainer'
import { 
    User, 
    Mail, 
    Award,
    Shield
} from 'lucide-react'

export default function AdminProfilePage() {
    const { user } = useAuth()

    if (!user) return null

    return (
        <PageContainer padding="lg">
            <div className="w-full space-y-8">
                
                {/* Profile Header */}
                <div className="bg-[#a1001f] rounded-3xl p-8 text-white shadow-2xl">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Avatar */}
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center shadow-2xl text-4xl font-bold">
                                {(user as any).photoURL ? (
                                    <img src={(user as any).photoURL} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : <User className="w-16 h-16 text-white" />)
                                )}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl font-black mb-2">{user.displayName || user.email?.split('@')[0]}</h1>
                            <div className="flex flex-col md:flex-row gap-4 text-white/90">
                                <div className="flex items-center gap-2 justify-center md:justify-start">
                                    <Mail className="w-5 h-5" />
                                    <span className="font-medium">{user.email}</span>
                                </div>
                                <div className="flex items-center gap-2 justify-center md:justify-start">
                                    <Shield className="w-5 h-5" />
                                    <span className="font-semibold capitalize text-yellow-300">
                                        {user.role?.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
                                <Award className="w-5 h-5" />
                                <span className="text-sm font-medium">Quyền truy cập: {user.isAdmin ? 'Có (Admin Panel)' : 'Giới hạn'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-8 shadow-xl border border-[#f1d1d8]">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
                        <Shield className="w-6 h-6 text-[#a1001f]" />
                        Màn hình & Tính năng được cấp quyền
                    </h2>
                    <p className="text-gray-600 mb-6">Tài khoản này được cấu hình với vai trò <strong>{user.role}</strong>. Dưới đây là danh sách các màn hình hệ thống mà bạn được cấp quyền truy cập:</p>
                    
                    {user.permissions && user.permissions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {user.permissions.map((perm, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-[#fff5f7] rounded-xl border border-[#f6e3e7] hover:border-[#d47a8b] hover:shadow-sm transition-all duration-300">
                                    <div className="w-2 h-2 rounded-full bg-[#a1001f]" />
                                    <code className="text-sm font-semibold text-gray-800 break-all">{perm}</code>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 bg-[#fff5f7] text-[#6b1223] rounded-xl border border-[#f1d1d8]">
                            Không tìm thấy phân quyền cụ thể nào cho tài khoản của bạn.
                        </div>
                    )}
                    
                    <div className="mt-8 pt-6 border-t border-[#f1d1d8]">
                        <p className="text-sm text-gray-500 italic">Nếu cần thay đổi thông tin cá nhân hoặc vai trò, vui lòng liên hệ Super Admin hoặc bộ phận kỹ thuật.</p>
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}
