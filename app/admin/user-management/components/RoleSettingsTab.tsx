"use client";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import { Loader2, Save, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/app-toast";
import PermSelector from "./PermSelector";

interface RoleData {
    role_code: string; role_name: string; description: string; department: string;
    permissions: string[]; permission_count: number;
}

export default function RoleSettingsTab() {
    const { token } = useAuth();
    const [roles, setRoles] = useState<RoleData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
    const [perms, setPerms] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    // New role modal state
    const [showNewRoleDialog, setShowNewRoleDialog] = useState(false);
    const [newRoleCode, setNewRoleCode] = useState("");
    const [newRoleName, setNewRoleName] = useState("");
    const [newRoleDept, setNewRoleDept] = useState("");
    const [newRoleDesc, setNewRoleDesc] = useState("");
    const [creatingRole, setCreatingRole] = useState(false);

    // Close modal on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedRole) setSelectedRole(null);
                if (showNewRoleDialog) setShowNewRoleDialog(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRole, showNewRoleDialog]);

    useEffect(() => { loadRoles(); }, []);

    const loadRoles = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/app-auth/role-permissions', { headers: authHeaders(token) });
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
                method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ roleCode: selectedRole.role_code, permissions: perms }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Đã lưu ${data.count} quyền cho ${selectedRole.role_code}`);
                setSelectedRole(null);
                loadRoles();
            } else toast.error(data.error || "Lỗi");
        } catch { toast.error("Lỗi kết nối"); }
        finally { setSaving(false); }
    };

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingRole(true);
        try {
            const res = await fetch('/api/app-auth/role-permissions', {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({
                    roleCode: newRoleCode,
                    roleName: newRoleName,
                    department: newRoleDept,
                    description: newRoleDesc
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Đã tạo Role ${data.roleCode}`);
                setShowNewRoleDialog(false);
                setNewRoleCode(""); setNewRoleName(""); setNewRoleDept(""); setNewRoleDesc("");
                loadRoles();
            } else toast.error(data.error || "Lỗi");
        } catch { toast.error("Lỗi kết nối"); }
        finally { setCreatingRole(false); }
    };

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" /></div>;

    const depts = [...new Set(roles.map(r => r.department))];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-sm text-gray-500">Click vào role để set các màn hình mà role đó được xem. Sau đó gán role cho user ở tab "Quản lý tài khoản".</p>
                <button onClick={() => setShowNewRoleDialog(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg shadow-md hover:bg-black transition-colors text-sm font-medium flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                    Thêm Role Mới
                </button>
            </div>

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
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setSelectedRole(null)}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
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

            {/* Create Role Modal */}
            {showNewRoleDialog && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setShowNewRoleDialog(false)}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                Thêm Role Mới
                            </h3>
                            <button onClick={() => setShowNewRoleDialog(false)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleCreateRole} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mã Role</label>
                                <input type="text" required value={newRoleCode} onChange={e => setNewRoleCode(e.target.value)} placeholder="VD: MKT, HR, AD..." className="w-full border border-gray-300 rounded-lg px-3 py-2 uppercase focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Role hiển thị</label>
                                <input type="text" required value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="VD: Marketing, Hành chính nhân sự..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban (nhóm)</label>
                                <input type="text" required value={newRoleDept} onChange={e => setNewRoleDept(e.target.value)} placeholder="VD: Back Office, Teaching..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả chi tiết</label>
                                <textarea rows={2} value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} placeholder="Phạm vi công việc của role này..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none resize-none"></textarea>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-2">
                                <button type="button" onClick={() => setShowNewRoleDialog(false)} className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                                <button type="submit" disabled={creatingRole} className="px-5 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-black rounded-lg shadow disabled:opacity-50 flex items-center gap-2 transition-colors">
                                    {creatingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>}
                                    Khởi tạo Role
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
