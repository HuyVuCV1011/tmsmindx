"use client";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import { getLeaderAreas } from "@/lib/teaching-leaders";
import { Building2, Database, Edit2, Filter, LayoutGrid, Loader2, MapPin, Plus, Save, Search, Trash2, Users2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/app-toast";
import ConfirmDialog from "./ConfirmDialog";
import KanbanLeadersPanel from "./KanbanLeadersPanel";
import {
    CenterCardDragHeader,
    DraggableLeaderRow,
    DroppableCenterCard,
    DroppableRegion,
    LeaderCenterDndProvider,
} from "./CenterLeaderDnD";

type SubTab = 'centers-leaders' | 'roles' | 'kanban';
interface Leader {
    code: string;
    full_name: string;
    email?: string;
    role_code: string;
    role_name: string;
    center: string;
    courses: string;
    area: string;
    areas?: string[];
    status: string;
    joined_date: string;
}
interface Center { id: number; region: string; short_code: string; full_name: string; display_name: string; status: string; }
interface Filters { areas: string[]; roleCodes: { role_code: string; role_name: string }[]; statuses: string[]; courses: string[]; }

export default function DataTab() {
    const [subTab, setSubTab] = useState<SubTab>('centers-leaders');
    const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
        { key: 'centers-leaders', label: 'Centers & Leaders', icon: <Building2 className="h-4 w-4" /> },
        { key: 'kanban', label: 'Kanban', icon: <LayoutGrid className="h-4 w-4" /> },
        { key: 'roles', label: 'Roles', icon: <Database className="h-4 w-4" /> },
    ];
    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500">
                Quản lý dữ liệu hệ thống: Centers, Teaching Leaders, và Roles.
                {subTab === 'kanban' && (
                    <span className="mt-1 block text-[13px] text-gray-600">
                        Kanban: kéo thả leader giữa <strong>Đang hoạt động</strong> và <strong>Tạm ngưng</strong> để cập nhật trạng thái nhanh.
                    </span>
                )}
            </p>
            <div className="flex gap-2 flex-wrap">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setSubTab(t.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === t.key ? 'bg-[#a1001f] text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}>{t.icon}{t.label}</button>
                ))}
            </div>
            {subTab === 'centers-leaders' && <CentersLeadersPanel />}
            {subTab === 'kanban' && <KanbanLeadersPanel />}
            {subTab === 'roles' && <RolesPanel />}
        </div>
    );
}

// ─── COMBINED CENTERS & LEADERS PANEL ───────────────────
function CentersLeadersPanel() {
    const { token } = useAuth();
    const [centers, setCenters] = useState<Center[]>([]);
    const [leaders, setLeaders] = useState<Leader[]>([]);
    const [filters, setFilters] = useState<Filters>({ areas: [], roleCodes: [], statuses: [], courses: [] });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [fStatus, setFStatus] = useState("");
    const [fArea, setFArea] = useState("");
    const [fRole, setFRole] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [expandedCenters, setExpandedCenters] = useState<Set<number>>(new Set());
    const [expandAll, setExpandAll] = useState(false);

    // Leader CRUD
    const [editLeader, setEditLeader] = useState<Leader | null>(null);
    const [editCenter, setEditCenter] = useState<Center | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);

    // Confirm dialogs
    const [statusDlg, setStatusDlg] = useState<{ open: boolean; type: 'center' | 'leader'; item: any; newStatus: string }>({ open: false, type: 'center', item: null, newStatus: '' });
    const [deleteDlg, setDeleteDlg] = useState<{ open: boolean; code: string; name: string }>({ open: false, code: "", name: "" });

    // Close modal on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (editLeader) setEditLeader(null);
                if (editCenter) setEditCenter(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editLeader, editCenter]);

    useEffect(() => { loadAll(); }, [fStatus, fArea, fRole]);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [cRes, lRes] = await Promise.all([
                fetch('/api/app-auth/data?table=centers', { headers: authHeaders(token) }),
                fetch(`/api/app-auth/data?table=teaching_leaders${fStatus ? `&status=${fStatus}` : ''}${fArea ? `&area=${fArea}` : ''}${fRole ? `&roleCode=${fRole}` : ''}`, { headers: authHeaders(token) }),
            ]);
            const [cData, lData] = await Promise.all([cRes.json(), lRes.json()]);
            if (cData.rows) setCenters(cData.rows);
            if (lData.rows) setLeaders(lData.rows);
            if (lData.filters) setFilters(lData.filters);
        } catch { toast.error("Lỗi") } finally { setLoading(false) }
    };

    // Toggle expand
    const toggleExpand = (id: number) => {
        const s = new Set(expandedCenters);
        s.has(id) ? s.delete(id) : s.add(id);
        setExpandedCenters(s);
    };
    const toggleExpandAll = () => {
        if (expandAll) { setExpandedCenters(new Set()); }
        else { setExpandedCenters(new Set(centers.map(c => c.id))); }
        setExpandAll(!expandAll);
    };

    // Status toggle with confirm
    const askToggleStatus = (type: 'center' | 'leader', item: any) => {
        const newStatus = item.status === 'Active' ? 'Deactive' : 'Active';
        setStatusDlg({ open: true, type, item, newStatus });
    };
    const doToggleStatus = async () => {
        if (!statusDlg.item) return;
        try {
            const table = statusDlg.type === 'center' ? 'centers_status' : 'teaching_leaders_status';
            const key = statusDlg.type === 'center' ? { id: statusDlg.item.id } : { code: statusDlg.item.code };
            const r = await fetch('/api/app-auth/data', {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ table, ...key, status: statusDlg.newStatus })
            });
            const d = await r.json();
            if (d.success) { toast.success(`${statusDlg.type === 'center' ? statusDlg.item.display_name : statusDlg.item.full_name}: ${statusDlg.newStatus}`); loadAll(); }
        } catch { toast.error("Lỗi") } finally { setStatusDlg({ open: false, type: 'center', item: null, newStatus: '' }); }
    };

    // Leader CRUD
    const handleSaveLeader = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editLeader) return;
        const areas = editLeader.areas?.length
            ? editLeader.areas
            : getLeaderAreas(editLeader);
        if (areas.length === 0) {
            toast.error('Chọn ít nhất một khu vực.');
            return;
        }
        setSaving(true);
        try {
            const method = isNew ? 'POST' : 'PUT';
            const r = await fetch('/api/app-auth/data', {
                method, headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({
                    table: 'teaching_leaders',
                    ...editLeader,
                    areas,
                    area: areas[0] || '',
                })
            });
            const d = await r.json();
            if (d.success) { toast.success(isNew ? "Đã thêm" : "Đã cập nhật"); setEditLeader(null); loadAll(); }
            else toast.error(d.error || "Lỗi");
        } catch { toast.error("Lỗi") } finally { setSaving(false) }
    };
    const handleDeleteLeader = async () => {
        try {
            const r = await fetch(`/api/app-auth/data?table=teaching_leaders&code=${deleteDlg.code}`, { method: 'DELETE', headers: authHeaders(token) });
            const d = await r.json();
            if (d.success) { toast.success("Đã xóa"); loadAll(); } else toast.error(d.error || "Lỗi");
        } catch { toast.error("Lỗi") } finally { setDeleteDlg({ open: false, code: "", name: "" }) }
    };
    const openNewLeader = (center?: string, regionOrArea?: string) => {
        setIsNew(true);
        const initialAreas = regionOrArea?.trim() ? [regionOrArea.trim()] : [];
        setEditLeader({
            code: '',
            full_name: '',
            role_code: '',
            role_name: '',
            center: center || '',
            courses: '',
            area: initialAreas[0] || '',
            areas: initialAreas,
            status: 'Active',
            joined_date: '',
        });
    };
    const openEditLeader = (l: Leader) => {
        setIsNew(false);
        const areas = getLeaderAreas(l);
        setEditLeader({ ...l, areas, area: areas[0] || l.area || '' });
    };

    const handleAssignCenter = async (code: string, centerFullName: string) => {
        try {
            const r = await fetch('/api/app-auth/data', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({
                    table: 'teaching_leaders_center',
                    code,
                    center: centerFullName,
                }),
            });
            const d = await r.json();
            if (d.success) {
                toast.success('Đã chuyển leader sang cơ sở mới');
                loadAll();
            } else toast.error(d.error || 'Không cập nhật được');
        } catch {
            toast.error('Lỗi mạng');
        }
    };

    const handleAssignLeaderAreas = async (code: string, areas: string[]) => {
        try {
            const r = await fetch('/api/app-auth/data', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({
                    table: 'teaching_leaders_areas',
                    code,
                    areas,
                }),
            });
            const d = await r.json();
            if (d.success) {
                toast.success('Đã cập nhật khu vực cho leader');
                loadAll();
            } else toast.error(d.error || 'Không cập nhật được');
        } catch {
            toast.error('Lỗi mạng');
        }
    };

    const handleAssignCenterRegion = async (centerId: number, region: string) => {
        try {
            const r = await fetch('/api/app-auth/data', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({
                    table: 'centers_region',
                    id: centerId,
                    region,
                }),
            });
            const d = await r.json();
            if (d.success) {
                toast.success('Đã chuyển cơ sở sang khu vực mới');
                loadAll();
            } else toast.error(d.error || 'Không cập nhật được');
        } catch {
            toast.error('Lỗi mạng');
        }
    };

    const toggleLeaderArea = (a: string) => {
        if (!editLeader) return;
        const cur = editLeader.areas || getLeaderAreas(editLeader);
        const next = cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a];
        setEditLeader({
            ...editLeader,
            areas: next,
            area: next[0] || '',
        });
    };

    // Center CRUD
    const handleSaveCenter = async (e: React.FormEvent) => {
        e.preventDefault(); if (!editCenter) return; setSaving(true);
        try {
            const r = await fetch('/api/app-auth/data', {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ table: 'centers_region', id: editCenter.id, region: editCenter.region })
            });
            const d = await r.json();
            if (d.success) { toast.success("Đã cập nhật khu vực"); setEditCenter(null); loadAll(); }
            else toast.error(d.error || "Lỗi cập nhật");
        } catch { toast.error("Lỗi") } finally { setSaving(false) }
    };

    // Filter data
    const searchLower = search.toLowerCase();
    const filteredCenters = centers.filter(c => !search ||
        c.display_name?.toLowerCase().includes(searchLower) ||
        c.full_name?.toLowerCase().includes(searchLower) ||
        c.region?.toLowerCase().includes(searchLower) ||
        // Also match if any leader in this center matches
        leaders.some(l => l.center === c.full_name && (l.full_name.toLowerCase().includes(searchLower) || l.code.toLowerCase().includes(searchLower)))
    );
    const leaderMatchesSearch = (l: Leader) => {
        if (!search) return true;
        const la = getLeaderAreas(l);
        return (
            l.full_name.toLowerCase().includes(searchLower) ||
            l.code.toLowerCase().includes(searchLower) ||
            la.some((x) => x.toLowerCase().includes(searchLower))
        );
    };
    const allRegions = new Set([
        ...filteredCenters.map(c => c.region),
        ...leaders.filter(leaderMatchesSearch).flatMap((l) => getLeaderAreas(l)),
    ]);
    const regions = Array.from(allRegions).sort();

    const isRegionGrouped = (region: string) => region.startsWith('HCM') || region.startsWith('HN') || region === 'ONLINE' || region === 'HO';

    const renderLeaderItem = (l: Leader, indentClass: string = "pl-4", draggable = false, sourceRegion = "") => {
        const rowInner = (
            <>
                <div className={`h-7 w-7 rounded-full flex justify-center items-center text-white text-xs font-bold flex-shrink-0 ${l.status === 'Active' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-400'}`}>
                    {l.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{l.full_name}</span>
                        <span className="text-xs text-gray-400">({l.code})</span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">{l.role_code}</span>
                        {l.courses && <span className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600">{l.courses}</span>}
                        {getLeaderAreas(l).map((ar) => (
                            <span key={ar} className="px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-800">{ar}</span>
                        ))}
                    </div>
                    {l.center && <p className="text-xs text-gray-500 mt-0.5">{l.center}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" onClick={() => askToggleStatus('leader', l)}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${l.status === 'Active' ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'}`}>
                        {l.status}
                    </button>
                    <button type="button" onClick={() => openEditLeader(l)} className="p-1 rounded hover:bg-blue-50" title="Sửa">
                        <Edit2 className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    <button type="button" onClick={() => setDeleteDlg({ open: true, code: l.code, name: l.full_name })} className="p-1 rounded hover:bg-red-50" title="Xóa">
                        <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                </div>
            </>
        );
        if (draggable && sourceRegion) {
            return (
                <DraggableLeaderRow key={l.code} leader={l} indentClass={indentClass} sourceRegion={sourceRegion}>
                    {rowInner}
                </DraggableLeaderRow>
            );
        }
        return (
            <div key={l.code} className={`px-4 ${indentClass} py-2 flex items-center gap-3 hover:bg-white transition-colors border-b last:border-0 ${l.status !== 'Active' ? 'opacity-50' : ''}`}>
                {rowInner}
            </div>
        );
    };

    // Stats
    const activeCenters = centers.filter(c => c.status === 'Active').length;
    const activeLeaders = leaders.filter(l => l.status === 'Active').length;

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" /></div>;

    return (
        <div className="space-y-4">
            {/* Stats bar */}
            <div className="flex items-center gap-5 flex-wrap text-sm">
                <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#a1001f]" /><b>{activeCenters}</b>/<span className="text-gray-400">{centers.length}</span> Centers</div>
                <div className="flex items-center gap-2"><Users2 className="h-4 w-4 text-indigo-600" /><b>{activeLeaders}</b>/<span className="text-gray-400">{leaders.length}</span> Leaders</div>
            </div>

            {/* Search + Filters + Actions */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm center, leader..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#a1001f]" />
                </div>
                <button onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilters ? 'bg-[#a1001f] text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <Filter className="h-4 w-4" />{(fStatus || fArea || fRole) ? `Lọc (${[fStatus, fArea, fRole].filter(Boolean).length})` : 'Bộ lọc'}
                </button>
                <button onClick={toggleExpandAll} className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    {expandAll ? 'Thu gọn' : 'Mở rộng'} tất cả
                </button>
                <button onClick={() => openNewLeader()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white text-sm font-medium shadow hover:shadow-md">
                    <Plus className="h-4 w-4" />Thêm Leader
                </button>
            </div>
            <p className="text-xs text-gray-500">
                <strong>Kéo leader</strong> (⋮⋮): thả vào <strong>khung khu vực</strong> khác để đổi khu vực phụ trách; thả vào <strong>khung cơ sở</strong> / dòng leader cùng cơ sở để đổi cơ sở.
                <span className="ml-1"><strong>Kéo cơ sở</strong> (⋮⋮ đầu dòng cơ sở): thả vào vùng <strong>khu vực đích</strong> (khung bọc tiêu đề khu vực).</span>
            </p>

            {/* Filters */}
            {showFilters && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border flex-wrap">
                    <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#a1001f]">
                        <option value="">Tất cả trạng thái</option><option value="Active">Active</option><option value="Deactive">Deactive</option>
                    </select>
                    <select value={fArea} onChange={e => setFArea(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#a1001f]">
                        <option value="">Tất cả khu vực</option>
                        {filters.areas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select value={fRole} onChange={e => setFRole(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#a1001f]">
                        <option value="">Tất cả role</option>
                        {filters.roleCodes.map(r => <option key={r.role_code} value={r.role_code}>{r.role_code} - {r.role_name}</option>)}
                    </select>
                    {(fStatus || fArea || fRole) && <button onClick={() => { setFStatus(""); setFArea(""); setFRole(""); }} className="text-xs text-[#a1001f] hover:underline">Xóa lọc</button>}
                </div>
            )}

            {/* Edit leader form modal */}
            {editLeader && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setEditLeader(null)}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-5 border-b pb-3">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                {isNew ? <Plus className="h-5 w-5 text-[#a1001f]" /> : <Edit2 className="h-5 w-5 text-[#a1001f]" />}
                                {isNew ? "Thêm Teaching Leader mới" : "Chỉnh sửa Leader: " + editLeader.full_name}
                            </h3>
                            <button onClick={() => setEditLeader(null)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSaveLeader} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Code</label>
                                    <input value={editLeader.code} onChange={e => setEditLeader({ ...editLeader, code: e.target.value })} required disabled={!isNew}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" /></div>
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Họ tên</label>
                                    <input value={editLeader.full_name} onChange={e => setEditLeader({ ...editLeader, full_name: e.target.value })} required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" /></div>
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Email</label>
                                    <input type="email" value={editLeader.email || ''} onChange={e => setEditLeader({ ...editLeader, email: e.target.value })}
                                        placeholder="example@mindx.edu.vn"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" /></div>
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Role</label>
                                    <select value={editLeader.role_code} onChange={e => { const rc = filters.roleCodes.find(r => r.role_code === e.target.value); setEditLeader({ ...editLeader, role_code: e.target.value, role_name: rc?.role_name || '' }); }} required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]">
                                        <option value="">Chọn role</option>
                                        {filters.roleCodes.map(r => <option key={r.role_code} value={r.role_code}>{r.role_code} - {r.role_name}</option>)}
                                    </select></div>
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Center</label>
                                    <select value={editLeader.center} onChange={e => setEditLeader({ ...editLeader, center: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]">
                                        <option value="">Không có center (Nhóm quản lý)</option>
                                        {centers.map(c => <option key={c.id} value={c.full_name}>{c.display_name}</option>)}
                                    </select></div>
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Courses</label>
                                    <select value={editLeader.courses || ''} onChange={e => setEditLeader({ ...editLeader, courses: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]">
                                        <option value="">Chọn courses</option>
                                        {filters.courses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select></div>
                                <div className="sm:col-span-2 space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Khu vực phụ trách * <span className="font-normal text-gray-500">(có thể chọn nhiều)</span></label>
                                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                                        {filters.areas.length === 0 ? (
                                            <p className="text-xs text-gray-500">Chưa có danh sách khu vực trong hệ thống.</p>
                                        ) : (
                                            filters.areas.map((a) => {
                                                const checked = (editLeader.areas || getLeaderAreas(editLeader)).includes(a);
                                                return (
                                                    <label key={a} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${checked ? 'border-[#a1001f] bg-red-50 text-[#a1001f]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                                        <input type="checkbox" checked={checked} onChange={() => toggleLeaderArea(a)} className="rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]" />
                                                        {a}
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Status</label>
                                    <select value={editLeader.status} onChange={e => setEditLeader({ ...editLeader, status: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]">
                                        <option value="Active">Active</option><option value="Deactive">Deactive</option>
                                    </select></div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 mt-2 border-t font-medium">
                                <button type="button" onClick={() => setEditLeader(null)} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                                <button type="submit" disabled={saving} className="px-5 py-2 text-sm text-white bg-[#a1001f] hover:bg-[#c41230] transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isNew ? "Thêm mới" : "Lưu thay đổi"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Regions → Centers → Leaders */}
            {/* Regions → Hierarchical Grouping */}
            <LeaderCenterDndProvider
                leaders={leaders}
                centers={centers}
                onAssignCenter={handleAssignCenter}
                onAssignLeaderAreas={handleAssignLeaderAreas}
                onAssignCenterRegion={handleAssignCenterRegion}
            >
            {regions.map(region => {
                const regionCenters = filteredCenters.filter(c => c.region === region);
                const grouped = isRegionGrouped(region);

                // Region-level leaders (HCM/HN/Online = All, TỈNH = TEGL/Admin/TM/HR)
                const regionLeaders = leaders.filter(l =>
                    getLeaderAreas(l).includes(region) && (grouped || ['TEGL', 'Admin', 'TM', 'HR'].includes(l.role_code))
                );

                return (
                    <DroppableRegion key={region} regionKey={region} className="mb-8 space-y-3">
                        {/* Region Header */}
                        <div className="flex items-center gap-2 border-b px-1 pb-2">
                            <MapPin className="h-5 w-5 text-[#a1001f]" />
                            <h3 className="text-base font-bold text-gray-900">{region}</h3>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {regionCenters.length} centers, {regionLeaders.length} region leaders
                            </span>
                        </div>

                        {/* Region Leaders */}
                        {regionLeaders.length > 0 && (
                            <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-3">
                                <div className="px-4 py-2.5 bg-gray-50/80 border-b text-xs font-bold text-gray-600 uppercase flex justify-between items-center">
                                    <span className="flex items-center gap-1.5"><Users2 className="h-4 w-4 text-indigo-500" /> Ban quản lý khu vực</span>
                                    <button onClick={() => openNewLeader('', region)} className="text-[#a1001f] normal-case flex items-center gap-1 font-medium hover:underline"><Plus className="h-3.5 w-3.5" /> Thêm QL</button>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {regionLeaders.map(l => renderLeaderItem(l, "pl-4", true, region))}
                                </div>
                            </div>
                        )}
                        {regionLeaders.length === 0 && (
                            <div className="cursor-pointer px-2"><button onClick={() => openNewLeader('', region)} className="text-sm font-medium text-[#a1001f] hover:underline flex items-center gap-1.5"><Plus className="h-4 w-4" />Thêm quản lý khu vực</button></div>
                        )}

                        {/* Centers */}
                        {regionCenters.length > 0 && (
                            <div className="grid grid-cols-1 gap-2 pl-2 border-l-2 border-gray-100 ml-3">
                                {regionCenters.map(center => {
                                    // For TỈNH, get localized leaders. For grouped areas, we don't nest leaders under centers.
                                    const centerLeaders = grouped ? [] : leaders.filter(l => l.center === center.full_name && !['TEGL', 'Admin', 'TM', 'HR'].includes(l.role_code));
                                    const isExpanded = expandedCenters.has(center.id);
                                    const activeL = centerLeaders.filter(l => l.status === 'Active').length;

                                    return (
                                        <DroppableCenterCard key={center.id} centerId={center.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${center.status !== 'Active' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                            <CenterCardDragHeader
                                                center={{
                                                    id: center.id,
                                                    full_name: center.full_name,
                                                    display_name: center.display_name,
                                                    region: center.region,
                                                    short_code: center.short_code,
                                                    status: center.status || 'Active',
                                                }}
                                                grouped={grouped}
                                                isExpanded={isExpanded}
                                                showLeaderCount={!grouped && centerLeaders.length > 0}
                                                activeL={activeL}
                                                centerLeadersCount={centerLeaders.length}
                                                onRowClick={() => { if (!grouped) toggleExpand(center.id); }}
                                                onEdit={(e) => { e.stopPropagation(); setEditCenter({ ...center }); }}
                                                onToggleStatus={(e) => { e.stopPropagation(); askToggleStatus('center', center); }}
                                            />

                                            {!grouped && isExpanded && (
                                                <div className="border-t bg-gray-50/50">
                                                    {centerLeaders.length === 0 ? (
                                                        <div className="px-8 py-3 text-xs text-gray-400 italic flex items-center justify-between">
                                                            <span>Chưa có leader cấp cơ sở</span>
                                                            <button onClick={() => openNewLeader(center.full_name, center.region)}
                                                                className="text-[#a1001f] hover:underline flex items-center gap-1 font-medium not-italic"><Plus className="h-3 w-3" /> Thêm</button>
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-gray-100">
                                                            {centerLeaders.map(l => renderLeaderItem(l, "pl-11", true, region))}
                                                            <div className="px-11 py-2">
                                                                <button onClick={() => openNewLeader(center.full_name, center.region)}
                                                                    className="text-xs font-medium text-[#a1001f] hover:underline flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Thêm leader tại đây</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </DroppableCenterCard>
                                    );
                                })}
                            </div>
                        )}
                    </DroppableRegion>
                );
            })}
            </LeaderCenterDndProvider>

            {filteredCenters.length === 0 && <div className="text-center py-12 text-gray-500">Không tìm thấy center nào</div>}

            {/* Edit center form modal */}
            {editCenter && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setEditCenter(null)}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-5 border-b pb-3">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Edit2 className="h-5 w-5 text-[#a1001f]" />
                                Đổi Khu Vực
                            </h3>
                            <button onClick={() => setEditCenter(null)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 font-medium mb-4">Cơ sở: <span className="text-gray-900 font-bold">{editCenter.display_name}</span></p>
                        <form onSubmit={handleSaveCenter} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Khu vực (Region)</label>
                                <select value={editCenter.region || ''} onChange={e => setEditCenter({ ...editCenter, region: e.target.value })} required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]">
                                    <option value="">Chọn khu vực</option>
                                    {filters.areas.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 mt-2 border-t font-medium">
                                <button type="button" onClick={() => setEditCenter(null)} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                                <button type="submit" disabled={saving} className="px-5 py-2 text-sm text-white bg-[#a1001f] hover:bg-[#c41230] transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu thay đổi
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm dialogs */}
            <ConfirmDialog open={statusDlg.open}
                title={statusDlg.type === 'center' ? "Đổi trạng thái Center" : "Đổi trạng thái Leader"}
                variant={statusDlg.newStatus === 'Deactive' ? 'danger' : 'warning'}
                message={`Chuyển "${statusDlg.type === 'center' ? statusDlg.item?.display_name : statusDlg.item?.full_name}" sang ${statusDlg.newStatus}?`}
                confirmText={statusDlg.newStatus === 'Deactive' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                onConfirm={doToggleStatus} onCancel={() => setStatusDlg({ open: false, type: 'center', item: null, newStatus: '' })} />

            <ConfirmDialog open={deleteDlg.open} title="Xóa Teaching Leader" variant="danger"
                message={`Xóa "${deleteDlg.name}" (${deleteDlg.code})? Không thể hoàn tác.`}
                confirmText="Xóa" onConfirm={handleDeleteLeader} onCancel={() => setDeleteDlg({ open: false, code: "", name: "" })} />
        </div>
    );
}

// ─── ROLES PANEL ────────────────────────────────────────
function RolesPanel() {
    const { token } = useAuth();
    const [roles, setRoles] = useState<any[]>([]);
    const [leaders, setLeaders] = useState<Leader[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [rolesRes, leadersRes] = await Promise.all([
                fetch('/api/app-auth/data?table=roles', { headers: authHeaders(token) }),
                fetch('/api/app-auth/data?table=teaching_leaders', { headers: authHeaders(token) })
            ]);
            const rolesData = await rolesRes.json();
            const leadersData = await leadersRes.json();
            if (rolesData.rows) setRoles(rolesData.rows);
            if (leadersData.rows) setLeaders(leadersData.rows);
        } catch {
            toast.error("Lỗi tải dữ liệu");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" /></div>;

    const depts = [...new Set(roles.map(r => r.department))].sort();

    return (
        <div className="space-y-6">
            {depts.map(dept => (
                <div key={dept} className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2 border-b pb-1">{dept}</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {roles.filter(r => r.department === dept).map(r => {
                            const roleLeaders = leaders.filter(l => l.role_code === r.role_code);
                            const activeCount = roleLeaders.filter(l => l.status === 'Active').length;
                            return (
                                <div key={r.role_code} className="bg-white rounded-xl border shadow-sm flex flex-col h-full overflow-hidden">
                                    <div className="p-4 border-b bg-gray-50/50">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-base font-bold text-[#a1001f]">{r.role_code}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{activeCount}/{roleLeaders.length} members</span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-900">{r.role_name}</p>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2" title={r.description}>{r.description}</p>
                                    </div>
                                    <div className="flex-1 p-0 overflow-y-auto max-h-[300px]">
                                        {roleLeaders.length === 0 ? (
                                            <div className="p-4 text-xs text-gray-400 italic text-center">Chưa có nhân sự nào</div>
                                        ) : (
                                            <div className="divide-y divide-gray-100">
                                                {roleLeaders.map(l => (
                                                    <div key={l.code} className={`px-4 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 transition-colors ${l.status !== 'Active' ? 'opacity-50' : ''}`}>
                                                        <div className={`h-6 w-6 rounded-full flex justify-center items-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5 ${l.status === 'Active' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gray-400'}`}>
                                                            {l.full_name.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-sm font-medium text-gray-900 truncate" title={l.full_name}>{l.full_name}</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${l.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{l.status}</span>
                                                            </div>
                                                            <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                                                                <span className="font-mono text-gray-400">{l.code}</span>
                                                                {getLeaderAreas(l).length > 0 && (
                                                                    <span className="text-amber-600">({getLeaderAreas(l).join(', ')})</span>
                                                                )}
                                                            </div>
                                                            {l.center && <div className="text-[11px] text-gray-400 mt-0.5 truncate" title={l.center}>{l.center}</div>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
