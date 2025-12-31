"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Page5() {
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  // Dummy data for videos
  const videos = [
    {
      id: 1,
      title: "[AI4TEACHER] Hướng Dẫn Sử Dụng AI4Teacher cho Giáo Viên",
      duration: "03:34",
      assigned: true,
      views: 2,
      downloads: 0,
    },
    {
      id: 2,
      title: "AI4S",
      duration: "12:39",
      assigned: true,
      views: 6,
      downloads: 0,
    },
    {
      id: 3,
      title: "Lesson 8: Hướng dẫn đánh giá, phản hồi kết quả học tập",
      duration: "16:35",
      assigned: true,
      views: 7,
      downloads: 0,
    },
    {
      id: 4,
      title: "Ứng dụng AI đổi mới phương pháp và nâng cao hiệu quả giảng dạy",
      duration: "11:06",
      assigned: true,
      views: 7,
      downloads: 0,
    },
    {
      id: 5,
      title: "Lesson 6: Hướng dẫn xây dựng bài giảng, giáo án sáng tạo",
      duration: "16:41",
      assigned: true,
      views: 7,
      downloads: 0,
    },
    {
      id: 6,
      title: "Đào tạo nâng cao - LS09 - V7",
      duration: "11:22",
      assigned: false,
      unavailable: true,
    },
  ];

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quản lý đào tạo nâng cao</h1>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
          onClick={() => setShowUpload(true)}
        >
          Upload video
        </button>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-30" style={{zIndex: 30}}>
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowUpload(false)}
            >
              <span className="text-2xl">&times;</span>
            </button>
            <h2 className="text-lg font-bold mb-4">Upload video</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const file = fileInputRef.current?.files?.[0];
                if (!file) {
                  setUploadMsg("Vui lòng chọn file video!");
                  return;
                }
                setUploading(true);
                setUploadMsg(null);
                const formData = new FormData();
                formData.append("video", file);
                try {
                  const res = await fetch("/api/upload-video", {
                    method: "POST",
                    body: formData,
                  });
                  const data = await res.json();
                  if (res.ok && data.url) {
                    setUploadMsg("Tải video thành công! Đang chuyển sang giao diện chỉnh sửa...");
                    setTimeout(() => {
                      setShowUpload(false);
                      router.push(`/admin/video-detail?url=${encodeURIComponent(data.url)}`);
                    }, 1000);
                  } else {
                    setUploadMsg(data.error || "Lỗi upload!");
                  }
                } catch (err) {
                  setUploadMsg("Lỗi upload!");
                } finally {
                  setUploading(false);
                }
              }}
              className="border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-8 mb-4 w-full"
            >
              <div className="text-gray-400 text-4xl mb-2">↑</div>
              <div className="mb-2 text-gray-600">Chọn video từ máy tính</div>
              <input
                type="file"
                accept="video/*"
                ref={fileInputRef}
                className="mb-2"
                disabled={uploading}
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded mb-2 disabled:bg-gray-400"
                disabled={uploading}
              >
                {uploading ? "Đang tải lên..." : "Tải lên"}
              </button>
            </form>
            {uploadMsg && <div className="text-sm text-center text-blue-700 mb-2">{uploadMsg}</div>}
            <div className="text-xs text-gray-500 mt-2">
              Videos shouldn't be more than 1 GB (1024 MB)<br/>
              You are responsible for making sure uploaded videos respect copyright. Any infringements could result in a permanent ban of your account.
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tìm kiếm video..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      
      {/* Videos List */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {filteredVideos.filter(v => !v.unavailable).map(video => (
          <div
            key={video.id}
            className="bg-white rounded-lg shadow p-3 flex flex-col cursor-pointer hover:shadow-lg hover:border-blue-500 border border-transparent transition"
            onClick={() => router.push(`/admin/video-detail?id=${video.id}`)}
            title="Xem chi tiết video"
          >
            <div className="bg-gray-300 rounded h-32 mb-2 flex items-center justify-center">
              <span className="text-gray-400 text-4xl">🎬</span>
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
                <span>{video.duration}</span>
                <span>•</span>
                <span>{video.views} <svg className="inline w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></span>
                <span>•</span>
                <span>{video.downloads} <svg className="inline w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v12" /></svg></span>
              </div>
              <div className="font-bold text-sm mb-1 line-clamp-2">{video.title}</div>
              <div className="flex gap-1 flex-wrap">
                {video.assigned && <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Assigned</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

