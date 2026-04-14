'use client'

import { useAuth } from '@/lib/auth-context'
import { ArrowLeft, Mail, MessageCircle, ShieldAlert } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface AppLayoutProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireAdmin?: boolean
  redirectPath?: string
}

export default function AppLayout({
  children,
  requireAuth = true,
  requireAdmin = false,
  redirectPath = '/login',
}: AppLayoutProps) {
  const PROFILE_CHECK_DONE_EMAIL_KEY = "tps_profile_check_done_email";
  const { user, isLoading, refreshPermissions, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);
  const [noPermission, setNoPermission] = useState(false);
  const getRoutePermissionAliases = (path: string) => {
    if (path === '/admin/thu-vien-de') {
      return ['/admin/thu-vien-de', '/admin/page4/thu-vien-de']
    }
    if (path === '/admin/page4/thu-vien-de') {
      return ['/admin/page4/thu-vien-de', '/admin/thu-vien-de']
    }
    return [path]
  }

  // Auto-refresh permissions when navigating admin routes
  useEffect(() => {
    if (user && pathname.startsWith('/admin')) {
      refreshPermissions()
    }
  }, [pathname, user, refreshPermissions])

  useEffect(() => {
    if (isLoading) return

    const roleCodes = (user?.userRoles || []).map((code) =>
      String(code).toUpperCase(),
    )
    const hasTrainingInputRole = roleCodes.some(
      (code) => code === 'HR' || code === 'TE' || code === 'TF',
    )
    const isTrainingInputRoute =
      pathname === '/admin/hr-candidates' ||
      pathname.startsWith('/admin/hr-candidates/')

    // Redirect to login if authentication required but not authenticated
    if (requireAuth && !user && !hasRedirected.current) {
      hasRedirected.current = true
      router.replace(redirectPath)
      return
    }

    // Check admin access
    if (requireAdmin && user) {
      const isSuperAdmin = user.role === 'super_admin'
      const isAdminUser =
        user.isAdmin || ['super_admin', 'admin', 'manager'].includes(user.role)
      const permissions = user.permissions || []

      if (!isAdminUser) {
        // Not an admin at all — redirect to user area
        if (!hasRedirected.current) {
          hasRedirected.current = true
          router.replace('/user/thong-tin-giao-vien')
        }
        return
      }

      // Super admin bypasses all permission checks
      if (!isSuperAdmin) {
        // If they have no permissions, show contact message
        if (permissions.length === 0) {
          if (hasTrainingInputRole && isTrainingInputRoute) {
            setNoPermission(false)
          } else if (hasTrainingInputRole) {
            router.replace('/admin/hr-candidates/gen-planner')
            return
          } else {
            setNoPermission(true)
            return
          }
        }

        // manager và admin luôn được phép vào deal-luong routes
        const DEAL_LUONG_ROUTES = ['/admin/deal-luong', '/admin/tao-deal-luong']
        const effectivePermissions = ['manager', 'admin'].includes(user.role)
          ? Array.from(new Set([...permissions, ...DEAL_LUONG_ROUTES]))
          : permissions

        // Check if user has permission for current route
        // Allow bypass for universal admin routes like /admin/profile
        if (
          pathname.startsWith('/admin') &&
          pathname !== '/admin' &&
          !pathname.startsWith('/admin/profile')
        ) {
          const hasPermission =
            (hasTrainingInputRole && isTrainingInputRoute) ||
            effectivePermissions.some(
              (p) =>
                pathname === p ||
                pathname.startsWith(`${p}/`) ||
                p.startsWith(`${pathname}/`),
            )

          if (!hasPermission) {
            if (hasTrainingInputRole) {
              router.replace('/admin/hr-candidates/gen-planner')
              return
            }

            // Find first allowed valid admin route to redirect to
            const firstAllowed = effectivePermissions.find((p) =>
              p.startsWith('/admin/'),
            )
            if (firstAllowed) {
              router.replace(firstAllowed)
            } else {
              setNoPermission(true)
            }
            return
          }
        }
      }
    }

    // Teacher users must complete datasource setup before entering /user area.
    // Admin/super_admin/manager are excluded from this guard.
    if (!requireAdmin && user && pathname.startsWith('/user') && user.role === 'teacher') {
      const checkedEmail = localStorage.getItem(PROFILE_CHECK_DONE_EMAIL_KEY)?.trim().toLowerCase();
      const currentEmail = (user.email || '').trim().toLowerCase();
      if (!checkedEmail || checkedEmail !== currentEmail) {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          router.replace('/checkdatasource');
        }
        return;
      }
    }

    // Reset redirect flag when user logs in
    if (user) {
      hasRedirected.current = false
    }
    setNoPermission(false)
  }, [
    user,
    isLoading,
    router,
    requireAuth,
    requireAdmin,
    redirectPath,
    pathname,
  ])

  useEffect(() => {
    const verifyTeacherStillExists = async () => {
      if (!user || user.role !== "teacher") return;
      if (!pathname.startsWith("/user")) return;

      try {
        const response = await fetch(`/api/checkdatasource/status?email=${encodeURIComponent(user.email)}`, {
          cache: "no-store",
        });
        const data = await response.json();
        // Only act on a definitive "not exists" answer, not on DB errors.
        if (response.ok && data.success && data.exists === false && !data.dbUnavailable) {
          localStorage.removeItem(PROFILE_CHECK_DONE_EMAIL_KEY);
          router.replace("/checkdatasource");
        }
      } catch {
        // DB/network error — don't kick the user out
      }
    };

    verifyTeacherStillExists();
  }, [user, pathname, router, logout]);

  // Show skeleton while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-gray-300 rounded-full"></div>
            <div className="h-6 bg-gray-300 rounded w-32"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="h-64 bg-gray-300 rounded"></div>
            <div className="md:col-span-3 h-64 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  // Fallback UI for unassigned admin roles
  if (noPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="h-10 w-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Chưa được cấp quyền
          </h2>
          <p className="text-gray-600 mb-8">
            Tài khoản của bạn đã có vai trò Quản lý nhưng chưa được phân quyền
            truy cập các màn hình cụ thể.
          </p>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-left">
            <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Hướng dẫn xử lý:
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              Vui lòng <strong>liên hệ HOTeaching</strong> để được cấp quyền
              truy cập vào các module tương ứng.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="mailto:hoteaching@mindx.edu.vn"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#a1001f] text-white rounded-lg font-bold hover:bg-[#c41230] transition-colors shadow-md"
            >
              <Mail className="h-4 w-4" /> Gửi mail hỗ trợ
            </a>
            <button
              onClick={() => router.replace('/user/thong-tin-giao-vien')}
              className="flex items-center justify-center gap-2 w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Quay lại trang cá nhân
            </button>
          </div>

          <p className="mt-8 text-xs text-gray-400">
            Teaching Portal System (TPS) &bull; MindX Technology School
          </p>
        </div>
      </div>
    )
  }

  // Don't render if authentication checks fail
  if (requireAuth && !user) {
    return null
  }

  if (requireAdmin && user) {
    const isAdminUser =
      user.isAdmin || ['super_admin', 'admin', 'manager'].includes(user.role)
    if (!isAdminUser) {
      return null
    }
  }

  return <>{children}</>
}
