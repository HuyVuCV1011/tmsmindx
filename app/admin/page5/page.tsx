"use client";

import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { SearchBar } from "@/components/SearchBar";
import { SkeletonList } from "@/components/skeletons";
import { Tabs } from "@/components/Tabs";
import { Lock, Trash2, Upload, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from 'react-hot-toast';

interface Video {
  id: number;
  title: string;
  video_link: string;
  start_date: string;
  duration_minutes: number;
  view_count: number;
  status: string;
  description: string;
  thumbnail_url: string;
  lesson_number: number;
  actual_view_count?: number;
  actual_viewers?: number;
}

export default function Page5() {
  const [tab, setTab] = useState<'assigned' | 'draft' | 'locked'>('assigned');
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [videoDurations, setVideoDurations] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: "danger" | "warning" | "info";
    requireTextConfirm?: boolean;
    icon?: "delete" | "lock" | "warning";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/training-videos');
      const data = await response.json();
      if (data.success) {
        setVideos(data.data);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLockVideo = (videoId: number, videoTitle: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Khóa video",
      message: `Bạn có chắc chắn muốn khóa video "${videoTitle}"?\n\nVideo sẽ chuyển sang trạng thái inactive và không thể truy cập bởi giáo viên.`,
      type: "warning",
      icon: "lock",
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        try {
          const response = await fetch('/api/training-videos', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: videoId, status: 'inactive' })
          });

          const data = await response.json();
          if (data.success) {
            toast.success('Khóa video thành công!');
            fetchVideos();
          } else {
            toast.error('Lỗi: ' + data.error);
          }
        } catch (error) {
          console.error('Error locking video:', error);
          toast.error('Lỗi khi khóa video!');
        }
      },
    });
  };

  const handleDeleteVideo = (videoId: number, videoTitle: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Xóa video vĩnh viễn",
      message: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN video "${videoTitle}"?\n\n⚠️ CẢNH BÁO: Hành động này KHÔNG THỂ HOÀN TÁC!\n\n- Video sẽ bị xóa khỏi database\n- Tất cả câu hỏi liên quan sẽ bị xóa\n- Dữ liệu xem của giáo viên sẽ bị xóa`,
      type: "danger",
      icon: "delete",
      requireTextConfirm: true,
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        try {
          const response = await fetch('/api/training-videos', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: videoId })
          });

          const data = await response.json();
          if (data.success) {
            toast.success('Xóa video thành công!');
            fetchVideos();
          } else {
            toast.error('Lỗi: ' + data.error);
          }
        } catch (error) {
          console.error('Error deleting video:', error);
          toast.error('Lỗi khi xóa video!');
        }
      },
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Step 1: Get signature from our API
      const signatureRes = await fetch("/api/cloudinary-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "mindx_videos" }),
      });

      if (!signatureRes.ok) {
        throw new Error("Không thể tạo signature cho upload");
      }

      const { signature, timestamp, cloudName, apiKey, folder } = await signatureRes.json();

      // Step 2: Upload directly to Cloudinary from client
      const formData = new FormData();
      formData.append("file", file);
      formData.append("signature", signature);
      formData.append("timestamp", timestamp.toString());
      formData.append("api_key", apiKey);
      formData.append("folder", folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error?.message || "Upload lên Cloudinary thất bại");
      }

      const uploadData = await uploadRes.json();

      // Step 3: Save video record to database
      const response = await fetch('/api/training-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name.replace(/\.[^/.]+$/, ""), // Use filename without extension as default title
          video_link: uploadData.secure_url,
          start_date: new Date().toISOString().split('T')[0],
          duration_minutes: Math.ceil(uploadData.duration / 60) || 30, // Convert seconds to minutes
          status: "draft"
        })
      });

      const videoData = await response.json();
      if (videoData.success) {
        toast.success('Upload video thành công!');
        // Redirect to setup page to fill in details
        setTimeout(() => {
          router.push(`/admin/video-setup?id=${videoData.data.id}`);
        }, 500);
      } else {
        toast.error("Lỗi khi lưu video: " + videoData.error);
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err instanceof Error ? err.message : "Lỗi khi upload video!");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredVideos = videos
    .filter((v) => {
      if (tab === 'assigned') return v.status === 'active';
      if (tab === 'draft') return v.status === 'draft';
      if (tab === 'locked') return v.status === 'inactive';
      return false;
    })
    .filter((v) => v.title.toLowerCase().includes(search.toLowerCase()));

  const tabCounts = {
    assigned: videos.filter(v => v.status === 'active').length,
    draft: videos.filter(v => v.status === 'draft').length,
    locked: videos.filter(v => v.status === 'inactive').length,
  };

  // Show skeleton while loading
  if (loading) {
    return (
      <PageContainer
        title="Quản lý đào tạo nâng cao"
        description="Quản lý video và bài học đào tạo"
      >
        <SkeletonList items={8} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Quản lý đào tạo nâng cao"
      description="Quản lý video và bài học đào tạo"
    >
      {/* Upload Button */}
      <div className="flex justify-end mb-4">
        <input
          type="file"
          accept="video/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          className="flex items-center gap-2 bg-[#a1001f] hover:bg-[#c41230] text-white px-4 py-2 rounded-lg font-semibold disabled:bg-gray-400 transition-colors"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Đang tải lên..." : "Upload video"}
        </button>
      </div>

      {/* Loading Overlay */}
      {uploading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-sm" padding="lg">
            <div className="text-center">
              <div className="animate-pulse space-y-3">
                <div className="h-12 w-12 bg-gray-300 rounded-full mx-auto"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4 mx-auto"></div>
              </div>
              <p className="text-sm text-gray-500 mt-4">Vui lòng đợi trong giây lát</p>
            </div>
          </Card>
        </div>
      )}

      <Card>
        {/* Tabs */}
        <Tabs
          tabs={[
            { id: 'assigned', label: 'Video đã giao', count: tabCounts.assigned },
            { id: 'draft', label: 'Video nháp', count: tabCounts.draft },
            { id: 'locked', label: 'Video đã khóa', count: tabCounts.locked },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as 'assigned' | 'draft' | 'locked')}
        />

        {/* Search */}
        <div className="my-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Tìm kiếm video..."
          />
        </div>

        {/* Videos Grid */}
        {filteredVideos.length === 0 ? (
          <EmptyState
            icon={Video}
            title={search ? "Không tìm thấy video" : "Chưa có video"}
            description={search ? "Thử tìm kiếm với từ khóa khác" : 'Nhấn "Upload video" để thêm video mới'}
            action={!search ? {
              label: "Upload video",
              onClick: handleUploadClick
            } : undefined}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
            {filteredVideos.map(video => (
              <div
                key={video.id}
                className="bg-white rounded-lg border border-gray-200 p-2 hover:border-gray-300 hover:shadow-sm transition-all group relative"
              >
                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  {/* Delete Button */}
                  {video.status !== 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVideo(video.id, video.title);
                      }}
                      className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                      title="Xóa video"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  
                  {/* Lock Button */}
                  {video.status !== 'inactive' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLockVideo(video.id, video.title);
                      }}
                      className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-orange-600"
                      title="Khóa video"
                    >
                      <Lock className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/video-detail?id=${video.id}`)}
                >
                  {/* Thumbnail */}
                  <div className="bg-gray-100 rounded h-24 mb-2 flex items-center justify-center overflow-hidden">
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <Video className="h-8 w-8 text-gray-400" />
                    )}
                    {video.video_link && (
                      <video
                        src={video.video_link}
                        preload="metadata"
                        className="hidden"
                        onLoadedMetadata={(event) => {
                          const duration = event.currentTarget.duration;
                          if (Number.isFinite(duration) && duration > 0) {
                            const minutes = Math.max(1, Math.round(duration / 60));
                            setVideoDurations((prev) => {
                              if (prev[video.id] === minutes) return prev;
                              return { ...prev, [video.id]: minutes };
                            });
                          }
                        }}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-1 flex-wrap">
                    {video.lesson_number && (
                      <span className="font-semibold">L{video.lesson_number}</span>
                    )}
                    {video.lesson_number && <span>•</span>}
                    <span>{videoDurations[video.id] ?? video.duration_minutes ?? 0}p</span>
                    <span>•</span>
                    <span>👁️ {Math.max(video.view_count || 0, video.actual_view_count || 0, video.actual_viewers || 0)}</span>
                  </div>

                  <div className="font-semibold text-xs mb-1 line-clamp-2">{video.title}</div>

                  <span className={`inline-block text-xs px-2 py-0.5 rounded ${video.status === 'active' ? 'bg-green-100 text-green-800' :
                      video.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                    }`}>
                    {video.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        requireTextConfirm={confirmDialog.requireTextConfirm}
        icon={confirmDialog.icon}
      />
    </PageContainer>
  );
}

