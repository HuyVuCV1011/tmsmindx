"use client";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export const AVAILABLE_ROUTES = [
    { path: "/admin/dashboard", label: "Dashboard", group: "Tổng quan" },
    { path: "/admin/page1", label: "Thông tin GV", group: "Quản lý" },
    { path: "/admin/page2", label: "Quy trình quy định K12 Teaching", group: "Quản lý" },
    { path: "/admin/page3", label: "Màn hình 3", group: "Quản lý" },
    { path: "/admin/hr-candidates", label: "HR quản lý GEN ứng viên", group: "Nhân sự" },
    { path: "/admin/page4/lich-danh-gia", label: "Lịch sự kiện", group: "Sự kiện" },
    { path: "/admin/page4/danh-sach-dang-ky", label: "Danh sách đăng ký", group: "Đánh giá năng lực GV" },
    { path: "/admin/page4/thu-vien-de", label: "Library đề chuyên môn", group: "Đánh giá năng lực GV" },
    { path: "/admin/page5", label: "QL đào tạo nâng cao", group: "Đào tạo" },
    { path: "/admin/training-dashboard", label: "Thống kê đào tạo", group: "Đào tạo" },
    { path: "/admin/assignments", label: "QL Assignments", group: "Đào tạo" },
    { path: "/admin/assignment-questions", label: "Câu hỏi Assignment", group: "Đào tạo" },
    { path: "/admin/video-setup", label: "Cài đặt Video", group: "Đào tạo" },
    { path: "/admin/video-detail", label: "Chi tiết Video", group: "Đào tạo" },
    { path: "/admin/training-studio", label: "Training Studio", group: "Đào tạo" },
    { path: "/admin/giaitrinh", label: "QL Giải trình", group: "Nội dung" },
    { path: "/admin/xin-nghi-mot-buoi", label: "Tiếp nhận xin nghỉ 1 buổi", group: "Nội dung" },
    { path: "/admin/truyenthong", label: "QL truyền thông", group: "Nội dung" },
    { path: "/admin/database", label: "Database Manager", group: "Hệ thống" },
    { path: "/admin/user-management", label: "QL tài khoản", group: "Hệ thống" },
];

export const ROUTE_GROUPS = [...new Set(AVAILABLE_ROUTES.map(r => r.group))];

export default function PermSelector({ perms, setPerms }: { perms: string[]; setPerms: (v: string[]) => void }) {
    const [expanded, setExpanded] = useState<string[]>(ROUTE_GROUPS);

    const toggleGroup = (g: string) => setExpanded(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]);
    const togglePerm = (path: string) => setPerms(perms.includes(path) ? perms.filter(p => p !== path) : [...perms, path]);
    const toggleAllGroup = (group: string) => {
        const gp = AVAILABLE_ROUTES.filter(r => r.group === group).map(r => r.path);
        setPerms(gp.every(p => perms.includes(p)) ? perms.filter(p => !gp.includes(p)) : [...new Set([...perms, ...gp])]);
    };
    const selectAll = () => setPerms(perms.length === AVAILABLE_ROUTES.length ? [] : AVAILABLE_ROUTES.map(r => r.path));

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <button type="button" onClick={selectAll} className="text-xs font-medium text-[#a1001f] hover:underline">
                    {perms.length === AVAILABLE_ROUTES.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
                <span className="text-xs text-gray-500">{perms.length}/{AVAILABLE_ROUTES.length}</span>
            </div>
            {ROUTE_GROUPS.map(group => {
                const gr = AVAILABLE_ROUTES.filter(r => r.group === group);
                const cnt = gr.filter(r => perms.includes(r.path)).length;
                const exp = expanded.includes(group);
                return (
                    <div key={group} className="rounded-lg border border-gray-200 overflow-hidden">
                        <button type="button" onClick={() => toggleGroup(group)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={cnt === gr.length} onChange={() => toggleAllGroup(group)}
                                    onClick={e => e.stopPropagation()} className="rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]" />
                                <span className="text-xs font-bold text-gray-700">{group}</span>
                                <span className="text-xs text-gray-400">({cnt}/{gr.length})</span>
                            </div>
                            {exp ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                        </button>
                        {exp && (
                            <div className="px-3 py-2 space-y-1">
                                {gr.map(r => (
                                    <label key={`${r.path}-${r.label}`} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 transition-colors">
                                        <input type="checkbox" checked={perms.includes(r.path)} onChange={() => togglePerm(r.path)}
                                            className="rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]" />
                                        <span className="text-xs text-gray-700">{r.label}</span>
                                        <span className="text-xs text-gray-400 ml-auto">{r.path}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
