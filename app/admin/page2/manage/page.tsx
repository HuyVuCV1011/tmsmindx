"use client";

import { PageContainer } from "@/components/PageContainer";
import RichTextEditor from "@/components/RichTextEditor";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { BookOpenText, FilePlus2, FolderTree, GripVertical, Save, Send, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface K12DocRow {
  id: number;
  slug: string;
  title: string;
  relativePath: string;
  content: string;
  type?: "section" | "article";
  sectionId?: number | null;
  parentId?: number | null;
  topic?: string;
  excerpt?: string;
  coverImageUrl?: string;
  status: "draft" | "published";
  sortOrder: number;
  updatedAt?: string;
}

interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  data?: K12DocRow | K12DocRow[];
}

interface FormState {
  originalSlug: string;
  title: string;
  slug: string;
  content: string;
  topic: string;
  excerpt: string;
  coverImageUrl: string;
  status: "draft" | "published";
}

const EMPTY_FORM: FormState = {
  originalSlug: "",
  title: "",
  slug: "",
  content: "",
  topic: "",
  excerpt: "",
  coverImageUrl: "",
  status: "draft",
};

function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function normalizeDocRow(input: Partial<K12DocRow>): K12DocRow {
  return {
    id: Number(input.id) || 0,
    slug: input.slug || "",
    title: input.title || "",
    relativePath: input.relativePath || "",
    content: input.content || "",
    type: input.type === "section" ? "section" : "article",
    sectionId: input.sectionId ?? null,
    parentId: input.parentId ?? null,
    topic: input.topic || "",
    excerpt: input.excerpt || "",
    coverImageUrl: input.coverImageUrl || "",
    status: input.status === "published" ? "published" : "draft",
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
    updatedAt: input.updatedAt,
  };
}

export default function ManageK12DocsPage() {
  const { user, isLoading } = useAuth();
  const [documents, setDocuments] = useState<K12DocRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [draggingSlug, setDraggingSlug] = useState("");
  const [dropTargetSlug, setDropTargetSlug] = useState<string | null>(null);
  const [isRootDropActive, setIsRootDropActive] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isSuperAdmin = user?.role === "super_admin";

  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.title.localeCompare(b.title, "vi");
    });
  }, [documents]);

  const docsBySlug = useMemo(() => {
    return new Map(sortedDocuments.map((doc) => [doc.slug, doc]));
  }, [sortedDocuments]);

  const docsById = useMemo(() => {
    return new Map(sortedDocuments.map((doc) => [doc.id, doc]));
  }, [sortedDocuments]);

  const childrenByParentId = useMemo(() => {
    const map = new Map<number | null, K12DocRow[]>();

    for (const doc of sortedDocuments) {
      const key = doc.parentId ?? null;
      const list = map.get(key) || [];
      list.push(doc);
      map.set(key, list);
    }

    return map;
  }, [sortedDocuments]);

  const rootDocs = useMemo(() => childrenByParentId.get(null) || [], [childrenByParentId]);

  const rootSections = useMemo(
    () => rootDocs.filter((doc) => doc.type === "section"),
    [rootDocs]
  );

  const rootArticles = useMemo(
    () => rootDocs.filter((doc) => doc.type !== "section"),
    [rootDocs]
  );

  const selectedDocument = useMemo(
    () => sortedDocuments.find((doc) => doc.slug === selectedSlug),
    [sortedDocuments, selectedSlug]
  );

  const callApi = async (
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: Record<string, unknown>,
    includeDraft = true
  ): Promise<ApiResponse> => {
    const email = user?.email || "";
    const query = new URLSearchParams();
    if (includeDraft) query.set("includeDraft", "1");
    if (email) query.set("email", email);

    const response = await fetch(`/api/k12-docs?${query.toString()}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-user-email": email,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return (await response.json()) as ApiResponse;
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSelectedSlug("");
  };

  const applyDocumentToForm = (doc: K12DocRow) => {
    setSelectedSlug(doc.slug);
    setForm({
      originalSlug: doc.slug,
      title: doc.title,
      slug: doc.slug,
      content: doc.content,
      topic: doc.topic || "",
      excerpt: doc.excerpt || "",
      coverImageUrl: doc.coverImageUrl || "",
      status: doc.status,
    });
  };

  const loadDocuments = async () => {
    if (!user?.email || !isSuperAdmin) return;

    setIsLoadingDocs(true);
    const result = await callApi("GET", undefined, true);

    if (!result.success || !Array.isArray(result.data)) {
      setNotice({ type: "error", text: result.error || "Không thể tải danh sách tài liệu" });
      setIsLoadingDocs(false);
      return;
    }

    const rows = result.data.map((row) => normalizeDocRow(row));
    setDocuments(rows);

    if (selectedSlug) {
      const selected = rows.find((doc) => doc.slug === selectedSlug);
      if (selected) {
        applyDocumentToForm(selected);
      }
    }

    setIsLoadingDocs(false);
  };

  const isDescendant = (candidateParentId: number | null, childId: number) => {
    let currentId = candidateParentId;
    const visited = new Set<number>();

    while (currentId != null) {
      if (currentId === childId) return true;
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const currentDoc = docsById.get(currentId);
      currentId = currentDoc?.parentId ?? null;
    }

    return false;
  };

  const moveDocumentToParent = async (sourceSlug: string, targetSlug: string | null) => {
    const sourceDoc = docsBySlug.get(sourceSlug);
    if (!sourceDoc) return;

    const targetDoc = targetSlug ? docsBySlug.get(targetSlug) || null : null;
    const currentParentSlug = sourceDoc.parentId ? docsById.get(sourceDoc.parentId)?.slug || null : null;

    if (targetSlug === sourceSlug) return;
    if (currentParentSlug === targetSlug) return;

    if (targetDoc && isDescendant(targetDoc.id, sourceDoc.id)) {
      setNotice({ type: "error", text: "Không thể kéo thả vào chính bài con của nó." });
      return;
    }

    const siblingDocs = sortedDocuments.filter((doc) => {
      if (doc.slug === sourceDoc.slug) return false;
      if (!targetDoc) return doc.parentId == null;
      return doc.parentId === targetDoc.id;
    });

    const nextSortOrder = siblingDocs.length > 0
      ? Math.max(...siblingDocs.map((doc) => doc.sortOrder)) + 1
      : 0;

    setIsBusy(true);
    const result = await callApi("PATCH", {
      originalSlug: sourceDoc.slug,
      parentSlug: targetDoc?.slug,
      sortOrder: nextSortOrder,
    }, true);
    setIsBusy(false);

    if (!result.success) {
      setNotice({ type: "error", text: result.error || "Không thể cập nhật vị trí tài liệu" });
      return;
    }

    setNotice({ type: "success", text: "Đã cập nhật cấu trúc mục lục" });
    await loadDocuments();
  };

  useEffect(() => {
    if (isLoading) return;
    if (!isSuperAdmin || !user?.email) {
      setIsLoadingDocs(false);
      return;
    }

    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isSuperAdmin, user?.email]);

  useEffect(() => {
    if (form.originalSlug) return;

    const generatedSlug = normalizeSlug(form.title);
    if (generatedSlug === form.slug) return;

    setForm((prev) => ({ ...prev, slug: generatedSlug }));
  }, [form.title, form.slug, form.originalSlug]);

  const saveDocument = async (nextStatus: "draft" | "published" | "keep") => {
    if (!user?.email) return;

    const title = form.title.trim();
    const generatedSlug = form.originalSlug || normalizeSlug(form.slug || title);

    if (!title || !generatedSlug) {
      setNotice({ type: "error", text: "Vui lòng nhập tiêu đề bài viết" });
      return;
    }

    const resolvedStatus =
      nextStatus === "keep"
        ? (form.originalSlug ? form.status : "draft")
        : nextStatus;

    const payload = {
      originalSlug: form.originalSlug || undefined,
      slug: generatedSlug,
      title,
      content: form.content,
      topic: form.topic.trim(),
      excerpt: form.excerpt.trim(),
      coverImageUrl: form.coverImageUrl.trim(),
      sortOrder: selectedDocument?.sortOrder ?? 0,
      status: resolvedStatus,
    };

    setIsBusy(true);
    const method = form.originalSlug ? "PATCH" : "POST";
    const result = await callApi(method, payload, true);
    setIsBusy(false);

    if (!result.success || !result.data || Array.isArray(result.data)) {
      setNotice({ type: "error", text: result.error || "Không thể lưu tài liệu" });
      return;
    }

    const saved = result.data;
    setNotice({ type: "success", text: result.message || "Lưu thành công" });
    setSelectedSlug(saved.slug);
    setForm({
      originalSlug: saved.slug,
      title: saved.title,
      slug: saved.slug,
      content: saved.content,
      topic: saved.topic || "",
      excerpt: saved.excerpt || "",
      coverImageUrl: saved.coverImageUrl || "",
      status: saved.status,
    });

    await loadDocuments();
  };

  const deleteDocument = async () => {
    if (!form.originalSlug || !user?.email) return;
    const confirmed = window.confirm(`Bạn có chắc muốn xóa tài liệu \"${form.title}\"?`);
    if (!confirmed) return;

    setIsBusy(true);
    const result = await callApi("DELETE", { slug: form.originalSlug }, true);
    setIsBusy(false);

    if (!result.success) {
      setNotice({ type: "error", text: result.error || "Xóa tài liệu thất bại" });
      return;
    }

    setNotice({ type: "success", text: result.message || "Đã xóa tài liệu" });
    resetForm();
    await loadDocuments();
  };

  const handleDropToNode = async (targetSlug: string) => {
    if (!draggingSlug) return;

    setDropTargetSlug(null);
    setIsRootDropActive(false);
    await moveDocumentToParent(draggingSlug, targetSlug);
    setDraggingSlug("");
  };

  const handleDropToRoot = async () => {
    if (!draggingSlug) return;

    setDropTargetSlug(null);
    setIsRootDropActive(false);
    await moveDocumentToParent(draggingSlug, null);
    setDraggingSlug("");
  };

  const renderDocTree = (nodes: K12DocRow[], depth = 0): React.ReactNode => {
    return nodes.map((doc) => {
      const children = childrenByParentId.get(doc.id) || [];
      const isActive = selectedDocument?.slug === doc.slug;
      const isDragging = draggingSlug === doc.slug;
      const isDropTarget = dropTargetSlug === doc.slug;

      return (
        <div key={doc.slug} className="space-y-1">
          <div
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", doc.slug);
              setDraggingSlug(doc.slug);
            }}
            onDragEnd={() => {
              setDraggingSlug("");
              setDropTargetSlug(null);
              setIsRootDropActive(false);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggingSlug && draggingSlug !== doc.slug) {
                setDropTargetSlug(doc.slug);
              }
            }}
            onDrop={async (event) => {
              event.preventDefault();
              await handleDropToNode(doc.slug);
            }}
            className={cn(
              "group flex items-center gap-2 rounded-md border px-2 py-2 transition-colors",
              isActive ? "border-[#a1001f] bg-[#a1001f]/5" : "border-gray-200 bg-white hover:bg-gray-50",
              isDragging ? "opacity-40" : "opacity-100",
              isDropTarget ? "ring-2 ring-[#a1001f]" : "ring-0"
            )}
            style={{ marginLeft: `${depth * 16}px` }}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-gray-400" />
            <button
              onClick={() => applyDocumentToForm(doc)}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
            >
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-medium text-gray-800">{doc.title}</p>
                <p className="line-clamp-1 text-xs text-gray-500">/{doc.slug}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  doc.type === "section" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                )}
              >
                {doc.type === "section" ? "Mục" : "Bài"}
              </span>
            </button>
          </div>
          {children.length > 0 && <div className="space-y-1">{renderDocTree(children, depth + 1)}</div>}
        </div>
      );
    });
  };

  const renderSectionCard = (section: K12DocRow) => {
    const children = childrenByParentId.get(section.id) || [];
    const isActive = selectedDocument?.slug === section.slug;
    const isDragging = draggingSlug === section.slug;
    const isDropTarget = dropTargetSlug === section.slug;

    return (
      <div key={section.slug} className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", section.slug);
            setDraggingSlug(section.slug);
          }}
          onDragEnd={() => {
            setDraggingSlug("");
            setDropTargetSlug(null);
            setIsRootDropActive(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggingSlug && draggingSlug !== section.slug) {
              setDropTargetSlug(section.slug);
            }
          }}
          onDrop={async (event) => {
            event.preventDefault();
            await handleDropToNode(section.slug);
          }}
          className={cn(
            "flex cursor-move items-center justify-between gap-3 rounded-t-xl border-b px-3 py-2 transition-colors",
            isActive ? "border-[#a1001f] bg-[#a1001f]/5" : "border-gray-200 bg-[#f8fafc] hover:bg-gray-50",
            isDragging ? "opacity-40" : "opacity-100",
            isDropTarget ? "ring-2 ring-inset ring-[#a1001f]" : "ring-0"
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 shrink-0 text-[#a1001f]" />
              <p className="truncate text-sm font-semibold text-gray-800">{section.title}</p>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500">Submenu cha. Thả bài viết vào đây để gắn vào mục này.</p>
          </div>
          <span className="rounded-full bg-[#a1001f]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a1001f]">
            submenu
          </span>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (draggingSlug) {
              setDropTargetSlug(section.slug);
            }
          }}
          onDrop={async (event) => {
            event.preventDefault();
            await handleDropToNode(section.slug);
          }}
          className="space-y-1 p-3"
        >
          {children.length > 0 ? (
            renderDocTree(children, 0)
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500">
              Kéo bài viết vào submenu này để tạo mục con.
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isLoading && !isSuperAdmin) {
    return (
      <PageContainer title="Quản Lý Nội Dung K12 Teaching">
        <div className="flex min-h-80 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <div className="text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-gray-400" />
            <h2 className="mt-3 text-lg font-semibold text-gray-800">Không có quyền truy cập</h2>
            <p className="mt-1 text-sm text-gray-500">Chỉ Super Admin mới có thể quản lý tài liệu K12.</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Quản Lý Bài Viết Quy Trình, Quy Định K12 Teaching"
      description="Danh sách tài liệu hoạt động như mục lục; kéo thả bài viết vào mục cha để tổ chức cấu trúc nhanh mà không cần nhập slug/mục lớn/thứ tự."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-150px)] lg:overflow-y-auto">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
              <FolderTree className="h-4 w-4 text-[#a1001f]" />
              Mục Lục Tài Liệu
            </h3>
            <button
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              Tạo Mới
            </button>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (draggingSlug) {
                setIsRootDropActive(true);
                setDropTargetSlug(null);
              }
            }}
            onDragLeave={() => setIsRootDropActive(false)}
            onDrop={async (event) => {
              event.preventDefault();
              await handleDropToRoot();
            }}
            className={cn(
              "mb-3 rounded-md border border-dashed px-3 py-2 text-xs",
              isRootDropActive ? "border-[#a1001f] bg-[#a1001f]/5 text-[#a1001f]" : "border-gray-300 text-gray-500"
            )}
          >
            Thả vào đây để đưa tài liệu ra cấp gốc
          </div>

          {isLoadingDocs ? (
            <p className="text-sm text-gray-500">Đang tải tài liệu...</p>
          ) : rootSections.length === 0 && rootArticles.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa có tài liệu nào.</p>
          ) : (
            <div className="space-y-3">
              {rootSections.length > 0 && (
                <div className="space-y-2">
                  {rootSections.map((section) => renderSectionCard(section))}
                </div>
              )}

              {rootArticles.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <span>Bài viết ngoài submenu</span>
                    <span>{rootArticles.length}</span>
                  </div>
                  <div className="space-y-1">{renderDocTree(rootArticles)}</div>
                </div>
              )}
            </div>
          )}
        </aside>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="inline-flex items-center gap-2 text-base font-semibold text-gray-800">
              <BookOpenText className="h-4 w-4 text-[#a1001f]" />
              {form.originalSlug ? "Chỉnh Sửa Bài Viết" : "Tạo Bài Viết Mới"}
            </h3>
            <div className="flex items-center gap-2">
              {form.originalSlug && (
                <span
                  className={cn(
                    "rounded px-2 py-1 text-xs font-semibold uppercase",
                    form.status === "published"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  )}
                >
                  {form.status === "published" ? "Đang Public" : "Đang Draft"}
                </span>
              )}
              <Link href="/admin/page2" className="text-sm font-medium text-[#a1001f] hover:underline">
                Xem Trang K12
              </Link>
            </div>
          </div>

          {notice && (
            <div
              className={cn(
                "mb-3 rounded-lg border px-3 py-2 text-sm",
                notice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              )}
            >
              {notice.text}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Chủ đề</span>
              <input
                value={form.topic}
                onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-[#a1001f]"
                placeholder="Ví dụ: Quy trình vận hành, Lương thưởng, Đào tạo..."
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Tiêu đề</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-[#a1001f]"
                placeholder="Ví dụ: Quy Trình Đào Tạo"
              />
            </label>

            <label className="text-sm md:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">Đường dẫn slug (tự sinh)</span>
              <input
                value={form.originalSlug || form.slug}
                readOnly
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600"
              />
              {selectedDocument && (
                <p className="mt-1 text-xs text-gray-500">Vị trí hiện tại: {selectedDocument.relativePath}</p>
              )}
            </label>
          </div>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Ảnh đại diện (URL)</span>
            <input
              value={form.coverImageUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, coverImageUrl: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-[#a1001f]"
              placeholder="https://..."
            />
          </label>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Mô tả ngắn</span>
            <textarea
              value={form.excerpt}
              onChange={(event) => setForm((prev) => ({ ...prev, excerpt: event.target.value }))}
              className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#a1001f]"
              placeholder="Tóm tắt nội dung bài viết..."
            />
          </label>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Nội dung bài viết</span>
            <RichTextEditor
              content={form.content}
              onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
              minHeight="min-h-[420px]"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => saveDocument("draft")}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Lưu Nháp
            </button>

            <button
              onClick={() => saveDocument("published")}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-md bg-[#a1001f] px-3 py-2 text-sm font-medium text-white hover:bg-[#870018] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              Xuất Bản
            </button>

            {form.originalSlug && (
              <button
                onClick={() => saveDocument("keep")}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-md border border-[#a1001f]/30 bg-[#a1001f]/5 px-3 py-2 text-sm font-medium text-[#a1001f] hover:bg-[#a1001f]/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                Giữ Trạng Thái Hiện Tại
              </button>
            )}

            {form.originalSlug && (
              <button
                onClick={deleteDocument}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </button>
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
