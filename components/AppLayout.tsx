"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
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
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    // Redirect to login if authentication required but not authenticated
    if (requireAuth && !user && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace(redirectPath);
      return;
    }

    // Redirect to user area if admin required but user is not admin
    if (requireAdmin && user && !user.isAdmin && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/user/thongtingv');
      return;
    }

    // Reset redirect flag when user logs in
    if (user) {
      hasRedirected.current = false;
    }
  }, [user, isLoading, router, requireAuth, requireAdmin, redirectPath]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-[#a1001f] mx-auto"></div>
          <p className="text-gray-600 mt-4 font-medium">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Don't render if authentication checks fail
  if (requireAuth && !user) {
    return null;
  }

  if (requireAdmin && (!user || !user.isAdmin)) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-white">
      {/* Main Content Area with smooth transitions */}
      <main className="min-h-screen transition-all duration-300 ease-in-out pl-0 lg:pl-56">
        {/* Content wrapper - optimized spacing and responsive */}
        <div className="w-full h-screen">
          {/* Inner container with max-width and proper padding */}
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6 xl:px-8 xl:py-8">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
