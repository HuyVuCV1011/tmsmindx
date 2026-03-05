"use client";
import { Loader2, Save, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import PermSelector from "./PermSelector";

interface RoleData {
    role_code: string; role_name: string; description: string; department: string;
    permissions: string[]; permission_count: number;
}

export default function RoleSettingsTab() {
    const [roles, setRoles] = useState<RoleData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
    const [perms, setPerms] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    // Close modal on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedRole) setSelectedRole(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRole]);

    useEffect(() => { loadRoles(); }, []);

    const loadRoles = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/app-auth/role-permissions');
            const data = await res.json();
            if (data.roles) setRoles(data.roles);
        } catch { toast.error("Lỗi tải roles"); }
        finally { setLoading(false); }
    };

    const openRole = (r: RoleData) => {
        setSelectedRole(r);
        setPerms(r.permissions.filter(p => p !== null));
    };

    const handleSave = async () => {
        if (!selectedRole) return;
        setSaving(true);
        try {
            const res = await fetch('/api/app-auth/role-permissions', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleCode: selectedRole.role_code, permissions: perms }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Đã lưu ${data.count} quyền cho ${selectedRole.role_name}`);
                setSelectedRole(null);
                loadRoles();
            } else toast.error(data.error || "Lỗi");
        } catch { toast.error("Lỗi kết nối"); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" /></div>;

    const depts = [...new Set(roles.map(r => r.department))];

    return (
        <div className="space-y-6">
            <p className="text-sm text-gray-500">Click vào role để set các màn hình mà role đó được xem. Sau đó gán role cho user ở tab "Quản lý tài khoản".</p>

            {/* Role list by department */}
            {depts.map(dept => (
                <div key={dept}>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">{dept}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {roles.filter(r => r.department === dept).map(r => {
                            const isSelected = selectedRole?.role_code === r.role_code;
                            return (
                                <button key={r.role_code} onClick={() => openRole(r)}
                                    className={`text-left p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${isSelected ? 'border-[#a1001f] bg-red-50 shadow-md' : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-bold text-gray-900">{r.role_code}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.permission_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                            }`}>{r.permission_count} màn hình</span>
                                    </div>
                                    <p className="text-xs font-medium text-gray-700">{r.role_name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Permission editor panel */}
            {selectedRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setSelectedRole(null)}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Settings className="h-5 w-5 text-[#a1001f]" />
                                Cài đặt màn hình: <span className="text-[#a1001f]">{selectedRole.role_code} — {selectedRole.role_name}</span>
                            </h3>
                            <button onClick={() => setSelectedRole(null)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto pr-2 border border-gray-200 rounded-xl p-3 bg-gray-50/50 mb-4">
                            <PermSelector perms={perms} setPerms={setPerms} />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-200 font-medium">
                            <button onClick={() => setSelectedRole(null)} className="px-5 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-5 py-2 text-sm text-white bg-[#a1001f] hover:bg-[#c41230] transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Lưu cài đặt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
