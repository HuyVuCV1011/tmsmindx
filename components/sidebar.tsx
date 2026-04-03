"use client";

import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";
import { BookOpen, CalendarDays, ChevronDown, DollarSign, FileText, GraduationCap, Home, LogOut, Megaphone, Menu, Settings, Sparkles, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function Sidebar() {
  const { isOpen, setIsOpen } = useSidebar();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isNavLinkActive = useCallback((href?: string) => {
    if (!href) return false;

    const [targetPath, targetQuery] = href.split('?');
    const pathMatched = pathname === targetPath || pathname.startsWith(`${targetPath}/`);
    if (!pathMatched) return false;
    if (!targetQuery) return true;

    const queryParams = new URLSearchParams(targetQuery);
    for (const [key, value] of queryParams.entries()) {
      if (searchParams.get(key) !== value) return false;
    }

    return true;
  }, [pathname, searchParams]);

  // Load expanded menus from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('expandedMenus');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed)) {
          // Use setTimeout to avoid synchronous setState during effect execution
          const timer = setTimeout(() => {
            setExpandedMenus(parsed);
          }, 0);
          return () => clearTimeout(timer);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Determine menu items based on current path (admin or user)
  const isUserArea = pathname.startsWith('/user');

  const adminMenuItems = [
    { href: "/admin/dashboard", label: "Bảng Điều Khiển", icon: Home },
    { href: "/admin/truyenthong", label: "Quản lý truyền thông", icon: Megaphone },
    {
      href: "/admin/hr-candidates",
      label: "Đào tạo đầu vào",
      icon: Users,
      submenu: [
        { href: "/admin/hr-candidates/gen-planner?region=south", label: "Miền Nam (HCM + Tỉnh Nam)" },
        { href: "/admin/hr-candidates/gen-planner?region=north", label: "Miền Bắc (HN + Tỉnh Bắc + Tỉnh Trung)" },
      ]
    },
    {
      label: "Quản lý Giáo viên & Vận hành",
      icon: Users,
      submenu: [
        { href: "/admin/page1", label: "Hồ sơ Giáo viên" },
        { href: "/admin/page4/lich-danh-gia", label: "Lịch sự kiện" },
        {
          label: "Quản lý Deal Lương",
          icon: DollarSign,
          submenu: [
            { href: "/admin/deal-luong?type=salary_deal", label: "Thỏa thuận lương " },
            { href: "/admin/deal-luong?type=salary_reduction", label: "Hạ lương" },
            { href: "/admin/deal-luong?type=bonus", label: "Bonus" },
          ]
        },
      ]
    },
    {
      label: "Đào tạo & Khảo thí",
      icon: GraduationCap,
      submenu: [
        {
          label: "Đào Tạo Nâng Cao",
          icon: FileText,
          submenu: [
            { href: "/admin/page5", label: "Quản lý đào tạo nâng cao" },
            { href: "/admin/assignments", label: "Cấu hình bài kiểm tra" },
            { href: "/admin/training-dashboard", label: "Thống kê" },
          ]
        },
        {
          label: "Đánh giá năng lực Giáo Viên",
          icon: Settings,
          submenu: [
            // { href: "/admin/page4/form-dang-ky", label: "Form đăng ký kiểm tra" }, 
            { href: "/admin/page4/danh-sach-dang-ky", label: "Danh sách Giáo viên đăng ký" },
            { href: "/admin/giaitrinh", label: "Quản lý Giải trình"},
            { href: "/admin/page4/thu-vien-de", label: "Thư viện đề chuyên môn" },
          ]
        },
      ]
    },
    {
      label: "Cấu Hình Hệ Thống",
      icon: Settings,
      submenu: [
        { href: "/admin/user-management", label: "Quản lý tài khoản"},
        { href: "/admin/database", label: "Database Manager"},
        { href: "/admin/cloudinary", label: "Cloudinary Manager"},
      ]
    },
    { href: "/admin/xin-nghi-mot-buoi", label: "Tiếp nhận xin nghỉ 1 buổi", icon: FileText },
  ];

  const userMenuItems = [
    { href: "/user/truyenthong", label: "Truyền Thông Nội Bộ", icon: Megaphone },
    { href: "/user/thongtingv", label: "Thông Tin Của Tôi", icon: Home },
    { href: "/user/page2", label: "Quy trình quy định K12 Teaching", icon: BookOpen },
    { href: "/user/hoat-dong-hang-thang", label: "Hoạt Động Hàng Tháng", icon: CalendarDays },
    {
      label: "Đào tạo & Khảo thí",
      icon: GraduationCap,
      submenu: [
        { href: "/user/training", label: "Đào tạo nâng cao" },
        { href: "/user/assignments", label: "Kiểm tra Chuyên Môn" },
        { href: "/user/giaitrinh", label: "Giải trình điểm kiểm tra" },
      ]
    },
    {
      label: "Quy trình xin nghỉ 1 buổi",
      icon: Settings,
      submenu: [
        { href: "/user/xin-nghi-mot-buoi", label: "Gửi yêu cầu xin nghỉ" },
        { href: "/user/nhan-lop-1-buoi", label: "Danh sách nhận lớp 1 buổi" },
      ]
    },
  ];

  const isPathMatch = (href?: string) => {
    if (!href) return false;
    if (href.includes('?')) {
      const [hrefPath, hrefSearch] = href.split('?');
      return pathname === hrefPath && searchParams.toString() === hrefSearch;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isMenuItemActive = (item: any): boolean => {
    if (item?.submenu && Array.isArray(item.submenu)) {
      return item.submenu.some((child: any) => isMenuItemActive(child));
    }
    return isPathMatch(item?.href);
  };

  // Filter admin menu items based on user permissions
  const getFilteredAdminMenuItems = () => {
    if (!user) return [];

    if (user.role === 'super_admin') return adminMenuItems;

    // manager và admin luôn có quyền truy cập deal-luong
    const DEAL_LUONG_ROUTES = ['/admin/deal-luong', '/admin/tao-deal-luong'];
    const basePermissions = user.permissions || [];
    const permissions = ['manager', 'admin'].includes(user.role)
      ? Array.from(new Set([...basePermissions, ...DEAL_LUONG_ROUTES]))
      : basePermissions;

    const roleCodes = (user.userRoles || []).map((code) => code.toUpperCase());
    const hasTrainingInputRole = roleCodes.some((code) => code === 'HR' || code === 'TE' || code === 'TF');
    if (permissions.length === 0 && !hasTrainingInputRole) return [];

    const hasPermissionForHref = (href: string) => {
      const targetPath = href.split('?')[0];
      return permissions.some((p) => targetPath === p || targetPath.startsWith(`${p}/`));
    };

    const filterMenuItemsByPermissions = (items: any[]): any[] => {
      return items
        .map((item) => {
          const isTrainingInputMenu = item?.href === '/admin/hr-candidates';
          if (isTrainingInputMenu && hasTrainingInputRole) {
            return item;
          }

          if (item?.submenu && Array.isArray(item.submenu)) {
            const filteredChildren = filterMenuItemsByPermissions(item.submenu);
            if (filteredChildren.length > 0) {
              return { ...item, submenu: filteredChildren };
            }
          }

          if (item?.href && hasPermissionForHref(item.href)) {
            return item;
          }

          return null;
        })
        .filter(Boolean);
    };

    return filterMenuItemsByPermissions(adminMenuItems);
  };

  const menuItems = isUserArea ? userMenuItems : getFilteredAdminMenuItems();

  // Auto-expand submenu if current page is in it
  useEffect(() => {
    menuItems.forEach((item) => {
      if ('submenu' in item && item.submenu) {
        const isInSubmenu = item.submenu.some((sub: any) => {
          if (!('href' in sub) || !sub.href) return false;
          return isNavLinkActive(sub.href);
        });
        if (isInSubmenu && !expandedMenus.includes(item.label)) {
          setExpandedMenus(prev => {
            const updated = [...prev, item.label];
            localStorage.setItem('expandedMenus', JSON.stringify(updated));
            return updated;
          });
        }
      }
    });
  }, [menuItems, pathname, searchParams, expandedMenus, isNavLinkActive]);
  const toggleSubmenu = (label: string) => {
    setExpandedMenus(prev => {
      const updated = prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label];
      return updated;
    });
  };

  const handleTopLevelTabNavigation = () => {
    setExpandedMenus([]);
  };

  const getRoleDisplay = () => {
    if (!user) return '';

    switch (user.role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'manager':
        return 'Manager';
      case 'teacher':
        return 'Teacher';
      default:
        return user.role;
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-sidebar-overlay-custom bg-black/50 backdrop-blur-sm lg:hidden transition-all duration-300 ease-in-out animate-in fade-in-0"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Toggle Button - Modern floating design */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-3 left-3 z-sidebar-toggle p-2 rounded-lg bg-white shadow-md border border-gray-200 hover:shadow-lg hover:scale-105 hover:bg-linear-to-br hover:from-[#a1001f] hover:to-[#c41230] hover:text-white hover:border-[#a1001f] transition-all duration-300 group animate-in fade-in-0 slide-in-from-left-2"
        >
          <Menu className="h-4 w-4 transition-transform group-hover:rotate-180 duration-300" />
        </button>
      )}

      {/* Sidebar - Modern glass-morphism design */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-sidebar-custom h-screen backdrop-blur-xl bg-white/95 border-r border-gray-200 shadow-xl w-56",
          "transition-all duration-500 ease-in-out will-change-transform",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ transform: `translate3d(${isOpen ? '0' : '-100%'}, 0, 0)` }}
      >
        <div className="flex h-full flex-col">
          {/* Header - Gradient brand header */}
          <div className="relative h-14 flex items-center justify-between px-4 bg-linear-to-r from-[#a1001f] to-[#c41230] text-white shadow-md">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-wide">Teaching MS</h2>
                <p className="text-xs text-white/80">Quản lý giảng dạy</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-all duration-300 hover:rotate-90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation - Modern cards with smooth hover effects */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const hasSubmenu = 'submenu' in item;
              const isExpanded = expandedMenus.includes(item.label);
              const isActive = !hasSubmenu && isPathMatch(item.href);
              const isSubmenuActive = hasSubmenu && isMenuItemActive(item);

              return (
                <div key={item.href || item.label} className="group">
                  {hasSubmenu ? (
                    <div className="space-y-1">
                      <div
                        className={cn(
                          "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 group/item",
                          isSubmenuActive || isExpanded
                            ? "bg-linear-to-r from-[#a1001f] to-[#c41230] text-white shadow-md shadow-[#a1001f]/20 scale-[1.01]"
                            : "text-gray-700 hover:bg-linear-to-r hover:from-gray-100 hover:to-gray-50 hover:shadow-sm hover:scale-[1.01]"
                        )}
                      >
                        <div className={cn(
                          "p-1.5 rounded-md transition-all duration-300",
                          isSubmenuActive || isExpanded
                            ? "bg-white/20"
                            : "bg-gray-100 group-hover/item:bg-white group-hover/item:shadow-sm"
                        )}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        {item.href ? (
                          <Link href={item.href} className="flex-1 text-left">
                            {item.label}
                          </Link>
                        ) : (
                          <span className="flex-1 text-left">{item.label}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleSubmenu(item.label)}
                          className={cn(
                            "rounded-md p-1 transition-transform duration-300 hover:bg-white/20",
                            isExpanded ? "rotate-180" : ""
                          )}
                          aria-label={`Mở submenu ${item.label}`}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      
                      {/* Submenu with slide animation */}
                      <div className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      )}>
                        <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 pl-2">
                          {item.submenu?.map((subItem: any) => {
                            const subHasSubmenu = 'submenu' in subItem && Array.isArray(subItem.submenu);
                            const isSubActive = isMenuItemActive(subItem);

                            if (subHasSubmenu) {
                              return (
                                <div key={subItem.label} className="space-y-1 py-1">
                                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    {subItem.label}
                                  </div>
                                  <div className="ml-2 space-y-0.5 border-l border-gray-200 pl-2">
                                    {subItem.submenu?.map((nestedItem: any) => {
                                      const isNestedActive = isPathMatch(nestedItem.href);
                                      if (!nestedItem.href) return null;

                                      return (
                                        <Link
                                          key={nestedItem.href}
                                          href={nestedItem.href}
                                          className={cn(
                                            "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-300 hover:scale-[1.01]",
                                            isNestedActive
                                              ? "bg-linear-to-r from-[#a1001f]/10 to-[#c41230]/10 text-[#a1001f] border-l-3 border-[#a1001f] shadow-sm"
                                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-l-3 hover:border-gray-300"
                                          )}
                                        >
                                          <span>{nestedItem.label}</span>
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            if (!subItem.href) {
                              return null;
                            }
                            return (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-300 hover:scale-[1.01]",
                                  isSubActive
                                    ? "bg-linear-to-r from-[#a1001f]/15 to-[#c41230]/15 text-[#a1001f] border-l-3 border-[#a1001f] shadow-sm ring-1 ring-[#a1001f]/20"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-l-3 hover:border-gray-300"
                                )}
                              >
                                <span>{subItem.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={handleTopLevelTabNavigation}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 group/item",
                        isActive
                          ? "bg-linear-to-r from-[#a1001f] to-[#c41230] text-white shadow-md shadow-[#a1001f]/20 scale-[1.01]"
                          : "text-gray-700 hover:bg-linear-to-r hover:from-gray-100 hover:to-gray-50 hover:shadow-sm hover:scale-[1.01]"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-md transition-all duration-300",
                        isActive
                          ? "bg-white/20"
                          : "bg-gray-100 group-hover/item:bg-white group-hover/item:shadow-sm"
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span>{item.label}</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Info and Logout - Modern card design */}
          {user && (
            <div className="border-t border-gray-200 p-3 bg-linear-to-br from-gray-50 to-white">
              <Link 
                href={user.isAdmin ? '/admin/profile' : '/user/profile'}
                className={cn(
                  "block mb-2 p-2 rounded-lg shadow-sm border transition-all duration-300 hover:shadow-md hover:scale-[1.01] cursor-pointer",
                  pathname === "/user/profile" || pathname === "/admin/profile"
                    ? "bg-linear-to-br from-[#a1001f]/5 to-[#c41230]/5 border-[#a1001f]"
                    : "bg-white border-gray-100 hover:border-[#a1001f]/30"
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-8 w-8 rounded-full bg-linear-to-br from-[#a1001f] to-[#c41230] flex items-center justify-center text-white font-bold text-xs shadow-md">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{user.displayName || user.email?.split('@')[0]}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-linear-to-r from-[#a1001f] to-[#c41230] text-white text-xs rounded-full font-semibold shadow-sm">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>{getRoleDisplay()}</span>
                </div>
              </Link>
              
              <button
                className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold bg-white border-2 border-gray-200 text-gray-700 hover:border-[#a1001f] hover:bg-linear-to-r hover:from-[#a1001f] hover:to-[#c41230] hover:text-white hover:shadow-md transition-all duration-300 group"
                onClick={logout}
              >
                <LogOut className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Overlay for mobile - smooth fade */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden transition-all duration-300 animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
