"use client";

import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    
    // Redirect to login if not authenticated
    if (!user && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/login');
      return;
    }
    
    // Redirect to user area if not admin
    if (user && !user.isAdmin && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/user/thongtingv');
      return;
    }
    
    // Reset redirect flag when user logs in
    if (user) {
      hasRedirected.current = false;
    }
  }, [user, isLoading, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a1001f] mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated or not admin
  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-white">
      <Sidebar />
      <main className="transition-all duration-300 ease-in-out lg:pl-48">
        <div className="p-4 pt-12 lg:pt-4">
          {children}
        </div>
      </main>
    </div>
  );
}
