'use client'

import { useAuth } from '@/lib/auth-context'
import { logger } from '@/lib/logger'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const router = useRouter()
  const { user, token, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) {
      logger.info('Root: Waiting for auth context to load...')
      return
    }

    // Chưa đăng nhập → redirect đến login
    if (!token || !user) {
      logger.info('Root: No auth found, redirecting to login')
      router.replace('/login')
      return
    }

    // Đã đăng nhập → kiểm tra quyền và redirect
    logger.info('Root: User authenticated, checking admin status', {
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    })

    const profileCheckedEmail = localStorage.getItem('tps_profile_check_done_email')?.trim().toLowerCase();
    const currentUserEmail = (user.email || '').trim().toLowerCase();

    // Ưu tiên admin dashboard nếu là admin
    if (user.isAdmin) {
      logger.success('Root: Redirecting to admin dashboard')
      router.replace('/admin/dashboard')
    } else {
      const nextPath = profileCheckedEmail === currentUserEmail ? '/user/thongtingv' : '/checkdatasource';
      logger.success('Root: Redirecting to teacher flow', { nextPath });
      router.replace(nextPath);    }
  }, [user, token, isLoading, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-300 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-32 bg-gray-300 rounded"></div>
            <div className="h-32 bg-gray-300 rounded"></div>
            <div className="h-32 bg-gray-300 rounded"></div>
          </div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            <div className="h-4 bg-gray-300 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
