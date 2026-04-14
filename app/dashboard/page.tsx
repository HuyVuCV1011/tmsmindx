'use client'

import { useAuth } from '@/lib/auth-context'
import { logger } from '@/lib/logger'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardRedirect() {
  const router = useRouter()
  const { user, token, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) {
      logger.info('Dashboard: Waiting for auth context to load...')
      return
    }

    // Chưa đăng nhập → redirect đến login
    if (!token || !user) {
      logger.info('Dashboard: No auth found, redirecting to login')
      router.replace('/login')
      return
    }

    // Đã đăng nhập → kiểm tra quyền
    logger.info('Dashboard: User authenticated, checking admin status', {
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    })

    // Ưu tiên admin dashboard nếu là admin
    if (user.isAdmin) {
      logger.success('Dashboard: Redirecting to admin dashboard')
      router.replace('/admin/dashboard')
    } else {
      logger.success('Dashboard: Redirecting to user portal')
      router.replace('/user/thong-tin-giao-vien')
    }
  }, [user, token, isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center max-w-md">
        <div className="animate-pulse space-y-4">
          <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
        <p className="text-gray-600 text-sm font-medium mt-6">
          {isLoading ? 'Đang kiểm tra đăng nhập...' : 'Đang chuyển hướng...'}
        </p>
      </div>
    </div>
  )
}
