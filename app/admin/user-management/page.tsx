"use client";
import { useAuth } from "@/lib/auth-context";
import { Database, Settings, Shield, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import DataTab from "./components/DataTab";
import RoleSettingsTab from "./components/RoleSettingsTab";
import UsersTab from "./components/UsersTab";

type Tab = 'users' | 'roles' | 'data';

export default function UserManagementPage() {
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>('users');

    if (user?.role !== 'super_admin') {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-700 mb-2">Không có quyền truy cập</h2>
                    <p className="text-gray-500">Chỉ Super Admin mới có thể quản lý tài khoản.</p>
                </div>
            </div>
        );
    }

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'users', label: 'Quản lý tài khoản', icon: <Users className="h-4 w-4" /> },
        { key: 'roles', label: 'Cài đặt Role', icon: <Settings className="h-4 w-4" /> },
        { key: 'data', label: 'Dữ liệu tham chiếu', icon: <Database className="h-4 w-4" /> },
    ];

    return (
        <div className="p-4 w-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="h-7 w-7 text-[#a1001f]" />
                    Quản lý tài khoản & phân quyền
                </h1>
                <p className="text-sm text-gray-500 mt-1">Tạo tài khoản, gán role, cài đặt phân quyền theo role.</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6 gap-1">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${tab === t.key
                                ? 'border-[#a1001f] text-[#a1001f]'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}>{t.icon}{t.label}</button>
                ))}
            </div>

            {/* Tab content */}
            {tab === 'users' && <UsersTab />}
            {tab === 'roles' && <RoleSettingsTab />}
            {tab === 'data' && <DataTab />}
        </div>
    );
}
