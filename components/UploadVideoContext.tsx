"use client";

import React, { createContext, useContext, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { v4 as uuidv4 } from "uuid";
import { toast } from "@/lib/app-toast";
import { FileVideo, Loader2, CheckCircle2, AlertCircle, Upload } from "lucide-react";

type UploadState = {
  isUploading: boolean;
  progress: number; // 0 to 100
  statusText: string;
  originalFilename: string;
};

type UploadContextType = {
  uploadState: UploadState;
  startUpload: (file: File) => Promise<void>;
};

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const useUploadVideo = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUploadVideo must be used within UploadVideoProvider");
  }
  return context;
};


const getSignature = async () => {
    const res = await fetch("/api/cloudinary-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: "mindx_videos" }),
    });
    if (!res.ok) throw new Error("Không thể tạo signature");
    return res.json();
};

const fetchWithRetry = async (url: string, options: any, maxRetries = 3) => {
    let lastErrorDetails = "";
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        
        const errorText = await response.text();
        lastErrorDetails = `Status ${response.status}: ${errorText}`;
        console.warn(`Tải lại lần ${i + 1} (${lastErrorDetails})`);
        
        // NẾU LỖI 400 (BAD REQUEST) TỪ CLOUDINARY HOẶC API -> THƯỜNG LÀ LỖI DỮ LIỆU/CHỮ KÍ, DỪNG LUÔN KHÔNG RETRY CHO TIẾT KIỆM THỜI GIAN
        if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
            throw new Error(`Máy chủ từ chối (Status ${response.status}): ${errorText}`);
        }
      } catch (err: any) {
        console.warn(`Khẩn cấp tải lại mạng lần ${i + 1}: ${err.message}`);
        lastErrorDetails = err.message;
        if (err.message.includes("Máy chủ từ chối")) throw err;
      }
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error(`Lỗi đường truyền hoặc máy chủ quá tải. Chi tiết: ${lastErrorDetails}`);
};

export const UploadVideoProvider = ({ children }: { children: React.ReactNode }) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    statusText: "",
    originalFilename: "",
  });

  const startUpload = async (file: File) => {
    if (uploadState.isUploading) {
      toast.error("Đang có một tiến trình upload, vui lòng chờ!");
      return;
    }

    setUploadState({
      isUploading: true,
      progress: 0,
      statusText: "Đang khởi tạo tải lên...",
      originalFilename: file.name,
    });

    let isSuccess = false;

    try {
      // Lấy signature khởi tạo (chỉ để lấy cloudName, v.v.)
      const { cloudName, apiKey, folder } = await getSignature();

      const fileMB = file.size / (1024 * 1024);
      const CHUNK_LIMIT_MB = 45;

      // NẾU LỚN HƠN 100MB => DÙNG FFMPEG CẮT VÀ UPLOAD THEO TỪNG CHUNK
      if (file.size > 100 * 1024 * 1024) {
        setUploadState((prev) => ({ ...prev, statusText: "Đang tải dữ liệu bộ nhớ đệm FFmpeg..." }));

        const ffmpeg = new FFmpeg();
        ffmpeg.on("log", ({ message }) => console.log("FFmpeg:", message));
        ffmpeg.on("progress", ({ progress }) => {
            // progress of slicing is separate, we can interpolate 0->30% for carving
            setUploadState((prev) => ({ ...prev, progress: Math.min(30, Math.round(progress * 30)) }));
        });

        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
        await ffmpeg.load({
          coreURL: `${baseURL}/ffmpeg-core.js`,
          wasmURL: `${baseURL}/ffmpeg-core.wasm`,
        });

        setUploadState((prev) => ({ ...prev, statusText: "Đang đọc dữ liệu video vào bộ nhớ xử lý..." }));
        await ffmpeg.writeFile("input.mp4", await fetchFile(file));

        const durationSec = await new Promise<number>((resolve) => {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            resolve(video.duration);
          };
          video.src = URL.createObjectURL(file);
        });

        const estimatedChunks = Math.ceil(fileMB / CHUNK_LIMIT_MB);
        const segmentTime = Math.ceil(durationSec / estimatedChunks) + 2;

        setUploadState((prev) => ({ ...prev, statusText: `Đang phân rã dữ liệu... (Tùy máy sẽ mất vài phút)` }));
        
        await ffmpeg.exec([
          "-i", "input.mp4",
          "-c", "copy",
          "-f", "segment",
          "-segment_time", segmentTime.toString(),
          "-reset_timestamps", "1",
          "output_%03d.mp4",
        ]);

        const groupId = uuidv4();

        // Đếm chính xác số phận cắt được sinh ra
        const dirList = await ffmpeg.listDir('/');
        const outputFiles = dirList.filter(f => f.name && f.name.startsWith('output_') && f.name.endsWith('.mp4')).map(f => f.name).sort();
        const actualNumChunks = outputFiles.length;

        for (let i = 0; i < actualNumChunks; i++) {
          const filename = outputFiles[i];
          
          // Trọng số progress: Cắt chiếm 30%, Upload chiếm 70%
          // Upload chunkSize = 70/numChunks
          const baseUploadProgress = 30 + (i / actualNumChunks) * 70;
          
          setUploadState((prev) => ({ 
              ...prev, 
              statusText: `Đang tải lên phần ${i + 1}/${actualNumChunks}...`,
              progress: Math.round(baseUploadProgress)
          }));

          const chunkData = await ffmpeg.readFile(filename);
          const chunkBlob = new Blob([new Uint8Array(chunkData as any)], { type: "video/mp4" });

          const formData = new FormData();
          formData.append("file", chunkBlob, `${file.name}_part${i + 1}.mp4`);
          const { signature, timestamp } = await getSignature(); // Làm mới signature để không bị hết hạn 1 giờ trong quá trình cắt video lâu

          formData.append("signature", signature);
          formData.append("timestamp", timestamp.toString());
          formData.append("api_key", apiKey);
          formData.append("folder", folder);

          const uploadRes = await fetchWithRetry(
`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
{ method: "POST", body: formData }, 5); // Thử lại 5 lần nếu rớt mạng

          if (!uploadRes.ok) {
            throw new Error(`Upload lỗi ở phân đoạn ${i + 1}`);
          }
          const uploadData = await uploadRes.json();
          // Dọn dẹp memory ngay để tránh tràn RAM trình duyệt
          try { await ffmpeg.deleteFile(filename); } catch (e) {}


          await fetchWithRetry("/api/training-videos", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
              title: file.name.replace(/\.[^/.]+$/, ""),
              video_link: uploadData.secure_url,
              start_date: new Date().toISOString().split("T")[0],
              duration_minutes: Math.ceil((uploadData.duration || segmentTime) / 60),
              duration_seconds: uploadData.duration || segmentTime,
              status: "draft",
              video_group_id: groupId,
              chunk_index: i + 1,
              chunk_total: actualNumChunks,
              original_filename: file.name,
              original_size_bytes: file.size,
            }),
          });
        }
        isSuccess = true;
        try { await ffmpeg.deleteFile("input.mp4"); } catch (e) {}

      } else {
        // ĐƠN FILE DƯỚI 100MB
        setUploadState((prev) => ({ ...prev, statusText: "Đang tải lên video...", progress: 50 }));
        
        const formData = new FormData();
        formData.append("file", file);
        const { signature, timestamp } = await getSignature();

        formData.append("signature", signature);
        formData.append("timestamp", timestamp.toString());
        formData.append("api_key", apiKey);
        formData.append("folder", folder);

        const uploadRes = await fetchWithRetry(
`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
{ method: "POST", body: formData }, 5); // Thử lại 5 lần nếu rớt mạng

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json();
          throw new Error(errorData.error?.message || "Upload lên Cloudinary thất bại");
        }

        const uploadData = await uploadRes.json();

        setUploadState((prev) => ({ ...prev, statusText: "Đang lưu vào kho dữ liệu...", progress: 95 }));

        const response = await fetchWithRetry("/api/training-videos", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
            title: file.name.replace(/\.[^/.]+$/, ""),
            video_link: uploadData.secure_url,
            start_date: new Date().toISOString().split("T")[0],
            duration_minutes: Math.ceil(uploadData.duration / 60) || 30,
            duration_seconds: uploadData.duration || 0,
            status: "draft",
          }),
        });

        const videoData = await response.json();
        if (videoData.success) {
            isSuccess = true;
        } else {
            throw new Error("Lỗi khi lưu video: " + videoData.error);
        }
      }

      setUploadState((prev) => ({ ...prev, progress: 100, statusText: "Hoàn tất!" }));
      if (isSuccess) {
          toast.success("Tải lên video thành công!");
          // Bắn event qua trình duyệt để các màn hình khác reload
          window.dispatchEvent(new Event("videoUploaded"));
      }

    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Lỗi khi upload video!");
    } finally {
      setTimeout(() => {
        setUploadState({ isUploading: false, progress: 0, statusText: "", originalFilename: "" });
      }, 3000);
    }
  };

  return (
    <UploadContext.Provider value={{ uploadState, startUpload }}>
      {children}
      {uploadState.isUploading && (
        <div className="fixed bottom-8 right-8 z-[9999] group flex flex-col items-end gap-3 transform transition-all duration-300">
          
          {/* TRẠNG THÁI TẢI LÊN (CARD ĐẸP HIỂN THỊ KHI HOVER) */}
          <div className="opacity-0 translate-y-3 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 w-[340px] bg-white shadow-[0_10px_40px_rgba(161,0,31,0.15)] border border-rose-100 rounded-2xl p-4 origin-bottom-right">
             <div className="flex flex-col gap-3">
                 <div className="flex items-start gap-4">
                     <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100 shadow-inner">
                         <FileVideo className="w-5 h-5 text-[#a1001f]" />
                     </div>
                     <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-semibold text-gray-800 truncate pr-2 w-[80%]" title={uploadState.originalFilename}>
                            {uploadState.originalFilename}
                          </h4>
                          <span className="text-xs font-bold text-[#a1001f] bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                            {uploadState.progress}%
                          </span>
                        </div>
                        <p className="text-[11.5px] text-gray-500 truncate w-full font-medium" title={uploadState.statusText}>
                          {uploadState.statusText}
                        </p>
                     </div>
                 </div>

                 {/* Dải tiến trình (Progress Line) */}
                 <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1 shadow-inner">
                     <div 
                        className="h-full bg-gradient-to-r from-rose-400 to-[#a1001f] transition-all duration-300 ease-out" 
                        style={{ width: `${uploadState.progress}%` }} 
                     />
                 </div>

                 <div className="flex items-center gap-2 mt-1 bg-gradient-to-r from-rose-50 to-white p-2.5 rounded-xl border border-rose-100/50 text-[11.5px] text-gray-700 shadow-sm">
                    {uploadState.progress === 100 ? (
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                       <Loader2 className="w-4 h-4 text-[#a1001f] animate-spin" />
                    )}
                    <span className="font-medium">
                      {uploadState.progress === 100 ? 'Tải lên hoàn tất!' : 'Hệ thống đang xử lý, xin vui lòng giữ nguyên trang.'}
                    </span>
                 </div>
             </div>
          </div>

          {/* VÒNG TRÒN TIẾN TRÌNH NHỎ LƯU TRÚ GÓC PHẢI DƯỚI (MẶC ĐỊNH HIỂN THỊ) */}
          <div className="relative w-14 h-14 bg-white rounded-full shadow-[0_8px_25px_rgba(161,0,31,0.2)] flex items-center justify-center cursor-pointer border-2 border-white hover:scale-105 hover:shadow-[0_8px_30px_rgba(161,0,31,0.3)] transition-all duration-300">
             {/* Vòng bg mờ */}
             <svg className="absolute inset-0 w-full h-full -rotate-90 transform origin-center" viewBox="0 0 36 36">
               <path
                 className="text-gray-100"
                 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                 fill="none"
                 stroke="currentColor"
                 strokeWidth="2.5"
               />
               <path
                 className={uploadState.progress === 100 ? "text-emerald-500 transition-all duration-500 ease-out" : "text-[#a1001f] transition-all duration-500 ease-out"}
                 strokeDasharray="100, 100"
                 strokeDashoffset={100 - uploadState.progress}
                 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                 fill="none"
                 stroke="currentColor"
                 strokeWidth="2.5"
                 strokeLinecap="round"
               />
             </svg>
             {/* Icon bên trong */}
             {uploadState.progress === 100 ? (
                <CheckCircle2 className="w-[22px] h-[22px] text-emerald-500 relative z-10 animate-in zoom-in" />
             ) : (
                <div className="relative z-10 flex items-center justify-center">
                  <Upload className="w-[18px] h-[18px] text-[#a1001f] absolute" />
                  <div className="absolute w-[22px] h-[22px] bg-[#a1001f] rounded-full blur-[10px] opacity-20 animate-pulse"></div>
                </div>
             )}
          </div>
        </div>
      )}
    </UploadContext.Provider>
  );
};

