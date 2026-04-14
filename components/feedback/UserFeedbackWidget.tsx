"use client";

import { useAuth } from "@/lib/auth-context";
import { StepItem, Stepper } from "@/components/ui/stepper";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, ImagePlus, Loader2, MessageCircleMore, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";

type FeedbackItem = {
  id: number;
  screen_path?: string | null;
  content: string;
  suggestion: string | null;
  image_urls: string[] | null;
  admin_image_urls?: string[] | null;
  status: "new" | "in_progress" | "done";
  admin_note: string | null;
  admin_reply?: string | null;
  created_at: string;
  updated_at: string;
};

function LocalFileImageThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={file.name} className="h-24 w-24 object-cover" />
      ) : (
        <div className="h-24 w-24 animate-pulse bg-gray-200" aria-hidden />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white hover:bg-red-600"
        aria-label="Xóa ảnh"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const statusLabel: Record<FeedbackItem["status"], string> = {
  new: "Mới tiếp nhận",
  in_progress: "Đang xử lý",
  done: "Hoàn thành",
};

const statusClass: Record<FeedbackItem["status"], string> = {
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
};

const getProgressSteps = (status: FeedbackItem["status"]): StepItem[] => {
  const currentIndex = status === "new" ? 0 : status === "in_progress" ? 1 : 2;
  return [
    {
      id: "new",
      label: "Step 1",
      description: "Mới tiếp nhận",
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

export default function UserFeedbackWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"create" | "manage">("create");
  const [content, setContent] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const canSubmit = useMemo(() => content.trim().length > 0 && !submitting, [content, submitting]);

  useEffect(() => {
    if (!previewImages?.length) return;
    const urls = previewImages.slice();
    return () => {
      for (const u of urls) {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u);
      }
    };
  }, [previewImages]);

  useEffect(() => {
    if (!open && !previewImages) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (previewImages) {
          setPreviewImages(null);
          return;
        }
        if (open) setOpen(false);
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
  }, [open, previewImages]);

  const loadMyFeedback = async () => {
    if (!user?.email) return;
    try {
      setLoadingList(true);
      const params = new URLSearchParams({ scope: "mine", requestEmail: user.email });
      const response = await fetch(`/api/feedback?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Không thể tải danh sách feedback");
      }
      setItems(data.items || []);
    } catch (error: any) {
      toast.error(error.message || "Lỗi tải feedback");
    } finally {
      setLoadingList(false);
    }
  };

  const uploadImages = async () => {
    if (images.length === 0) return [] as string[];
    const uploaded = await Promise.all(
      images.map(async (image) => {
      const formData = new FormData();
      formData.append("file", image);
      const response = await fetch("/api/feedback/upload-image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Không thể upload ảnh");
      }
      return data.storagePath || data.url;
      })
    );
    return uploaded.filter(Boolean);
  };

  const handleSubmit = async () => {
    if (!user?.email || !canSubmit) return;
    try {
      setSubmitting(true);
      const imageUrls = await uploadImages();
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestEmail: user.email,
          userName: user.displayName,
          screenPath: pathname,
          content: content.trim(),
          suggestion: suggestion.trim(),
          imageUrls,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Không thể gửi feedback");
      }

      setContent("");
      setSuggestion("");
      setImages([]);
      toast.success("Đã gửi feedback");
      setTab("manage");
      await loadMyFeedback();
    } catch (error: any) {
      toast.error(error.message || "Lỗi gửi feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={async () => {
            setOpen(true);
            if (tab === "manage") await loadMyFeedback();
          }}
          className="h-14 w-14 rounded-full bg-[#a1001f] text-white shadow-lg hover:bg-[#870019] transition-colors flex items-center justify-center"
          title="Feedback"
        >
          <MessageCircleMore className="h-6 w-6" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}>
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Feedback</h3>
                <p className="text-xs text-gray-500 mt-0.5">Màn hình hiện tại: <span className="font-medium">{pathname}</span></p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-800">Đóng</button>
            </div>

            <div role="tablist" className="mx-4 my-3 flex bg-slate-100 p-1 rounded-lg gap-1">
              <button
                role="tab"
                aria-selected={tab === "create"}
                onClick={() => setTab("create")}
                className={`inline-flex items-center gap-2 font-medium transition-all duration-200 cursor-pointer focus:outline-none px-3 py-1.5 rounded-md text-sm ${
                  tab === "create" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tab 1: Gửi feedback
              </button>
              <button
                role="tab"
                aria-selected={tab === "manage"}
                onClick={async () => {
                  setTab("manage");
                  await loadMyFeedback();
                }}
                className={`inline-flex items-center gap-2 font-medium transition-all duration-200 cursor-pointer focus:outline-none px-3 py-1.5 rounded-md text-sm ${
                  tab === "manage" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tab 2: Quản lý feedback
              </button>
            </div>

            {tab === "create" ? (
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Nội dung</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    placeholder="Mô tả vấn đề hoặc góp ý của bạn..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Đề xuất</label>
                  <textarea
                    value={suggestion}
                    onChange={(e) => setSuggestion(e.target.value)}
                    rows={3}
                    placeholder="Bạn muốn cải thiện như thế nào?"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Ảnh minh họa</label>
                  <label className="border-2 border-dashed border-gray-300 rounded-xl p-4 block cursor-pointer hover:border-[#a1001f]/40 hover:bg-[#a1001f]/[0.02] transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => setImages(Array.from(e.target.files || []))}
                    />
                    <div
                      className="min-h-16 flex items-center justify-center text-center gap-2 text-sm text-gray-600"
                      onPaste={(e) => {
                        const fileItems = Array.from(e.clipboardData.items || [])
                          .filter((item) => item.type.startsWith("image/"))
                          .map((item) => item.getAsFile())
                          .filter((file): file is File => Boolean(file));
                        if (fileItems.length > 0) {
                          e.preventDefault();
                          setImages((prev) => [...prev, ...fileItems]);
                        }
                      }}
                    >
                      <UploadCloud className="h-4 w-4" />
                      Chọn ảnh, kéo-thả, hoặc dán ảnh (Ctrl+V)
                    </div>
                  </label>
                  {images.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 overflow-x-auto">
                      {images.slice(0, 3).map((file, idx) => (
                        <LocalFileImageThumb
                          key={`${file.name}-${file.size}-${file.lastModified}-${idx}`}
                          file={file}
                          onRemove={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                        />
                      ))}
                      {images.length > 3 && (
                        <button
                          type="button"
                          onClick={() => {
                            const urls = images.map((file) => URL.createObjectURL(file));
                            setPreviewImages(urls);
                            setPreviewIndex(3);
                          }}
                          className="w-24 h-24 shrink-0 rounded-lg border border-gray-300 bg-gray-50 text-sm font-semibold text-gray-700"
                        >
                          +{images.length - 3}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#a1001f] text-white text-sm font-medium hover:bg-[#870019] disabled:opacity-60"
                >
                  {submitting ? "Đang gửi..." : "Gửi feedback"}
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {loadingList ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-3.5 space-y-2.5 animate-pulse">
                        <div className="flex items-center justify-between">
                          <div className="h-5 w-24 bg-gray-200 rounded-full" />
                          <div className="h-4 w-28 bg-gray-100 rounded" />
                        </div>
                        <div className="h-4 w-3/4 bg-gray-100 rounded" />
                        <div className="h-16 w-full bg-gray-100 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-sm text-gray-500">Bạn chưa có feedback nào.</p>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusClass[item.status]}`}>
                          {statusLabel[item.status]}
                        </span>
                        <span className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString("vi-VN")}</span>
                      </div>
                      {item.screen_path && (
                        <p className="text-xs text-gray-500">Màn hình: <span className="font-medium">{item.screen_path}</span></p>
                      )}
                      <p className="text-sm text-gray-900">{item.content}</p>
                      {item.suggestion && <p className="text-sm text-gray-600">Đề xuất: {item.suggestion}</p>}
                      {Array.isArray(item.image_urls) && item.image_urls.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto">
                          {item.image_urls.slice(0, 3).map((url, idx) => (
                            <button
                              key={url + idx}
                              type="button"
                              onClick={() => {
                                setPreviewImages(item.image_urls || []);
                                setPreviewIndex(idx);
                              }}
                              className="w-20 h-20 shrink-0 border border-gray-200 rounded-lg overflow-hidden"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="feedback" className="w-20 h-20 object-cover" />
                            </button>
                          ))}
                          {item.image_urls.length > 3 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewImages(item.image_urls || []);
                                setPreviewIndex(3);
                              }}
                              className="w-20 h-20 shrink-0 rounded-lg border border-gray-300 bg-gray-50 text-xs font-semibold text-gray-700"
                            >
                              +{item.image_urls.length - 3}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                          <Clock3 className="h-3.5 w-3.5" />
                          Tiến trình xử lý
                        </div>
                        <Stepper steps={getProgressSteps(item.status)} compact />
                      </div>
                      {item.admin_note && (
                        <div className="text-xs rounded bg-gray-50 border border-gray-200 p-2">
                          <span className="font-medium">Admin ghi chú:</span> {item.admin_note}
                        </div>
                      )}
                      {item.admin_reply && (
                        <div className="text-xs rounded bg-emerald-50 border border-emerald-200 p-2">
                          <span className="font-medium text-emerald-800">Phản hồi từ admin:</span> {item.admin_reply}
                        </div>
                      )}
                      {Array.isArray(item.admin_image_urls) && item.admin_image_urls.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto">
                          {item.admin_image_urls.slice(0, 3).map((url, idx) => (
                            <button
                              key={url + idx}
                              type="button"
                              onClick={() => {
                                setPreviewImages(item.admin_image_urls || []);
                                setPreviewIndex(idx);
                              }}
                              className="w-20 h-20 shrink-0 border border-emerald-200 rounded-lg overflow-hidden"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="admin-reply" className="w-20 h-20 object-cover" />
                            </button>
                          ))}
                          {item.admin_image_urls.length > 3 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewImages(item.admin_image_urls || []);
                                setPreviewIndex(3);
                              }}
                              className="w-20 h-20 shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700"
                            >
                              +{item.admin_image_urls.length - 3}
                            </button>
                          )}
                        </div>
                      )}
                      {item.status === "done" && (
                        <div className="text-xs text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Feedback đã xử lý xong
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {previewImages && previewImages.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl">
            <button
              type="button"
              onClick={() => setPreviewImages(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="bg-black rounded-xl overflow-hidden border border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImages[previewIndex]} alt={`feedback-${previewIndex + 1}`} className="w-full max-h-[78vh] object-contain" />
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
    </>
  );
}
