"use client";

import { cn } from "@/lib/utils";
import { FileText, Home, LayoutDashboard, Menu, Settings, Users, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AuthModal from "./AuthModal";

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const pathname = usePathname();

  const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/page1", label: "Thông tin GV", icon: LayoutDashboard },
    // { href: "/page2", label: "Lịch Rảnh GV", icon: FileText },
    { href: "/page3", label: "Màn hình 3", icon: Users },
    { href: "/page4", label: "Màn hình 4", icon: Settings },
    { href: "/page5", label: "Màn hình 5", icon: FileText },
  ];

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
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
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
                  </li>
                );
              })}
              {/* Login Button */}
              <li>
                <button
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium border border-gray-900 bg-white hover:bg-gray-900 hover:text-white transition-all mt-4"
                  onClick={() => setAuthOpen(true)}
                >
                  <span role="img" aria-label="login">🔑</span>
                  <span>Đăng nhập</span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Auth Modal Layer */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
