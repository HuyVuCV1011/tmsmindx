"use client";

import { PageContainer } from "@/components/PageContainer";
import { StepItem, Stepper } from "@/components/ui/stepper";
import { useAuth } from "@/lib/auth-context";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type FeedbackItem = {
  id: number;
  user_email: string;
  user_name: string | null;
  screen_path?: string | null;
  content: string;
  suggestion: string | null;
  image_urls: string[] | null;
  admin_image_urls?: string[] | null;
  status: "new" | "in_progress" | "done";
  admin_note: string | null;
  admin_reply?: string | null;
  created_at: string;
};

const statusOptions: Array<{ value: FeedbackItem["status"]; label: string }> = [
  { value: "new", label: "Mới tiếp nhận" },
  { value: "in_progress", label: "Đang xử lý" },
  { value: "done", label: "Hoàn thành" },
];

const statusBadgeClass: Record<FeedbackItem["status"], string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const getNextAction = (status: FeedbackItem["status"]) => {
  if (status === "new") {
    return { next: "in_progress" as const, label: "Tiếp nhận xử lý", hint: "Bước 1 -> Bước 2" };
  }
  if (status === "in_progress") {
    return { next: "done" as const, label: "Đánh dấu hoàn thành", hint: "Bước 2 -> Bước 3" };
  }
  return null;
};

const getProgressSteps = (status: FeedbackItem["status"]): StepItem[] => {
  const currentIndex = status === "new" ? 0 : status === "in_progress" ? 1 : 2;
  return [
    {
      id: "new",
      label: "Step 1",
      description: "Tiếp nhận",
      status: currentIndex > 0 ? "completed" : currentIndex === 0 ? "current" : "upcoming",
    },
    {
      id: "in_progress",
      label: "Step 2",
      description: "Đang xử lý",
      status: currentIndex > 1 ? "completed" : currentIndex === 1 ? "current" : "upcoming",
    },
    {
      id: "done",
      label: "Step 3",
      description: "Hoàn thành",
      status: currentIndex === 2 ? "success" : "upcoming",
    },
  ];
};

export default function AdminFeedbackPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [filterStatus, setFilterStatus] = useState<"all" | FeedbackItem["status"]>("all");
  const [searchText, setSearchText] = useState("");
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [detailItem, setDetailItem] = useState<FeedbackItem | null>(null);
  const [detailReply, setDetailReply] = useState("");
  const [detailAdminImages, setDetailAdminImages] = useState<string[]>([]);

  useEffect(() => {
    if (!detailItem && !previewImages) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (previewImages) {
          setPreviewImages(null);
          return;
        }
        if (detailItem) setDetailItem(null);
        return;
      }

      if (!previewImages || previewImages.length === 0) return;
      if (event.key === "ArrowLeft") {
        setPreviewIndex((prev) => (prev - 1 + previewImages.length) % previewImages.length);
      } else if (event.key === "ArrowRight") {
        setPreviewIndex((prev) => (prev + 1) % previewImages.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailItem, previewImages]);

  const fetchItems = async () => {
    if (!user?.email) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ scope: "all", requestEmail: user.email });
      const response = await fetch(`/api/feedback?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Không thể tải feedback");
      }
      setItems(data.items || []);
      const initialNotes: Record<number, string> = {};
      (data.items || []).forEach((item: FeedbackItem) => {
        initialNotes[item.id] = item.admin_note || "";
      });
      setNotes(initialNotes);
    } catch (error: any) {
      toast.error(error.message || "Lỗi tải feedback");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchStatus = filterStatus === "all" || item.status === filterStatus;
      const q = searchText.trim().toLowerCase();
      const matchSearch =
        q.length === 0 ||
        item.user_email.toLowerCase().includes(q) ||
        (item.user_name || "").toLowerCase().includes(q) ||
        (item.content || "").toLowerCase().includes(q) ||
        (item.screen_path || "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [items, filterStatus, searchText]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      new: items.filter((x) => x.status === "new").length,
      inProgress: items.filter((x) => x.status === "in_progress").length,
      done: items.filter((x) => x.status === "done").length,
    };
  }, [items]);

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const updateStatus = async (item: FeedbackItem, status: FeedbackItem["status"]) => {
    if (!user?.email) return;
    try {
      setSavingId(item.id);
      const response = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          status,
          adminNote: notes[item.id] || "",
          adminReply: item.admin_reply || "",
          adminImageUrls: item.admin_image_urls || [],
          requestEmail: user.email,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Không thể cập nhật feedback");
      }
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, ...data.item } : x)));
      toast.success("Đã cập nhật feedback");
    } catch (error: any) {
      toast.error(error.message || "Lỗi cập nhật feedback");
    } finally {
      setSavingId(null);
    }
  };

  const uploadAdminImages = async (files: File[]) => {
    const uploaded = await Promise.all(
      files.map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/feedback/upload-image", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Không thể upload ảnh phản hồi");
      }
      return data.url || data.storagePath;
      })
    );
    return uploaded.filter(Boolean);
  };

  const handleAdminFiles = async (files: File[]) => {
    if (files.length === 0) return;
    try {
      const uploaded = await uploadAdminImages(files);
      setDetailAdminImages((prev) => [...prev, ...uploaded]);
      toast.success("Đã upload ảnh phản hồi");
    } catch (error: any) {
      toast.error(error.message || "Lỗi upload ảnh phản hồi");
    }
  };

  const saveFromModal = async (nextStatus?: FeedbackItem["status"]) => {
    if (!detailItem || !user?.email) return;
    try {
      setSavingId(detailItem.id);
      const targetStatus = nextStatus || detailItem.status;
      const response = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: detailItem.id,
          status: targetStatus,
          adminNote: notes[detailItem.id] || "",
          adminReply: detailReply,
          adminImageUrls: detailAdminImages,
          requestEmail: user.email,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Không thể cập nhật feedback");
      }
      setItems((prev) => prev.map((x) => (x.id === detailItem.id ? { ...x, ...data.item } : x)));
      setDetailItem({ ...detailItem, ...data.item });
      toast.success("Đã lưu xử lý");
    } catch (error: any) {
      toast.error(error.message || "Lỗi xử lý feedback");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <PageContainer title="Feedback Manager" description="Danh sách feedback người dùng và trạng thái xử lý">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <button
          type="button"
          onClick={() => setFilterStatus("all")}
          className={`text-left rounded-lg border p-3 transition-colors ${
            filterStatus === "all" ? "bg-[#a1001f]/5 border-[#a1001f]" : "bg-white border-gray-200 hover:bg-gray-50"
          }`}
        >
          <p className="text-xs text-gray-500">Tổng feedback</p>
          <p className="text-xl font-bold text-gray-900">{stats.total}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus("new")}
          className={`text-left rounded-lg border p-3 transition-colors ${
            filterStatus === "new" ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200 hover:bg-gray-50"
          }`}
        >
          <p className="text-xs text-gray-500">Mới</p>
          <p className="text-xl font-bold text-blue-600">{stats.new}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus("in_progress")}
          className={`text-left rounded-lg border p-3 transition-colors ${
            filterStatus === "in_progress" ? "bg-amber-50 border-amber-300" : "bg-white border-gray-200 hover:bg-gray-50"
          }`}
        >
          <p className="text-xs text-gray-500">Đang xử lý</p>
          <p className="text-xl font-bold text-amber-600">{stats.inProgress}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus("done")}
          className={`text-left rounded-lg border p-3 transition-colors ${
            filterStatus === "done" ? "bg-emerald-50 border-emerald-300" : "bg-white border-gray-200 hover:bg-gray-50"
          }`}
        >
          <p className="text-xs text-gray-500">Hoàn thành</p>
          <p className="text-xl font-bold text-emerald-600">{stats.done}</p>
        </button>
      </div>

      <div className="mb-4 bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <div className="min-w-[260px] flex-1 relative">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Tìm theo user/email/nội dung/screen path..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | FeedbackItem["status"])}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="new">Mới tiếp nhận</option>
          <option value="in_progress">Đang xử lý</option>
          <option value="done">Hoàn thành</option>
        </select>
        <button
          onClick={fetchItems}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Tải lại
        </button>
      </div>
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-40 bg-gray-200 rounded" />
                  <div className="h-4 w-28 bg-gray-100 rounded" />
                  <div className="h-16 w-full bg-gray-100 rounded-lg" />
                </div>
                <div className="w-[200px] grid grid-cols-2 gap-2">
                  <div className="w-24 h-24 bg-gray-100 rounded-lg" />
                  <div className="w-24 h-24 bg-gray-100 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setDetailItem(item);
                setDetailReply(item.admin_reply || "");
                setDetailAdminImages(item.admin_image_urls || []);
              }}
            >
              <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.user_name || item.user_email}</p>
                      <p className="text-xs text-gray-500">{item.user_email}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${statusBadgeClass[item.status]}`}>
                      {statusOptions.find((s) => s.value === item.status)?.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString("vi-VN")}</p>
                  {item.screen_path && (
                    <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1 inline-block">
                      Screen: <span className="font-medium">{item.screen_path}</span>
                    </p>
                  )}
                  <p className="text-sm text-gray-900 leading-relaxed">{item.content}</p>
                  {item.suggestion && (
                    <div className="text-sm text-gray-600 border border-gray-200 bg-gray-50 rounded-lg p-2.5">
                      <span className="font-medium text-gray-800">Đề xuất: </span>
                      {item.suggestion}
                    </div>
                  )}
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <Stepper steps={getProgressSteps(item.status)} compact />
                  </div>
                </div>

                <div className="lg:w-auto lg:max-w-[340px] space-y-3" onClick={(e) => e.stopPropagation()}>
                  {Array.isArray(item.image_urls) && item.image_urls.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 w-[200px]">
                      {item.image_urls.slice(0, 3).map((url, idx) => (
                        <button
                          type="button"
                          key={url + idx}
                          onClick={() => {
                            setPreviewImages(item.image_urls || []);
                            setPreviewIndex(idx);
                          }}
                          className="w-24 h-24 rounded-lg overflow-hidden border border-gray-200"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="feedback" className="w-24 h-24 object-cover" />
                        </button>
                      ))}
                      {item.image_urls.length > 3 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewImages(item.image_urls || []);
                            setPreviewIndex(3);
                          }}
                          className="w-24 h-24 rounded-lg border border-gray-300 bg-gray-50 text-sm font-semibold text-gray-700"
                        >
                          +{item.image_urls.length - 3}
                        </button>
                      )}
                    </div>
                  )}
                  {(!item.image_urls || item.image_urls.length === 0) && (
                    <div className="h-24 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 flex items-center justify-center">
                      Không có ảnh đính kèm
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && <p className="text-sm text-gray-500">Không có feedback phù hợp bộ lọc.</p>}
        </div>
      )}

      {previewImages && previewImages.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl">
            <button
              type="button"
              onClick={() => setPreviewImages(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="bg-black rounded-xl overflow-hidden border border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImages[previewIndex]} alt={`feedback-${previewIndex + 1}`} className="w-full max-h-[80vh] object-contain" />
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewIndex((prev) => (prev - 1 + previewImages.length) % previewImages.length)}
                className="text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-white">
                {previewIndex + 1} / {previewImages.length}
              </span>
              <button
                type="button"
                onClick={() => setPreviewIndex((prev) => (prev + 1) % previewImages.length)}
                className="text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {detailItem && (
        <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-4" onClick={(e) => {
          if (e.target === e.currentTarget) setDetailItem(null);
        }}>
          <div className="w-full max-w-4xl bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{detailItem.user_name || detailItem.user_email}</p>
                <p className="text-xs text-gray-500">{detailItem.user_email}</p>
              </div>
              <button type="button" onClick={() => setDetailItem(null)} className="text-gray-500 hover:text-gray-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded-full border ${statusBadgeClass[detailItem.status]}`}>
                  {statusOptions.find((s) => s.value === detailItem.status)?.label}
                </span>
                <span className="text-xs text-gray-500">{new Date(detailItem.created_at).toLocaleString("vi-VN")}</span>
              </div>
              {detailItem.screen_path && (
                <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1 inline-block">
                  Screen: <span className="font-medium">{detailItem.screen_path}</span>
                </p>
              )}
              <p className="text-sm text-gray-900">{detailItem.content}</p>
              {detailItem.suggestion && (
                <div className="text-sm text-gray-600 border border-gray-200 bg-gray-50 rounded-lg p-2.5">
                  <span className="font-medium text-gray-800">Đề xuất: </span>
                  {detailItem.suggestion}
                </div>
              )}
              {Array.isArray(detailItem.image_urls) && detailItem.image_urls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {detailItem.image_urls.slice(0, 3).map((url, idx) => (
                    <div key={url + idx} className="relative rounded-lg overflow-hidden border border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewImages(detailItem.image_urls || []);
                          setPreviewIndex(idx);
                        }}
                        className="block w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="feedback" className="w-full aspect-square object-cover" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          toast.success("Đã copy link ảnh");
                        }}
                        className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white"
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                  {detailItem.image_urls.length > 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImages(detailItem.image_urls || []);
                        setPreviewIndex(3);
                      }}
                      className="w-full aspect-square rounded-lg border border-gray-300 bg-gray-50 text-sm font-semibold text-gray-700"
                    >
                      +{detailItem.image_urls.length - 3}
                    </button>
                  )}
                </div>
              )}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-900 mb-2">Xử lý phản hồi (Admin)</p>
                <div className="space-y-3">
                  <textarea
                    value={detailReply}
                    onChange={(e) => setDetailReply(e.target.value)}
                    placeholder="Nhập phản hồi gửi lại user..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    rows={3}
                  />

                  <label
                    className="border-2 border-dashed border-gray-300 rounded-xl p-4 block cursor-pointer hover:border-[#a1001f]/40 hover:bg-[#a1001f]/[0.02] transition-colors"
                    onPaste={(e) => {
                      const files = Array.from(e.clipboardData.items || [])
                        .filter((item) => item.type.startsWith("image/"))
                        .map((item) => item.getAsFile())
                        .filter((file): file is File => Boolean(file));
                      if (files.length > 0) {
                        e.preventDefault();
                        handleAdminFiles(files);
                      }
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        await handleAdminFiles(files);
                      }}
                    />
                    <div className="min-h-16 flex items-center justify-center text-center gap-2 text-sm text-gray-600">
                      <UploadCloud className="h-4 w-4" />
                      Upload hoặc dán ảnh phản hồi cho user (Ctrl+V)
                    </div>
                  </label>

                  {detailAdminImages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {detailAdminImages.slice(0, 3).map((url, idx) => (
                        <div key={url + idx} className="relative rounded-lg overflow-hidden border border-gray-200">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewImages(detailAdminImages);
                              setPreviewIndex(idx);
                            }}
                            className="block w-full"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="admin-reply" className="w-full aspect-square object-cover" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetailAdminImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white"
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                      {detailAdminImages.length > 3 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewImages(detailAdminImages);
                            setPreviewIndex(3);
                          }}
                          className="w-full aspect-square rounded-lg border border-emerald-300 bg-emerald-50 text-sm font-semibold text-emerald-700"
                        >
                          +{detailAdminImages.length - 3}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveFromModal()}
                      disabled={savingId === detailItem.id}
                      className="px-3 py-2 rounded-lg text-sm border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    >
                      Lưu phản hồi
                    </button>
                    <button
                      type="button"
                      onClick={() => saveFromModal("in_progress")}
                      disabled={savingId === detailItem.id || detailItem.status !== "new"}
                      className="px-3 py-2 rounded-lg text-sm border bg-[#a1001f] text-white border-[#a1001f] disabled:opacity-50"
                    >
                      Tiếp nhận xử lý
                    </button>
                    <button
                      type="button"
                      onClick={() => saveFromModal("done")}
                      disabled={savingId === detailItem.id || detailItem.status !== "in_progress" || !detailReply.trim()}
                      className="px-3 py-2 rounded-lg text-sm border bg-emerald-600 text-white border-emerald-600 disabled:opacity-50"
                    >
                      Hoàn thành
                    </button>
                  </div>
                  {detailItem.status === "in_progress" && !detailReply.trim() && (
                    <p className="text-xs text-amber-700">Cần nhập phản hồi trước khi hoàn thành.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
