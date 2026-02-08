"use client";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { SearchBar } from "@/components/SearchBar";
import { SkeletonList } from "@/components/skeletons";
import { Tabs } from "@/components/Tabs";
import { Lock, Upload, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
}

export default function Page5() {
  const [tab, setTab] = useState<'assigned' | 'draft' | 'locked'>('assigned');
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  const handleLockVideo = async (videoId: number, videoTitle: string) => {
    if (!confirm(`Bạn có chắc chắn muốn khóa video "${videoTitle}"?\n\nVideo sẽ chuyển sang trạng thái inactive và không thể truy cập bởi giáo viên.`)) {
      return;
    }

    try {
      const response = await fetch('/api/training-videos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: videoId, status: 'inactive' })
      });

      const data = await response.json();
      if (data.success) {
        alert('Khóa video thành công!');
        fetchVideos(); // Refresh list
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (error) {
      console.error('Error locking video:', error);
      alert('Lỗi khi khóa video!');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("video", file);

    try {
      const res = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.url) {
        // Create video record with minimal info
        const response = await fetch('/api/training-videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: file.name.replace(/\.[^/.]+$/, ""), // Use filename without extension as default title
            video_link: data.url,
            start_date: new Date().toISOString().split('T')[0],
            duration_minutes: 30,
            status: "draft"
          })
        });

        const videoData = await response.json();
        if (videoData.success) {
          // Redirect to setup page to fill in details
          router.push(`/admin/video-setup?id=${videoData.data.id}`);
        } else {
          alert("Lỗi khi lưu video: " + videoData.error);
        }
      } else {
        alert(data.error || "Lỗi upload video!");
      }
    } catch (err) {
      alert("Lỗi khi upload video!");
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
                className="bg-white rounded-lg border border-gray-200 p-2 hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                {/* Lock Button */}
                {video.status !== 'inactive' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLockVideo(video.id, video.title);
                    }}
                    className="absolute top-2 right-2 bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-orange-600 z-10"
                    title="Khóa video"
                  >
                    <Lock className="h-3 w-3" />
                  </button>
                )}

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
                  </div>

                  {/* Info */}
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-1 flex-wrap">
                    {video.lesson_number && (
                      <span className="font-semibold">L{video.lesson_number}</span>
                    )}
                    {video.lesson_number && <span>•</span>}
                    <span>{video.duration_minutes || 0}p</span>
                    <span>•</span>
                    <span>👁️ {video.view_count || 0}</span>
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
    </PageContainer>
  );
}

