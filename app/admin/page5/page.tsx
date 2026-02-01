"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quản lý đào tạo nâng cao</h1>
        <div>
          <input
            type="file"
            accept="video/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium disabled:bg-gray-400"
            onClick={handleUploadClick}
            disabled={uploading}
          >
            {uploading ? "Đang tải lên..." : "Upload video"}
          </button>
        </div>
      </div>

      {/* Loading overlay during upload */}
      {uploading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-lg font-semibold mb-2">Đang tải video lên...</div>
            <div className="text-sm text-gray-500">Vui lòng đợi trong giây lát</div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-3 mb-6">
        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-300 pb-2">
          <button
            className={`px-4 py-2 font-bold border-b-2 transition ${tab === 'assigned' ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('assigned')}
          >
            Video đã giao ({videos.filter(v => v.status === 'active').length})
          </button>
          <button
            className={`px-4 py-2 font-bold border-b-2 transition ${tab === 'draft' ? 'border-orange-500 text-orange-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('draft')}
          >
            Video nháp ({videos.filter(v => v.status === 'draft').length})
          </button>
          <button
            className={`px-4 py-2 font-bold border-b-2 transition ${tab === 'locked' ? 'border-red-500 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('locked')}
          >
            Video đã khóa ({videos.filter(v => v.status === 'inactive').length})
          </button>
        </div>
        
        {/* Search */}
        <input
          type="text"
          className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tìm kiếm video..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      
      {/* Videos List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Đang tải dữ liệu...</div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {search ? 'Không tìm thấy video nào' : 'Chưa có video nào. Nhấn "Upload video" để thêm mới.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {filteredVideos.map(video => (
            <div
              key={video.id}
              className="bg-white rounded-lg shadow p-3 flex flex-col relative group"
            >
              {/* Lock button (only show for active/draft videos) */}
              {video.status !== 'inactive' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLockVideo(video.id, video.title);
                  }}
                  className="absolute top-2 right-2 bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-orange-600 z-10"
                  title="Khóa video"
                >
                  🔒
                </button>
              )}

              <div 
                className="cursor-pointer flex-1"
                onClick={() => router.push(`/admin/video-detail?id=${video.id}`)}
                title="Xem chi tiết video"
              >
                <div className="bg-gray-300 rounded h-32 mb-2 flex items-center justify-center overflow-hidden">
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-4xl">🎬</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
                    {video.lesson_number && (
                      <>
                        <span className="font-semibold">L{video.lesson_number}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{video.duration_minutes || 0} phút</span>
                    <span>•</span>
                    <span>{video.view_count || 0} 👁️</span>
                  </div>
                  <div className="font-bold text-sm mb-1 line-clamp-2">{video.title}</div>
                  <div className="flex gap-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      video.status === 'active' ? 'bg-green-100 text-green-800' :
                      video.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {video.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

