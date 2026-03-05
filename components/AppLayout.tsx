"use client";

import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface AppLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  redirectPath?: string;
}

export default function AppLayout({
  children,
  requireAuth = true,
  requireAdmin = false,
  redirectPath = '/login',
}: AppLayoutProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    // Redirect to login if authentication required but not authenticated
    if (requireAuth && !user && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace(redirectPath);
      return;
    }

    // Check admin access
    if (requireAdmin && user && !hasRedirected.current) {
      const isSuperAdmin = user.role === 'super_admin';
      const isAdminUser = user.isAdmin || ['super_admin', 'admin'].includes(user.role);

      if (!isAdminUser) {
        // Not an admin at all — redirect to user area
        hasRedirected.current = true;
        router.replace('/user/thongtingv');
        return;
      }

      // Super admin bypasses all permission checks
      if (!isSuperAdmin && user.permissions && user.permissions.length > 0) {
        // Check if user has permission for current route
        const hasPermission = user.permissions.some(p =>
          pathname === p || pathname.startsWith(p + '/')
        );

        if (!hasPermission) {
          // Find first allowed route to redirect to
          const firstAllowed = user.permissions.find(p => p.startsWith('/admin/'));
          hasRedirected.current = true;
          router.replace(firstAllowed || '/user/thongtingv');
          return;
        }
      }
    }

    // Reset redirect flag when user logs in
    if (user) {
      hasRedirected.current = false;
    }
  }, [user, isLoading, router, requireAuth, requireAdmin, redirectPath, pathname]);

  // Show skeleton while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-6">
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
    );
  }

  // Don't render if authentication checks fail
  if (requireAuth && !user) {
    return null;
  }

  if (requireAdmin && user) {
    const isAdminUser = user.isAdmin || ['super_admin', 'admin'].includes(user.role);
    if (!isAdminUser) {
      return null;
    }
  }

  return (
    <>{children}</>
  );
}
