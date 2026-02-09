"use client";

import { Sidebar } from "@/components/sidebar";
import { usePathname } from "next/navigation";

export function PersistentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't show sidebar on login page or root page
  const shouldShowSidebar = !pathname.startsWith('/login') && pathname !== '/';

  return (
    <>
      {shouldShowSidebar && <Sidebar />}
      {children}
    </>
  );
}
