"use client";

import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { FileText, Home, LayoutDashboard, LogOut, Menu, Settings, Users, X, MessageSquare, ChevronDown, ChevronRight, GraduationCap } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Determine menu items based on current path (admin or user)
  const isUserArea = pathname.startsWith('/user');
  
  const adminMenuItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: Home },
    { href: "/admin/page1", label: "Thông tin GV", icon: LayoutDashboard },
    { href: "/admin/page2", label: "màn hình 2", icon: Users },
    { href: "/admin/page3", label: "Màn hình 3", icon: Users },
    { href: "/admin/page4", label: "Màn hình 4", icon: Settings },
    { 
      label: "Đào tạo nâng cao", 
      icon: FileText,
      submenu: [
        { href: "/admin/page5", label: "Quản lý đào tạo nâng cao" },
        { href: "/admin/training-dashboard", label: "Thống kê" },
        { href: "/admin/assignments", label: "Quản lý Assignments" },
      ]
    },
    { href: "/admin/giaithich", label: "Quản lý Giải thích", icon: MessageSquare },
  ];

  const userMenuItems = [
    { href: "/user/thongtingv", label: "Thông tin của tôi", icon: Home },
    { href: "/user/training", label: "Đào tạo nâng cao", icon: GraduationCap },
    { href: "/user/assignments", label: "My Assignments", icon: FileText },
    { href: "/user/giaithich", label: "Giải thích kiểm tra", icon: MessageSquare },
  ];


  const menuItems = isUserArea ? userMenuItems : adminMenuItems;

  const toggleSubmenu = (label: string) => {
    setExpandedMenus(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  return (
    <>
      {/* Toggle Button when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-3 left-3 z-50 p-1.5 rounded-md bg-white border border-gray-900 hover:bg-gray-900 hover:text-white transition-all"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-900 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0 w-48" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-12 items-center justify-between border-b border-gray-900 px-3">
            <h2 className="text-sm font-bold text-gray-900">Menu</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const hasSubmenu = 'submenu' in item;
                const isExpanded = expandedMenus.includes(item.label);
                const isActive = !hasSubmenu && pathname === item.href;
                const isSubmenuActive = hasSubmenu && item.submenu?.some(sub => pathname === sub.href);

                return (
                  <li key={item.href || item.label}>
                    {hasSubmenu ? (
                      <>
                        <button
                          onClick={() => toggleSubmenu(item.label)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium transition-all",
                            isSubmenuActive
                              ? "bg-gray-900 text-white border border-gray-900"
                              : "text-gray-900 border border-transparent hover:border-gray-900 hover:bg-gray-50"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span className="flex-1 text-left">{item.label}</span>
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                        {isExpanded && (
                          <ul className="ml-4 mt-1 space-y-1">
                            {item.submenu?.map((subItem) => {
                              const isSubActive = pathname === subItem.href;
                              return (
                                <li key={subItem.href}>
                                  <a
                                    href={subItem.href}
                                    className={cn(
                                      "flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium transition-all",
                                      isSubActive
                                        ? "bg-gray-700 text-white border border-gray-700"
                                        : "text-gray-700 border border-transparent hover:border-gray-700 hover:bg-gray-50"
                                    )}
                                  >
                                    <span>{subItem.label}</span>
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    ) : (
                      <a
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium transition-all",
                          isActive
                            ? "bg-gray-900 text-white border border-gray-900"
                            : "text-gray-900 border border-transparent hover:border-gray-900 hover:bg-gray-50"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.label}</span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Info and Logout */}
          {user && (
            <div className="border-t border-gray-900 p-2">
              <div className="mb-2 px-2">
                <p className="text-xs font-semibold text-gray-900 truncate">{user.displayName}</p>
                <p className="text-xs text-gray-600 truncate">{user.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-[#a1001f] text-white text-xs rounded-full">
                  {user.role === 'teacher' ? 'Teacher' : 'Manager'}
                </span>
              </div>
              <button
                className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium border border-gray-900 bg-white hover:bg-gray-900 hover:text-white transition-all"
                onClick={logout}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
