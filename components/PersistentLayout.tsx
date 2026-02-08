"use client";

import { Sidebar } from "@/components/sidebar";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { usePathname } from "next/navigation";

function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isOpen } = useSidebar();
  
  // Don't show sidebar on login page or root page
  const shouldShowSidebar = !pathname.startsWith('/login') && pathname !== '/';

  return (
    <div className="min-h-screen bg-white">
      {shouldShowSidebar && <Sidebar />}
      <main 
        className={`
          transition-all duration-500 ease-in-out min-h-screen will-change-transform
          ${shouldShowSidebar 
            ? (isOpen 
                ? 'lg:ml-56' // Desktop with sidebar 
                : 'lg:ml-0'  // Desktop without sidebar
              ) 
            : ''
          }
          ${shouldShowSidebar ? 'relative' : ''}
        `}
      >
        <div className="w-full h-screen">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="w-full px-[1%] py-2 sm:px-[1.5%] sm:py-2 lg:px-[2%] lg:py-3 xl:px-[2.5%] xl:py-3">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function PersistentLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Layout>{children}</Layout>
    </SidebarProvider>
  );
}
