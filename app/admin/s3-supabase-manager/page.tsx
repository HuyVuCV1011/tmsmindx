"use client";

import { PageContainer } from "@/components/PageContainer";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import { File, Filter, Image as ImageIcon, Loader2, RefreshCw, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/app-toast";

type ResourceType = "image" | "video" | "file";
type ResourceFilter = "all" | ResourceType;

interface StorageItem {
  id: string;
  name: string;
  bucket: string;
  kind: ResourceType;
  size: number;
  updatedAt: string | null;
  createdAt: string | null;
  previewUrl?: string | null;
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function S3SupabaseManagerPage() {
  const { user, token } = useAuth();
  const [items, setItems] = useState<StorageItem[]>([]);
  const [buckets, setBuckets] = useState<Array<{ name: string; public: boolean }>>([]);
  const [bucket, setBucket] = useState("");
  const [loading, setLoading] = useState(true);
  const [resourceType, setResourceType] = useState<ResourceFilter>("all");
  const [prefix, setPrefix] = useState("");
  const [appliedPrefix, setAppliedPrefix] = useState("");
  const [configured, setConfigured] = useState(true);
  const [configMessage, setConfigMessage] = useState("");

  const fetchItems = async () => {
    if (!user?.email) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        kind: resourceType,
      });
      if (bucket) params.set("bucket", bucket);
      if (appliedPrefix.trim()) {
        params.set("prefix", appliedPrefix);
      }

      const response = await fetch(`/api/admin/s3-supabase-manager?${params.toString()}`, {
        cache: "no-store",
        headers: authHeaders(token),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Không thể tải thư viện");
      }
      setConfigured(Boolean(data.configured));
      setConfigMessage(data.message || "");
      setBuckets(data.buckets || []);
      setItems(data.items || []);
    } catch (error: any) {
      toast.error(error.message || "Lỗi tải thư viện");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();

  }, [resourceType, appliedPrefix, bucket, user?.email]);

  const stats = useMemo(() => {
    const images = items.filter((item) => item.kind === "image").length;
    const videos = items.filter((item) => item.kind === "video").length;
    const files = items.filter((item) => item.kind === "file").length;
    const totalBytes = items.reduce((sum, item) => sum + Number(item.size || 0), 0);
    return { images, videos, files, total: items.length, totalBytes };
  }, [items]);

  return (
    <PageContainer
      title="S3 Supabase Manager"
      description="Thư viện Supabase Storage: phân loại hình ảnh, video và file"
    >
      {!configured && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
          Chưa cấu hình Supabase Storage. {configMessage}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Tổng tài nguyên</p>
          <p className="text-xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Hình ảnh</p>
          <p className="text-xl font-bold text-blue-600">{stats.images}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Video</p>
          <p className="text-xl font-bold text-purple-600">{stats.videos}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">File khác</p>
          <p className="text-xl font-bold text-amber-600">{stats.files}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 md:col-span-2">
          <p className="text-xs text-gray-500">Bucket</p>
          <p className="text-sm font-semibold text-gray-900 truncate">{bucket || "Tất cả buckets"}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Dung lượng</p>
          <p className="text-xl font-bold text-emerald-600">{formatBytes(stats.totalBytes)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Bucket</label>
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Tất cả buckets</option>
              {buckets.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-600 mb-1 block">Prefix/folder</label>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Ví dụ: mindx_"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Phân loại</label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value as ResourceFilter)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">Tất cả</option>
              <option value="image">Hình ảnh</option>
              <option value="video">Video</option>
              <option value="file">File khác</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => setAppliedPrefix(prefix)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#a1001f] text-white rounded-lg text-sm hover:bg-[#7e0018]"
            >
              <Filter className="w-4 h-4" />
              Áp dụng
            </button>
            <button
              onClick={fetchItems}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="h-44 bg-gray-100 flex items-center justify-center">
                {item.kind === "image" ? (
                  item.previewUrl ? (

                    <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-blue-500" />
                  )
                ) : item.kind === "video" ? (
                  item.previewUrl ? (
                    <video src={item.previewUrl} className="w-full h-full object-cover" controls preload="metadata" />
                  ) : (
                    <Video className="w-10 h-10 text-purple-500" />
                  )
                ) : (
                  <div className="text-gray-500 text-sm inline-flex items-center gap-2">
                    <File className="w-4 h-4" />
                    FILE
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2">
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 inline-flex items-center gap-1">
                  {item.kind === "image" ? (
                    <ImageIcon className="w-3 h-3" />
                  ) : item.kind === "video" ? (
                    <Video className="w-3 h-3" />
                  ) : (
                    <File className="w-3 h-3" />
                  )}
                  {item.kind}
                </span>
                <p className="text-sm font-semibold text-gray-900 break-all line-clamp-2">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.bucket} - {formatBytes(item.size)} -{" "}
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleString("vi-VN") : "--"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
