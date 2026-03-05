"use client";
import { useAuth } from "@/lib/auth-context";
import { Check, Eye, EyeOff, Key, Loader2, Lock, Plus, Save, Trash2, UserCheck, UserPlus, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog";

interface AppUser {
    id: number; email: string; display_name: string; role: string;
    is_active: boolean; created_by: string; created_at: string;
    auth_type: 'app' | 'firebase';
    permissions: { route_path: string; can_access: boolean }[];
    user_roles: string[];
}
interface RoleInfo { role_code: string; role_name: string; department: string; }

export default function UsersTab() {
    const { user } = useAuth();
    const [users, setUsers] = useState<AppUser[]>([]);
    const [allRoles, setAllRoles] = useState<RoleInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [panel, setPanel] = useState<'none' | 'create' | 'addExisting' | 'roles' | 'password'>('none');
    const [sel, setSel] = useState<AppUser | null>(null);

    // Create form
    const [newEmail, setNewEmail] = useState(""); const [newPw, setNewPw] = useState("");
    const [newName, setNewName] = useState(""); const [newUserRoles, setNewUserRoles] = useState<string[]>([]);
    const [showPw, setShowPw] = useState(false); const [creating, setCreating] = useState(false);
    // Add existing
    const [exEmail, setExEmail] = useState(""); const [exName, setExName] = useState("");
    const [exUserRoles, setExUserRoles] = useState<string[]>([]);
    const [adding, setAdding] = useState(false);
    // Roles assignment
    const [selRoles, setSelRoles] = useState<string[]>([]); const [savingRoles, setSavingRoles] = useState(false);
    // Change password
    const [chPw, setChPw] = useState(""); const [showChPw, setShowChPw] = useState(false);
    const [chPwing, setChPwing] = useState(false);
    // Confirm dialog
    const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; userId: number; name: string }>({ open: false, userId: 0, name: "" });

    // Close modal on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && panel !== 'none') close();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [panel]);

    useEffect(() => { loadUsers(); loadAllRoles(); }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const r = await fetch(`/api/app-auth/users?requestEmail=${encodeURIComponent(user?.email || '')}`);
            const d = await r.json(); if (d.users) setUsers(d.users);
        } catch { toast.error("Lỗi") } finally { setLoading(false) }
    };

    const loadAllRoles = async () => {
        try {
            const r = await fetch('/api/app-auth/role-permissions');
            const d = await r.json(); if (d.roles) setAllRoles(d.roles);
        } catch { }
    };

    const close = () => { setPanel('none'); setSel(null); };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail || !newPw || !newName) { toast.error("Điền đầy đủ"); return; }
        setCreating(true);
        try {
            const r = await fetch("/api/app-auth/users", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: newEmail, password: newPw, displayName: newName, role: 'manager', userRoles: newUserRoles, authType: 'app', createdBy: user?.email })
            });
            const d = await r.json();
            if (d.success) {
                toast.success("Tạo thành công");
                setNewEmail(""); setNewPw(""); setNewName(""); setNewUserRoles([]); close(); loadUsers();
            } else { toast.error(d.error || "Lỗi tạo tài khoản"); }
        } catch { toast.error("Lỗi mạng"); } finally { setCreating(false); }
    };

    const handleAddExisting = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!exEmail || !exName) { toast.error("Điền email và tên"); return; }
        setAdding(true);
        try {
            const r = await fetch("/api/app-auth/users", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: exEmail, displayName: exName, role: 'manager', userRoles: exUserRoles, authType: 'firebase', createdBy: user?.email })
            });
            const d = await r.json();
            if (d.success) {
                toast.success("Đã phân quyền cho tài khoản Firebase");
                setExEmail(""); setExName(""); setExUserRoles([]); close(); loadUsers();
            } else { toast.error(d.error || "Lỗi"); }
        } catch { toast.error("Lỗi mạng"); } finally { setAdding(false); }
    };

    const openRoles = (u: AppUser) => { setSel(u); setSelRoles(u.user_roles || []); setPanel('roles'); };
    const handleSaveRoles = async () => {
        if (!sel) return; setSavingRoles(true);
        try {
            const r = await fetch("/api/app-auth/user-roles", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: sel.id, roleCodes: selRoles })
            });
            const d = await r.json();
            if (d.success) { toast.success(`Đã gán ${d.count} role`); close(); loadUsers(); }
            else toast.error(d.error || "Lỗi");
        } catch { toast.error("Lỗi") } finally { setSavingRoles(false) }
    };

    const openChPw = (u: AppUser) => { setSel(u); setChPw(""); setShowChPw(false); setPanel('password'); };
    const handleChPw = async (e: React.FormEvent) => {
        e.preventDefault(); if (!sel || !chPw) return; if (chPw.length < 6) { toast.error("Tối thiểu 6 ký tự"); return; }
        setChPwing(true);
        try {
            const r = await fetch("/api/app-auth/users", {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: sel.id, password: chPw })
            });
            const d = await r.json();
            if (d.success) { toast.success("Đã đổi MK"); close(); } else toast.error(d.error || "Lỗi");
        } catch { toast.error("Lỗi") } finally { setChPwing(false) }
    };

    const handleToggle = async (id: number, active: boolean) => {
        try {
            const r = await fetch("/api/app-auth/users", {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, isActive: !active })
            }); const d = await r.json();
            if (d.success) { toast.success(active ? "Vô hiệu" : "Kích hoạt"); loadUsers(); }
        } catch { toast.error("Lỗi") }
    };

    const confirmDelete = (u: AppUser) => setConfirmDlg({ open: true, userId: u.id, name: u.display_name });
    const handleDelete = async () => {
        try {
            const r = await fetch(`/api/app-auth/users?id=${confirmDlg.userId}`, { method: "DELETE" });
            const d = await r.json(); if (d.success) { toast.success("Đã xóa"); loadUsers(); } else toast.error(d.error || "Lỗi");
        } catch { toast.error("Lỗi") } finally { setConfirmDlg({ open: false, userId: 0, name: "" }) }
    };

    const depts = [...new Set(allRoles.map(r => r.department))];

    return (
        <div className="space-y-4">
            {/* Action buttons */}
            <div className="flex items-center gap-2 justify-end">
                <button onClick={() => { setPanel(panel === 'addExisting' ? 'none' : 'addExisting'); setSel(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-md text-sm font-medium transition-all hover:scale-105 ${panel === 'addExisting' ? 'bg-gray-200 text-gray-700' : 'bg-gradient-to-r from-green-600 to-green-700 text-white'}`}>
                    {panel === 'addExisting' ? <X className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    {panel === 'addExisting' ? "Đóng" : "Thêm TK đã có"}
                </button>
                <button onClick={() => { setPanel(panel === 'create' ? 'none' : 'create'); setSel(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-md text-sm font-medium transition-all hover:scale-105 ${panel === 'create' ? 'bg-gray-200 text-gray-700' : 'bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white'}`}>
                    {panel === 'create' ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {panel === 'create' ? "Đóng" : "Tạo TK mới"}
                </button>
            </div>

            {/* Add existing panel */}
            {panel === 'addExisting' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={close}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900"><UserCheck className="h-5 w-5 text-green-600" />Thêm tài khoản đã có & phân quyền</h3>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-5 border-b pb-3">Dành cho tài khoản Firebase. Nhập email đã có, đặt tên, chọn quyền.</p>
                        <form onSubmit={handleAddExisting} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input type="email" value={exEmail} onChange={e => setExEmail(e.target.value)} placeholder="user@mindx.net.vn" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Tên</label>
                                    <input type="text" value={exName} onChange={e => setExName(e.target.value)} placeholder="Nguyễn Văn A" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
                            </div>
                            <div className="mt-4"><label className="block text-sm font-semibold text-gray-800 mb-2">Vai trò (Role)</label>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto border rounded-xl p-3 bg-gray-50/50">
                                    {depts.map(dept => (
                                        <div key={dept}>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-l-2 border-green-500 pl-2">{dept}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {allRoles.filter(r => r.department === dept).map(r => (
                                                    <label key={r.role_code} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${exUserRoles.includes(r.role_code) ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                                        <input type="checkbox" checked={exUserRoles.includes(r.role_code)}
                                                            onChange={() => setExUserRoles(prev => prev.includes(r.role_code) ? prev.filter(x => x !== r.role_code) : [...prev, r.role_code])}
                                                            className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300" />
                                                        <span className="text-sm font-medium">{r.role_code}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 mt-2 border-t font-medium">
                                <button type="button" onClick={close} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                                <button type="submit" disabled={adding} className="px-5 py-2 text-sm text-white bg-[#15803d] hover:bg-[#166534] transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}Thêm & Phân quyền
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create panel */}
            {panel === 'create' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={close}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5 border-b pb-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900"><Plus className="h-5 w-5 text-[#a1001f]" />Tạo tài khoản mới (nội bộ)</h3>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Email</label>
                                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@mindx.edu.vn" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" /></div>
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Tên</label>
                                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nguyễn Văn A" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" /></div>
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
                                    <div className="relative"><input type={showPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Tối thiểu 6 ký tự" required minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" />
                                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 hover:bg-gray-100 rounded-full transition-colors">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                                <div className="md:col-span-2 space-y-1"><label className="block text-sm font-medium text-gray-700">Vai trò (Role)</label>
                                    <div className="space-y-4 max-h-[300px] overflow-y-auto border border-[#a1001f]/20 rounded-xl p-3 bg-gray-50/50">
                                        {depts.map(dept => (
                                            <div key={dept}>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-l-2 border-[#a1001f] pl-2">{dept}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {allRoles.filter(r => r.department === dept).map(r => (
                                                        <label key={r.role_code} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${newUserRoles.includes(r.role_code) ? 'border-[#a1001f] bg-red-50 text-[#a1001f]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                                            <input type="checkbox" checked={newUserRoles.includes(r.role_code)}
                                                                onChange={() => setNewUserRoles(prev => prev.includes(r.role_code) ? prev.filter(x => x !== r.role_code) : [...prev, r.role_code])}
                                                                className="w-4 h-4 rounded text-[#a1001f] focus:ring-[#a1001f] border-gray-300" />
                                                            <span className="text-sm font-medium">{r.role_code}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 mt-2 border-t font-medium">
                                <button type="button" onClick={close} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                                <button type="submit" disabled={creating} className="px-5 py-2 text-sm text-white bg-[#a1001f] hover:bg-[#c41230] transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Tạo tài khoản
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Roles assignment panel */}
            {panel === 'roles' && sel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={close}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900"><Key className="h-5 w-5 text-indigo-600" />Gán role quản lý cho: <span className="text-indigo-600">{sel.display_name}</span></h3>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-5 border-b pb-3">Mỗi role chứa một tập hợp các quyền truy cập màn hình. User sẽ được cấp quyền tổng hợp từ những role được chỉ định.</p>

                        <div className="space-y-4 max-h-[50vh] overflow-y-auto p-1">
                            {depts.map(dept => (
                                <div key={dept}>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-l-2 border-indigo-500 pl-2">{dept}</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                        {allRoles.filter(r => r.department === dept).map(r => (
                                            <label key={r.role_code} className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${selRoles.includes(r.role_code) ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                                                <input type="checkbox" checked={selRoles.includes(r.role_code)}
                                                    onChange={() => setSelRoles(prev => prev.includes(r.role_code) ? prev.filter(x => x !== r.role_code) : [...prev, r.role_code])}
                                                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900">{r.role_code}</p>
                                                    <p className="text-[11px] text-gray-500 truncate mt-0.5" title={r.role_name}>{r.role_name}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 mt-6 border-t font-medium">
                            <button onClick={close} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                            <button onClick={handleSaveRoles} disabled={savingRoles}
                                className="px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                {savingRoles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu thay đổi role
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change password panel */}
            {panel === 'password' && sel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={close}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900"><Lock className="h-5 w-5 text-amber-500" />Đổi mật khẩu</h3>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                        </div>
                        <p className="text-sm font-medium text-amber-600 mb-4 truncate" title={sel.display_name}>{sel.display_name}</p>

                        {sel.auth_type === 'firebase' ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                                <p className="text-sm text-amber-800">⚠️ Tài khoản Firebase — Mật khẩu được quản lý và đặt lại qua hệ thống Firebase Auth.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleChPw} className="space-y-4">
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                                    <div className="relative"><input type={showChPw ? "text" : "password"} value={chPw} onChange={e => setChPw(e.target.value)} placeholder="Tối thiểu 6 ký tự" required minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
                                        <button type="button" onClick={() => setShowChPw(!showChPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 hover:bg-gray-100 rounded-full transition-colors">{showChPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                                <div className="flex justify-end gap-3 pt-3 mt-4 border-t font-medium">
                                    <button type="button" onClick={close} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                                    <button type="submit" disabled={chPwing} className="px-5 py-2 text-sm text-white bg-amber-500 hover:bg-amber-600 transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                        {chPwing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}Cập nhật MK
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Users table */}
            <div className="bg-white rounded-xl border shadow-lg overflow-hidden">
                <div className="px-6 py-3 border-b bg-gradient-to-r from-gray-50 to-white">
                    <h3 className="text-sm font-bold flex items-center gap-2"><Users className="h-4 w-4 text-[#a1001f]" />Danh sách ({users.length})</h3>
                </div>
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" /></div>
                ) : users.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">Chưa có tài khoản nào</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {users.map(u => {
                            const isSel = sel?.id === u.id;
                            return (
                                <div key={u.id} className={`hover:bg-gray-50 transition-colors ${isSel ? 'bg-blue-50/50 ring-1 ring-blue-200' : ''}`}>
                                    <div className="px-6 py-3 flex items-center gap-4">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow flex-shrink-0 ${u.role === 'super_admin' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : u.is_active ? 'bg-gradient-to-br from-[#a1001f] to-[#c41230]' : 'bg-gray-400'}`}>
                                            {u.display_name.charAt(0).toUpperCase()}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-gray-900">{u.display_name}</p>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'super_admin' ? 'bg-amber-100 text-amber-800' : u.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                                    {u.role === 'super_admin' ? '👑 Super Admin' : u.role === 'admin' ? 'Admin' : 'Manager'}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-xs ${u.auth_type === 'firebase' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'}`}>
                                                    {u.auth_type === 'firebase' ? '🔥 Firebase' : '🔐 App'}</span>
                                                {!u.is_active && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Vô hiệu</span>}
                                            </div>
                                            <p className="text-xs text-gray-500">{u.email}</p>
                                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                {(u.user_roles || []).map((rc: string) => (
                                                    <span key={rc} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">{rc}</span>
                                                ))}
                                                {(!u.user_roles || u.user_roles.length === 0) && <span className="text-xs text-gray-400">Chưa gán role</span>}
                                            </div>
                                        </div>
                                        {u.role !== 'super_admin' && (
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button onClick={() => openRoles(u)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${isSel && panel === 'roles' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}>
                                                    <Key className="h-3.5 w-3.5" />Gán Role</button>
                                                {u.auth_type !== 'firebase' && (
                                                    <button onClick={() => openChPw(u)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${isSel && panel === 'password' ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}`}>
                                                        <Lock className="h-3.5 w-3.5" />Đổi MK</button>
                                                )}
                                                <button onClick={() => handleToggle(u.id, u.is_active)} title={u.is_active ? "Vô hiệu" : "Kích hoạt"}
                                                    className={`p-1.5 rounded-lg border transition-colors ${u.is_active ? 'border-gray-200 hover:border-orange-400 hover:bg-orange-50' : 'border-gray-200 hover:border-green-400 hover:bg-green-50'}`}>
                                                    {u.is_active ? <X className="h-3.5 w-3.5 text-gray-400" /> : <Check className="h-3.5 w-3.5 text-gray-400" />}</button>
                                                <button onClick={() => confirmDelete(u)} title="Xóa" className="p-1.5 rounded-lg border border-gray-200 hover:border-red-400 hover:bg-red-50">
                                                    <Trash2 className="h-3.5 w-3.5 text-gray-400" /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <ConfirmDialog open={confirmDlg.open} title="Xóa tài khoản" variant="danger"
                message={`Bạn chắc chắn muốn xóa tài khoản "${confirmDlg.name}"? Hành động này không thể hoàn tác.`}
                confirmText="Xóa tài khoản" onConfirm={handleDelete}
                onCancel={() => setConfirmDlg({ open: false, userId: 0, name: "" })} />
        </div>
    );
}
