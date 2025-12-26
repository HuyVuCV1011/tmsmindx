"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { logger } from "@/lib/logger";

export default function DashboardRedirect() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      logger.info('Dashboard: Waiting for auth context to load...');
      return;
    }

    // Chưa đăng nhập → redirect đến login
    if (!token || !user) {
      logger.info('Dashboard: No auth found, redirecting to login');
      router.replace('/login');
      return;
    }

    // Đã đăng nhập → kiểm tra quyền
    logger.info('Dashboard: User authenticated, checking admin status', { 
      email: user.email, 
      role: user.role,
      isAdmin: user.isAdmin 
    });

    // Ưu tiên admin dashboard nếu là admin
    if (user.isAdmin) {
      logger.success('Dashboard: Redirecting to admin dashboard');
      router.replace('/admin/dashboard');
    } else {
      logger.success('Dashboard: Redirecting to user portal');
      router.replace('/user/thongtingv');
    }
  }, [user, token, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#a1001f] mx-auto mb-4"></div>
        <p className="text-gray-600 text-sm font-medium">
          {isLoading ? 'Đang kiểm tra đăng nhập...' : 'Đang chuyển hướng...'}
        </p>
      </div>
    </div>
  );
}
