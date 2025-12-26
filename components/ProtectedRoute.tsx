"use client";

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect once to prevent loop
    if (!isLoading && !user && pathname !== '/login' && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push('/login');
    }
    
    // Reset redirect flag when user logs in
    if (user) {
      hasRedirected.current = false;
    }
  }, [user, isLoading, pathname, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a1001f] mx-auto mb-4"></div>
          <p className="text-gray-600">Đang kiểm tra xác thực...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not on login page, don't render
  if (!user && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
