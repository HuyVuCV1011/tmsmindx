"use client";

import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useToast } from "@/lib/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  created_at: string;
}

interface Question {
  id?: number;
  time: number;
  question: string;
  options: string[];
  answer: number;
}

function VideoSetupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const videoId = searchParams.get("id");
  const videoRef = useRef<HTMLVideoElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: "danger" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'questions' | 'assignment'>('questions');
  const [saving, setSaving] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  // Video edit form state
  const [videoForm, setVideoForm] = useState({
    title: "",
    lesson_number: "",
    duration_minutes: "",
    start_date: "",
    description: "",
    thumbnail_url: ""
  });

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [newAnswer, setNewAnswer] = useState(0);
  const [addTime, setAddTime] = useState("");
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);

  // Assignment selection state
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [currentAssignment, setCurrentAssignment] = useState<any>(null);

  useEffect(() => {
    // Fetch all assignments for selection
    const fetchAssignments = async () => {
        try {
            const res = await fetch('/api/training-assignments');
            const data = await res.json();
            if (data.success) {
                setAllAssignments(data.data);
            }
        } catch (e) {
            console.error(e);
        }
    };
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (allAssignments.length > 0 && videoId) {
        // Check if there is already an assignment for this video
        const linked = allAssignments.find((a: any) => a.video_id === parseInt(videoId!));
        if (linked) {
            setCurrentAssignment(linked);
            setSelectedAssignmentId(linked.id.toString());
        }
    }
  }, [allAssignments, videoId]);

  useEffect(() => {
    if (!videoId) {
      setError("Không có ID video");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch current video
        const videoResponse = await fetch(`/api/training-videos?id=${videoId}`);
        const videoData = await videoResponse.json();
        
        // Fetch all videos to calculate next lesson number
        const allVideosResponse = await fetch('/api/training-videos');
        const allVideosData = await allVideosResponse.json();
        
        if (videoData.success && videoData.data.length > 0) {
          const currentVideo = videoData.data[0];
          setVideo(currentVideo);
          
          // Calculate next lesson number (max lesson number + 1)
          let maxLesson = 0;
          if (allVideosData.success && allVideosData.data.length > 0) {
            maxLesson = Math.max(...allVideosData.data.map((v: Video) => v.lesson_number || 0));
          }
          const nextLesson = maxLesson + 1;
          
          // Set form with current video data or defaults
          setVideoForm({
            title: currentVideo.title || "",
            lesson_number: currentVideo.lesson_number ? currentVideo.lesson_number.toString() : nextLesson.toString(),
            duration_minutes: currentVideo.duration_minutes ? currentVideo.duration_minutes.toString() : "30",
            start_date: currentVideo.start_date ? new Date(currentVideo.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            description: currentVideo.description || "",
            thumbnail_url: currentVideo.thumbnail_url || ""
          });
          
          // Set thumbnail preview if exists
          if (currentVideo.thumbnail_url) {
            setThumbnailPreview(currentVideo.thumbnail_url);
          }
          
          // Load questions from database
          await loadQuestions(videoId);
        } else {
          setError("Không tìm thấy video");
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError("Lỗi khi tải thông tin video");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [videoId]);

  // Load questions from database
  const loadQuestions = async (vId: string) => {
    try {
      const response = await fetch(`/api/training-video-questions?video_id=${vId}`);
      const data = await response.json();
      if (data.success && data.data) {
        const loadedQuestions = data.data.map((q: any) => ({
          id: q.id,
          time: q.time_in_video,
          question: q.question_text,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []),
          answer: parseInt(q.correct_answer) || 0
        }));
        setQuestions(loadedQuestions);
        console.log('[Video Setup] Loaded questions:', loadedQuestions);
      }
    } catch (err) {
      console.error('Error loading questions:', err);
    }
  };

  // Save question to database
  const saveQuestionToDb = async (question: Question & {id?: number}) => {
    if (!videoId) return;
    
    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NEXT_PUBLIC_API_SECRET || 'mindx-teaching-internal-2025'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/training-video-questions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          video_id: parseInt(videoId),
          question_text: question.question,
          time_in_video: question.time,
          correct_answer: question.answer.toString(),
          options: question.options,
          question_type: 'multiple_choice',
          points: 1.00
        })
      });
      
      const data = await response.json();
      if (data.success) {
        return data.data.id;
      }
    } catch (err) {
      console.error('Error saving question:', err);
    }
  };

  // Delete question from database
  const deleteQuestionFromDb = async (questionId: number) => {
    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'x-api-key': process.env.NEXT_PUBLIC_API_SECRET || 'mindx-teaching-internal-2025'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      await fetch(`/api/training-video-questions?id=${questionId}`, {
        method: 'DELETE',
        headers
      });
    } catch (err) {
      console.error('Error deleting question:', err);
    }
  };

  // Update duration from video element when loaded
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      const handleLoadedMetadata = () => {
        const durationInMinutes = Math.ceil(videoElement.duration / 60);
        setVideoForm(prev => ({
          ...prev,
          duration_minutes: durationInMinutes.toString()
        }));
      };
      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }
  }, [video]);

  const getCurrentTime = () => {
    if (videoRef.current) {
      setAddTime(Math.floor(videoRef.current.currentTime).toString());
    }
  };


  // Auto-sync time from video when form is open
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !showQuestionForm) return;

    const handleTimeUpdate = () => {
        // Only update if user is strictly seeking or pausing, 
        // but 'timeupdate' fires too often. 
        // User asked: "click on timeline". 
        // Standard video clicking timeline fires 'seeking' -> 'seeked'.
    };

    const handleSeeked = () => {
        // Round to 1 decimal place or integer
        setAddTime(Math.floor(videoElement.currentTime).toString());
    };

    videoElement.addEventListener('seeked', handleSeeked);
    // Also update on pause? helpful if they pause to pick a time
    videoElement.addEventListener('pause', handleSeeked);

    return () => {
        videoElement.removeEventListener('seeked', handleSeeked);
        videoElement.removeEventListener('pause', handleSeeked);
    };
  }, [showQuestionForm]);

  const handleAddQuestion = async () => {
    if (!newQuestion || newOptions.some(opt => !opt)) {
      toast.error("Vui lòng điền đầy đủ câu hỏi và các đáp án!");
      return;
    }

    const questionData = {
      time: parseInt(addTime) || 0,
      question: newQuestion,
      options: newOptions.filter(opt => opt),
      answer: newAnswer
    };

    if (editingQuestionIndex !== null) {
      const updated = [...questions];
      updated[editingQuestionIndex] = questionData;
      setQuestions(updated);
      // Update in database if has id
      if (questions[editingQuestionIndex].id) {
        await deleteQuestionFromDb(questions[editingQuestionIndex].id!);
        const newId = await saveQuestionToDb(questionData);
        updated[editingQuestionIndex].id = newId;
      }
      setEditingQuestionIndex(null);
    } else {
      // Save to database first
      const dbId = await saveQuestionToDb(questionData);
      setQuestions([...questions, { ...questionData, id: dbId }]);
    }

    // Reset form
    setNewQuestion("");
    setNewOptions(["", "", "", ""]);
    setNewAnswer(0);
    setAddTime("");
    setShowQuestionForm(false);
  };

  const handleEditQuestion = (index: number) => {
    const q = questions[index];
    setNewQuestion(q.question);
    setNewOptions([...q.options, "", "", "", ""].slice(0, 4));
    setNewAnswer(q.answer);
    setAddTime(q.time.toString());
    setEditingQuestionIndex(index);
    setShowQuestionForm(true);
  };

  const handleDeleteQuestion = async (index: number) => {
    setConfirmDialog({
      isOpen: true,
      title: "Xóa câu hỏi",
      message: "Bạn có chắc muốn xóa câu hỏi này?",
      type: "danger",
      onConfirm: async () => {
        const question = questions[index];
        if (question.id) {
          await deleteQuestionFromDb(question.id);
        }
        setQuestions(questions.filter((_, i) => i !== index));
        toast.success("Đã xóa câu hỏi");
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleLinkAssignment = async () => {
    if (!selectedAssignmentId || !video) return;

    try {
      const response = await fetch(`/api/training-assignments?id=${selectedAssignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: video.id
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Đã liên kết assignment thành công!');
        // Refresh assignments list
        try {
            const res = await fetch('/api/training-assignments');
            const assignmentsData = await res.json();
            if (assignmentsData.success) {
                setAllAssignments(assignmentsData.data);
                const updated = assignmentsData.data.find((a: any) => a.id.toString() === selectedAssignmentId);
                if (updated) setCurrentAssignment(updated);
            }
        } catch(e) {}
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error linking assignment:', err);
      toast.error('Lỗi khi liên kết assignment');
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadThumbnail = async (): Promise<string | null> => {
    if (!thumbnailFile) return videoForm.thumbnail_url || null;
    
    setUploadingThumbnail(true);
    try {
      const formData = new FormData();
      formData.append('image', thumbnailFile);
      
      const response = await fetch('/api/upload-thumbnail', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.success && data.url) {
        return data.url;
      } else {
        toast.error('Lỗi khi upload thumbnail: ' + (data.error || 'Unknown error'));
        return null;
      }
    } catch (err) {
      console.error('Error uploading thumbnail:', err);
      toast.error('Lỗi khi upload thumbnail');
      return null;
    } finally {
      setUploadingThumbnail(false);
    }
  };


  const executeSaveVideo = async (status: 'draft' | 'active') => {
    setSaving(true);
    try {
      // Upload thumbnail first if there's a new file
      let thumbnailUrl = videoForm.thumbnail_url;
      if (thumbnailFile) {
        const uploadedUrl = await uploadThumbnail();
        if (uploadedUrl) {
          thumbnailUrl = uploadedUrl;
        }
      }
      
      const response = await fetch('/api/training-videos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: video!.id, // video is checked before calling
          title: videoForm.title,
          lesson_number: parseInt(videoForm.lesson_number) || null,
          duration_minutes: parseInt(videoForm.duration_minutes) || 30,
          start_date: videoForm.start_date,
          description: videoForm.description,
          thumbnail_url: thumbnailUrl,
          status: status
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(status === 'draft' ? 'Lưu draft thành công!' : 'Giao bài thành công!');
        router.push('/admin/page5');
      } else {
        toast.error('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error saving video:', err);
      toast.error('Lỗi khi lưu video');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVideo = async (status: 'draft' | 'active') => {
    if (!video) return;
    
    if (status === 'active' && !currentAssignment && questions.length === 0) {
        // If neither assignment nor questions, warn user it's just a raw video
        setConfirmDialog({
            isOpen: true,
            title: "Xác nhận công khai",
            message: "Video này chưa có Assignment (bài tập) và chưa có câu hỏi pop-up nào. Học viên sẽ được tính hoàn thành ngay sau khi xem xong video. Bạn có chắc muốn tiếp tục?",
            type: "warning",
            onConfirm: () => {
                setConfirmDialog(p => ({...p, isOpen: false}));
                executeSaveVideo(status);
            }
        });
        return;
    }


    if (status === 'active' && !currentAssignment) {
        setConfirmDialog({
            isOpen: true,
            title: "Yêu cầu Assignment",
            message: "Video này chưa có Assignment (bài tập). Bạn không được phép Giao bài (Active) khi không có Assignment kèm theo. Vui lòng liên kết bài tập trước.",
            type: "warning",
            onConfirm: () => {
                setConfirmDialog(p => ({...p, isOpen: false}));
            }
        });
        return;
    }
    
    executeSaveVideo(status);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-white/50 backdrop-blur rounded-lg w-64 animate-pulse"></div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 space-y-4">
                <div className="w-full aspect-video bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                    <div className="h-10 bg-gray-100 rounded w-full animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 space-y-4">
              <div className="flex gap-4 border-b">
                <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
              </div>
              <div className="space-y-4 mt-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-2xl mx-auto">
          <button 
            className="mb-6 flex items-center gap-2 text-[#a1001f] hover:text-[#c41230] font-medium transition group" 
            onClick={() => router.push('/admin/page5')}
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại dashboard
          </button>
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy video</h2>
            <p className="text-gray-600 mb-6">{error || "Video này không tồn tại hoặc đã bị xóa"}</p>
            <Button
              variant="mindx"
              onClick={() => router.push('/admin/page5')}
              className="px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl"
            >
              Về danh sách video
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <button 
              className="mb-3 flex items-center gap-2 text-[#a1001f] hover:text-[#c41230] font-medium transition group" 
              onClick={() => router.push('/admin/page5')}
            >
              <svg className="w-5 h-5 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Danh sách video
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Setup Video: {videoForm.title}</h1>
            <p className="text-gray-600 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide">Edit Mode</span>
              Chỉnh sửa thông tin video, thêm câu hỏi và tạo assignment
            </p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button
              variant="secondary"
              onClick={() => handleSaveVideo('draft')}
              disabled={saving}
              className="flex-1 md:flex-none shadow-sm hover:shadow-md transition-all"
            >
              {saving ? 'Đang lưu...' : 'Lưu Draft'}
            </Button>
            <Button
              variant="success"
              onClick={() => handleSaveVideo('active')}
              disabled={saving}
              className="flex-1 md:flex-none shadow-md hover:shadow-lg transition-all"
            >
              {saving ? 'Đang lưu...' : 'Giao bài (Active)'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Video Preview & Info */}
          <div className="space-y-6">
            {/* Video Player */}
            <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 border border-blue-50">
              <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
                Preview Video
              </h2>
              <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-inner ring-1 ring-gray-200">
                <video
                  ref={videoRef}
                  src={video.video_link}
                  controls
                  className="w-full h-full"
                />
              </div>
              {/* Video info display below video */}
              <div className="mt-4 flex gap-6 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-gray-700">Thời lượng:</span>
                  <span>{videoForm.duration_minutes} phút</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="font-medium text-gray-700">Lesson:</span>
                  <span>#{videoForm.lesson_number}</span>
                </div>
              </div>
            </div>

            {/* Video Info Form */}
            <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 border border-blue-50">
              <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </span>
                Thông tin Video
              </h2>
              <div className="space-y-5">
                <div>
                  <label className="block mb-2 font-medium text-sm text-gray-700">Tên video <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={videoForm.title}
                    onChange={(e) => setVideoForm({...videoForm, title: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                    placeholder="Ví dụ: LESSON 01: Kỹ năng trao đổi với PHHS"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 font-medium text-sm text-gray-700">Ngày bắt đầu</label>
                    <input
                      type="date"
                      value={videoForm.start_date}
                      onChange={(e) => setVideoForm({...videoForm, start_date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-medium text-sm text-gray-700">Số thứ tự bài học</label>
                    <input
                      type="number"
                      value={videoForm.lesson_number}
                      onChange={(e) => setVideoForm({...videoForm, lesson_number: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-2 font-medium text-sm text-gray-700">Mô tả</label>
                  <textarea
                    value={videoForm.description}
                    onChange={(e) => setVideoForm({...videoForm, description: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                    rows={3}
                    placeholder="Mô tả về video..."
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium text-sm text-gray-700">Thumbnail</label>
                  <input
                    type="file"
                    ref={thumbnailInputRef}
                    onChange={handleThumbnailChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex gap-4 items-center p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                    {thumbnailPreview ? (
                      <div className="relative w-40 h-24 bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 group">
                        <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setThumbnailPreview("");
                              setThumbnailFile(null);
                              setVideoForm({...videoForm, thumbnail_url: ""});
                            }}
                            className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-40 h-24 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 border border-gray-300">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 mb-1">Video Thumbnail</p>
                      <p className="text-xs text-gray-500 mb-3">Kích thước khuyến nghị 16:9, JPG hoặc PNG</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => thumbnailInputRef.current?.click()}
                        disabled={uploadingThumbnail}
                        className="bg-white"
                      >
                        {uploadingThumbnail ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Đang tải lên...
                          </>
                        ) : thumbnailPreview ? 'Thay đổi ảnh' : 'Tải ảnh lên'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Tabs for Questions and Assignment */}
          <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 border border-blue-50 h-fit">
            {/* Tab Headers */}
            <div className="flex border-b border-gray-100 mb-6 bg-slate-50 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('questions')}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all text-center ${
                  activeTab === 'questions'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                }`}
              >
                Câu hỏi trong video ({questions.length})
              </button>
              <button
                onClick={() => setActiveTab('assignment')}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all text-center ${
                  activeTab === 'assignment'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                }`}
              >
                Tạo Assignment
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'questions' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Q & A</h3>
                    <p className="text-xs text-blue-600 font-medium">Câu hỏi pop-up khi xem video</p>
                  </div>
                  <Button
                    onClick={() => {
                      setShowQuestionForm(true);
                      setEditingQuestionIndex(null);
                      getCurrentTime();
                    }}
                    variant="outline"
                    className="border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 bg-white"
                  >
                    + Thêm câu hỏi
                  </Button>
                </div>

                {/* Question Form - Inline instead of Modal */}
                {showQuestionForm && (
                  <div className="bg-white rounded-2xl shadow-xl border-2 border-blue-200 p-6 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                            {editingQuestionIndex !== null ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            )}
                          </span>
                          {editingQuestionIndex !== null ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
                        </h3>
                        <Button 
                          variant="ghost"
                          onClick={() => setShowQuestionForm(false)}
                          className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </Button>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                          <label className="block mb-2 font-medium text-sm text-gray-700 flex justify-between">
                              <span>Thời điểm hiển thị (giây)</span>
                              <span className="text-xs text-blue-600 font-normal">
                                  💡 Mẹo: Bấm lên timeline video bên trái để chọn thời gian
                              </span>
                          </label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-2.5 text-gray-400">⏱</span>
                              <input
                                type="number"
                                value={addTime}
                                onChange={(e) => setAddTime(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm font-mono text-lg font-bold text-blue-700"
                                placeholder="0"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={getCurrentTime}
                              className="whitespace-nowrap bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                              title="Lấy thời điểm hiện tại của video"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Lấy hiện tại
                            </Button>
                          </div>
                        </div>

                        <div>
                          <label className="block mb-2 font-medium text-sm text-gray-700">Câu hỏi <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={newQuestion}
                            onChange={(e) => setNewQuestion(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                            placeholder="Nhập nội dung câu hỏi..."
                            autoFocus
                          />
                        </div>

                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                          <label className="block mb-3 font-medium text-sm text-gray-700">Các đáp án</label>
                          <div className="space-y-3">
                            {newOptions.map((opt, i) => (
                              <div key={i} className="flex gap-3 items-center group">
                                <div className="relative flex items-center justify-center">
                                  <input
                                    type="radio"
                                    name="answer"
                                    checked={newAnswer === i}
                                    onChange={() => setNewAnswer(i)}
                                    className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const updated = [...newOptions];
                                    updated[i] = e.target.value;
                                    setNewOptions(updated);
                                  }}
                                  className={`flex-1 border rounded-lg px-4 py-2.5 outline-none transition-all shadow-sm ${
                                    newAnswer === i 
                                      ? 'border-blue-300 ring-2 ring-blue-50 bg-white font-medium text-blue-900' 
                                      : 'border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                                  }`}
                                  placeholder={`Đáp án ${i + 1}`}
                                />
                                {newAnswer === i && (
                                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">ĐÚNG</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setShowQuestionForm(false);
                              setEditingQuestionIndex(null);
                              setNewQuestion("");
                              setNewOptions(["", "", "", ""]);
                              setNewAnswer(0);
                              setAddTime("");
                            }}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700"
                          >
                            Hủy bỏ
                          </Button>
                          <Button
                            variant="mindx"
                            onClick={handleAddQuestion}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg text-white"
                          >
                            {editingQuestionIndex !== null ? 'Cập nhật' : 'Thêm câu hỏi'}
                          </Button>
                        </div>
                      </div>
                  </div>
                )}
                
                {/* List - only show when form is NOT open */}
                {!showQuestionForm && (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                  {questions.length === 0 ? (
                    <div className="text-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">?</div>
                      <p className="text-gray-500 font-medium">Chưa có câu hỏi nào</p>
                      <p className="text-sm text-gray-400 mt-1">Video sẽ chạy liên tục từ đầu đến cuối</p>
                    </div>
                  ) : (
                    questions.map((q, idx) => (
                      <div key={idx} className="border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-blue-100 hover:bg-white transition-all bg-gray-50/30 group">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1 cursor-pointer hover:bg-blue-200 transition-colors"
                                  onClick={() => {
                                      if (videoRef.current) {
                                          videoRef.current.currentTime = q.time;
                                          videoRef.current.pause(); // Optional: pause to let them see
                                      }
                                  }}
                                  title="Click để xem tại thời điểm này"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {Math.floor(q.time / 60)}:{String(q.time % 60).padStart(2, '0')}
                              </span>
                              <span className="font-semibold text-gray-900 text-sm line-clamp-1">{q.question}</span>
                            </div>
                            <div className="space-y-1.5 pl-1">
                              {q.options.map((opt, i) => (
                                <div key={i} className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${i === q.answer ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-500'}`}>
                                  {i === q.answer ? (
                                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"></div>
                                  )}
                                  <span className="line-clamp-1">{opt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                  // Pre-seek to the question time
                                  if (videoRef.current) {
                                      videoRef.current.currentTime = q.time;
                                      videoRef.current.pause();
                                  }
                                  handleEditQuestion(idx);
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                              title="Sửa"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(idx)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                              title="Xóa"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                )}
              </div>
            ) : (
                <div className="space-y-6">
                
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Assignment hiện tại
                    </h4>
                    {currentAssignment ? (
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <div className="font-bold text-lg text-blue-900 mb-1">{currentAssignment.assignment_title}</div>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2 mb-4">
                                <span className="bg-white px-2 py-1 rounded border border-blue-100 shadow-sm flex items-center gap-1">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                  {currentAssignment.assignment_type}
                                </span>
                                <span className="bg-white px-2 py-1 rounded border border-blue-100 shadow-sm flex items-center gap-1">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                                  {currentAssignment.total_points} điểm
                                </span>
                                <span className="bg-white px-2 py-1 rounded border border-blue-100 shadow-sm flex items-center gap-1">
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  {currentAssignment.time_limit_minutes} phút
                                </span>
                            </div>
                            <div className="flex gap-3 pt-3 border-t border-blue-200">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/admin/assignment-questions?assignment_id=${currentAssignment.id}`)}
                                    className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                                >
                                    Quản lý câu hỏi
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        setConfirmDialog({
                                          isOpen: true,
                                          title: "Hủy liên kết",
                                          message: "Bạn có chắc muốn hủy liên kết assignment này?",
                                          type: "warning",
                                          onConfirm: async () => {
                                              const res = await fetch(`/api/training-assignments?id=${currentAssignment.id}`, {
                                                  method: 'PUT',
                                                  headers: {'Content-Type': 'application/json'},
                                                  body: JSON.stringify({ video_id: null })
                                              });
                                              const data = await res.json();
                                              if(data.success) {
                                                  setCurrentAssignment(null);
                                                  toast.success('Đã hủy liên kết');
                                                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                                                  // Refresh list
                                                  const d = await fetch('/api/training-assignments').then(r=>r.json());
                                                  if(d.success) setAllAssignments(d.data);
                                              } else {
                                                  toast.error('Lỗi khi hủy liên kết: ' + data.error);
                                                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                                              }
                                          }
                                        });
                                    }}
                                    className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 shadow-none"
                                >
                                    Hủy liên kết
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 rounded-xl p-6 border border-amber-100 text-center space-y-3">
                          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          </div>
                          <div>
                            <h3 className="text-amber-800 font-bold text-lg">Chưa có Assignment</h3>
                            <p className="text-amber-700 text-sm mt-1 max-w-sm mx-auto">
                              Video này chưa được liên kết với bài tập nào. Vui lòng chọn Assignment bên dưới để có thể Giao bài (Active).
                            </p>
                          </div>
                        </div>
                    )}
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100">
                    <label className="block mb-3 font-medium text-sm text-gray-700">Chọn Assignment từ danh sách có sẵn</label>
                    <div className="flex flex-col sm:flex-row gap-3 mb-2">
                        <div className="relative flex-1">
                          <select 
                              className="w-full appearance-none border border-gray-300 rounded-lg pl-4 pr-10 py-2.5 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                              value={selectedAssignmentId}
                              onChange={(e) => setSelectedAssignmentId(e.target.value)}
                          >
                              <option value="">-- Chọn một Assignment --</option>
                              {allAssignments.filter(a => !currentAssignment || a.id !== currentAssignment.id).map(a => (
                                  <option key={a.id} value={a.id}>
                                      {a.assignment_title} {a.video_id ? `(⚠️ Đang dùng cho video #${a.video_id})` : '(✅ Có sẵn)'}
                                  </option>
                              ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>
                        <Button 
                            onClick={handleLinkAssignment}
                            disabled={!selectedAssignmentId}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                        >
                            Lưu liên kết
                        </Button>
                    </div>
                    {selectedAssignmentId && (() => {
                      const selected = allAssignments.find(a => a.id.toString() === selectedAssignmentId);
                      if (selected?.video_id) {
                        return (
                          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1 bg-amber-50 p-2 rounded border border-amber-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            Lưu ý: Assignment này đang được dùng cho video khác. Nếu lưu, nó sẽ được chuyển sang video này.
                          </p>
                        );
                      }
                      return null;
                    })()}

                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-xl text-center mt-6 border border-gray-200">
                        <p className="text-sm text-gray-600 mb-3 font-medium">Chưa có form phù hợp?</p>
                        <Button 
                            onClick={() => router.push('/admin/assignments')}
                            variant="secondary"
                            className="bg-white border hover:bg-gray-50 shadow-sm"
                        >
                            Đến trang Quản lý Assignments để tạo mới
                        </Button>
                    </div>
                </div>
            </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </div>
  );
}

export default function VideoSetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white p-8 flex items-center justify-center">Đang tải...</div>}>
      <VideoSetupContent />
    </Suspense>
  );
}
