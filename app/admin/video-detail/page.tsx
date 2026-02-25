"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

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
  students?: Array<{
    name: string;
    watched: number;
    grade: number | null;
    attempts: number;
    lastWatched: string;
    turnedIn: boolean;
  }>;
}

function VideoDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoId = searchParams.get("id");
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Array<{id?: number, time: number, question: string, options: string[], answer: number}>>([]);
  const [tab, setTab] = useState<'student' | 'question'>('student');
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [newAnswer, setNewAnswer] = useState(0);
  const [addTime, setAddTime] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [showQuestionIdx, setShowQuestionIdx] = useState<number|null>(null);
  const [userAnswer, setUserAnswer] = useState<number|null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch video data
  useEffect(() => {
    if (!videoId) {
      setError("Không có ID video");
      setLoading(false);
      return;
    }

    const fetchVideo = async () => {
      try {
        const response = await fetch(`/api/training-videos?id=${videoId}`);
        const data = await response.json();
        if (data.success && data.data.length > 0) {
          setVideo(data.data[0]);
        } else {
          setError("Không tìm thấy video");
        }
      } catch (err) {
        console.error('Error fetching video:', err);
        setError("Lỗi khi tải thông tin video");
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId]);

  // Load questions from database
  const loadQuestions = async (vId: string) => {
    try {
      const response = await fetch(`/api/training-video-questions?video_id=${vId}`);
      const data = await response.json();
      if (data.success && data.data) {
        // Convert from database format to component state format
        const loadedQuestions = data.data.map((q: any) => ({
          id: q.id,
          time: q.time_in_video,
          question: q.question_text,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []),
          answer: parseInt(q.correct_answer) || 0
        }));
        setQuestions(loadedQuestions);
        console.log('[Video Detail] Loaded questions:', loadedQuestions);
      }
    } catch (err) {
      console.error('Error loading questions:', err);
    }
  };

  // Load questions whenever videoId changes
  useEffect(() => {
    if (!videoId) return;
    loadQuestions(videoId);
  }, [videoId]);

  // Save question to database
  const saveQuestionToDb = async (question: {time: number, question: string, options: string[], answer: number}) => {
    if (!videoId) {
      console.error('[Video Detail] No videoId');
      return;
    }
    
    try {
      const payload = {
        video_id: parseInt(videoId),
        question_text: question.question,
        time_in_video: question.time,
        correct_answer: question.answer.toString(),
        options: question.options,
        question_type: 'multiple_choice',
        points: 1.00
      };
      console.log('[Video Detail] Sending payload:', payload);
      
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
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log('[Video Detail] API Response:', data);
      
      if (data.success) {
        console.log('Question saved to database with ID:', data.data.id);
        return data.data.id;
      } else {
        console.error('Failed to save question:', data.error);
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
      
      const response = await fetch(`/api/training-video-questions?id=${questionId}`, {
        method: 'DELETE',
        headers
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('Question deleted from database');
      } else {
        console.error('Failed to delete question:', data.error);
      }
    } catch (err) {
      console.error('Error deleting question:', err);
    }
  };

  // State for interactive questions
<<<<<<< HEAD
  // Tự động pause video khi đến thời điểm có câu hỏi (chỉ khi bật preview)
=======
  const [questions, setQuestions] = useState<Array<{id?: number, time: number, question: string, options: string[], answer: number}>>([]);
  const [tab, setTab] = useState<'student' | 'question'>('student');
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [newAnswer, setNewAnswer] = useState(0);
  const [addTime, setAddTime] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [assigning, setAssigning] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [showQuestionIdx, setShowQuestionIdx] = useState<number|null>(null);
  const [userAnswer, setUserAnswer] = useState<number|null>(null);

  // Tự động pause video khi đến thời điểm có câu hỏi
>>>>>>> 57865e52314c2e595a82dcd7dc0cb01da7b2bbc2
  useEffect(() => {
    if (!previewMode) {
      setShowQuestionIdx(null);
      return;
    }
    if (!videoRef.current || questions.length === 0) return;
    const video = videoRef.current;
    let lastIdx = -1;
    const onTimeUpdate = () => {
      if (showQuestionIdx !== null) return; // Đang hiện modal câu hỏi
      const current = video.currentTime;
      // Tìm câu hỏi gần nhất chưa hiện
      const idx = questions.findIndex(q => Math.abs(q.time - current) < 0.5 && (lastIdx !== q.time));
      if (idx !== -1) {
        video.pause();
        setShowQuestionIdx(idx);
        lastIdx = questions[idx].time;
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [questions, showQuestionIdx, previewMode]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!video) return;
    
    const isAssigning = newStatus === 'active';
    if (isAssigning) setAssigning(true);
    else setDrafting(true);
    setMsg(null);

    try {
      const response = await fetch('/api/training-videos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: video.id,
          status: newStatus
        })
      });

      const data = await response.json();
      if (data.success) {
        setVideo({ ...video, status: newStatus });
        setMsg(isAssigning ? "Đã assign video cho học sinh!" : "Đã lưu video vào draft!");
      } else {
        setMsg("Lỗi: " + data.error);
      }
    } catch (err) {
      console.error('Error updating video:', err);
      setMsg("Lỗi khi cập nhật video");
    } finally {
      if (isAssigning) setAssigning(false);
      else setDrafting(false);
    }
  };

  const handleLockVideo = async () => {
    if (!video) return;
    
    if (!confirm('Bạn có chắc muốn khóa video này? Video sẽ chuyển sang trạng thái inactive.')) {
      return;
    }

    setDeleting(true);
    setMsg(null);

    try {
      const response = await fetch('/api/training-videos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: video.id,
          status: 'inactive'
        })
      });

      const data = await response.json();
      if (data.success) {
        setVideo({ ...video, status: 'inactive' });
        setMsg("Đã khóa video thành công!");
        setTimeout(() => {
          router.push('/admin/page5');
        }, 1000);
      } else {
        setMsg("Lỗi: " + data.error);
      }
    } catch (err) {
      console.error('Error locking video:', err);
      setMsg("Lỗi khi khóa video");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-white/50 backdrop-blur rounded-lg w-64 animate-pulse"></div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 space-y-4">
                <div className="w-full aspect-video bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl animate-pulse"></div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 space-y-2 shadow-md shadow-blue-100/50 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                    <div className="h-8 bg-gray-300 rounded w-12"></div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-6 space-y-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
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
            onClick={() => router.back()}
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy video</h2>
            <p className="text-gray-600 mb-6">{error || "Video này không tồn tại hoặc đã bị xóa"}</p>
            <button
              onClick={() => router.push('/admin/page5')}
              className="bg-[#a1001f] text-white px-6 py-3 rounded-xl hover:bg-[#8a0019] font-medium transition shadow-lg hover:shadow-xl"
            >
              Về danh sách video
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalStudents = video.students?.length || 0;
  const completedStudents = video.students?.filter(s => s.turnedIn).length || 0;
  const avgWatchPercentage = totalStudents > 0 
    ? Math.round(video.students!.reduce((sum, s) => sum + s.watched, 0) / totalStudents) 
    : 0;
  const avgGrade = video.students?.filter(s => s.grade !== null).length || 0;
  const avgGradeValue = avgGrade > 0
    ? (video.students!.filter(s => s.grade !== null).reduce((sum, s) => sum + (s.grade || 0), 0) / avgGrade).toFixed(1)
    : 'N/A';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-1 md:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-3">
          <button 
            className="mb-2 flex items-center gap-2 text-[#a1001f] hover:text-[#c41230] font-medium transition group" 
            onClick={() => router.push('/admin/page5')}
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Video Assignment
          </button>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{video.title}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  Lesson {video.lesson_number}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {video.duration_minutes} phút
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  {video.view_count} lượt xem
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                video.status === 'active' ? 'bg-green-100 text-green-700' : 
                video.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 
                'bg-gray-100 text-gray-700'
              }`}>
                {video.status === 'active' ? '✓ Active' : video.status === 'draft' ? '📝 Draft' : '🔒 Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {msg && (
          <div className={`mb-3 p-4 rounded-xl ${
            msg.startsWith('Lỗi') 
              ? 'bg-red-50 border border-red-200 text-red-700' 
              : 'bg-green-50 border border-green-200 text-green-700'
          } flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              {msg.startsWith('Lỗi') ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              )}
            </svg>
            <span className="font-medium">{msg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Column - Video & Stats */}
          <div className="lg:col-span-2 space-y-3">
            {/* Video Player */}
            <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 overflow-hidden">
              <div className="aspect-video bg-black relative group">
                <video
                  ref={videoRef}
                  src={video.video_link}
                  controls
                  className="w-full h-full"
                  poster={video.thumbnail_url || undefined}
                />
                {questions.length > 0 && (
                  <div className="absolute bottom-16 left-0 right-0 px-4 opacity-0 group-hover:opacity-100 transition">
                    <div className="relative h-1 bg-white/30 rounded-full overflow-hidden">
                      {questions.map((q, idx) => (
                        <div
                          key={idx}
                          className="absolute top-0 bottom-0 w-1 bg-yellow-400 hover:bg-yellow-300 cursor-pointer"
                          style={{ left: `${(q.time / (video.duration_minutes * 60)) * 100}%` }}
                          title={`${Math.floor(q.time / 60)}:${String(q.time % 60).padStart(2, '0')} - ${q.question}`}
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = q.time;
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {video.description && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <p className="text-sm text-gray-700 leading-relaxed">{video.description}</p>
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-[#a1001f] to-[#c41230] rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/80 text-sm font-medium">Học viên</span>
                  <svg className="w-5 h-5 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                </div>
                <div className="text-3xl font-bold">{totalStudents}</div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-100 text-sm font-medium">Hoàn thành</span>
                  <svg className="w-5 h-5 text-green-200" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-3xl font-bold">{completedStudents}</div>
                <div className="text-green-100 text-xs mt-1">{totalStudents > 0 ? Math.round((completedStudents / totalStudents) * 100) : 0}%</div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-100 text-sm font-medium">Xem TB</span>
                  <svg className="w-5 h-5 text-purple-200" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-3xl font-bold">{avgWatchPercentage}%</div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-orange-100 text-sm font-medium">Điểm TB</span>
                  <svg className="w-5 h-5 text-orange-200" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div className="text-3xl font-bold">{avgGradeValue}</div>
              </div>
            </div>

            {/* Tabs Section */}
            <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 overflow-hidden">
              {/* Tab Headers */}
              <div className="flex border-b bg-gradient-to-r from-gray-50 to-gray-100">
                <button
                  onClick={() => setTab('student')}
                  className={`flex-1 px-6 py-4 font-semibold transition relative ${
                    tab === 'student'
                      ? 'text-[#a1001f] bg-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    Học viên ({totalStudents})
                  </span>
                  {tab === 'student' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#a1001f] to-[#c41230]"></div>
                  )}
                </button>
                <button
                  onClick={() => setTab('question')}
                  className={`flex-1 px-6 py-4 font-semibold transition relative ${
                    tab === 'question'
                      ? 'text-[#a1001f] bg-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Câu hỏi ({questions.length})
                  </span>
                  {tab === 'question' && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#a1001f] to-[#c41230]"></div>
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-4">
                {tab === 'student' ? (
                  <div className="overflow-x-auto">
                    {totalStudents > 0 ? (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Học viên</th>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Tiến độ</th>
                            <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Điểm</th>
                            <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Lần làm</th>
                            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Xem lần cuối</th>
                            <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {video.students!.map((s, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition">
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a1001f] to-[#c41230] flex items-center justify-center text-white font-semibold">
                                    {s.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-medium text-gray-900">{s.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all ${
                                        s.watched >= 80 ? 'bg-green-500' : 
                                        s.watched >= 50 ? 'bg-yellow-500' : 
                                        'bg-red-500'
                                      }`}
                                      style={{width: `${s.watched}%`}}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-medium text-gray-700 w-12 text-right">{s.watched}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1 rounded-full text-sm font-semibold ${
                                  s.grade !== null 
                                    ? s.grade >= 8 ? 'bg-green-100 text-green-700' :
                                      s.grade >= 6 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {s.grade !== null ? s.grade : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm text-gray-700">{s.attempts}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-gray-600">{s.lastWatched}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                {s.turnedIn ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Đã nộp
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    Chưa nộp
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có học viên</h3>
                        <p className="text-gray-600">Chưa có học viên nào được assign video này</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Câu hỏi tương tác</h3>
                      <button
                        onClick={() => {
                          setShowAdd(true);
                          setEditingQuestionIndex(null);
                          if (videoRef.current) {
                            setAddTime(Math.floor(videoRef.current.currentTime).toString());
                          }
                        }}
                        className="flex items-center gap-2 bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white px-4 py-2 rounded-xl hover:shadow-lg hover:from-[#8a0019] hover:to-[#a1001f] transition font-medium"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Thêm câu hỏi
                      </button>
                    </div>

                    {questions.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 bg-gradient-to-br from-[#a1001f]/10 to-[#c41230]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-10 h-10 text-[#a1001f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có câu hỏi</h3>
                        <p className="text-gray-600 mb-4">Thêm câu hỏi tương tác để tăng engagement</p>
                        <button
                          onClick={() => setShowAdd(true)}
                          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white px-6 py-3 rounded-xl hover:from-[#8a0019] hover:to-[#a1001f] transition font-medium shadow-lg hover:shadow-xl"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Thêm câu hỏi đầu tiên
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {questions
                          .sort((a, b) => a.time - b.time)
                          .map((q, idx) => (
                          <div 
                            key={idx} 
                            className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:shadow-md transition group"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <span className="inline-flex items-center gap-1 bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white px-3 py-1 rounded-lg text-sm font-semibold">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    {Math.floor(q.time / 60)}:{String(q.time % 60).padStart(2, '0')}
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (videoRef.current) {
                                        videoRef.current.currentTime = q.time;
                                        videoRef.current.scrollIntoView({ behavior: 'smooth' });
                                      }
                                    }}
                                    className="text-[#a1001f] hover:text-[#c41230] text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                    </svg>
                                    Chuyển đến
                                  </button>
                                </div>
                                <div className="mb-3">
                                  <p className="text-gray-900 font-medium">{q.question}</p>
                                </div>
                                <div className="space-y-2">
                                  {q.options.map((opt, i) => (
                                    <div 
                                      key={i}
                                      className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                                        i === q.answer 
                                          ? 'bg-green-100 text-green-800 font-semibold border border-green-300' 
                                          : 'bg-white text-gray-700 border border-gray-200'
                                      }`}
                                    >
                                      {i === q.answer ? (
                                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                      ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-gray-400"></div>
                                      )}
                                      <span>{opt}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  if (confirm('Bạn có chắc muốn xóa câu hỏi này?')) {
                                    if (q.id) {
                                      await deleteQuestionFromDb(q.id);
                                    }
                                    setQuestions(questions.filter((_, i) => i !== idx));
                                  }
                                }}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                                title="Xóa câu hỏi"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Info & Actions */}
          <div className="space-y-3">
            {/* Video Info Card */}
            <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#a1001f]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Thông tin
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <svg className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Ngày bắt đầu</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {new Date(video.start_date).toLocaleDateString('vi-VN', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <svg className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Được tạo</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {new Date(video.created_at).toLocaleDateString('vi-VN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <svg className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Câu hỏi tương tác</div>
                    <div className="text-sm font-semibold text-gray-900">{questions.length} câu hỏi</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="bg-white rounded-2xl shadow-lg shadow-blue-100/50 p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#a1001f]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Thao tác
              </h3>
              <div className="space-y-3">
                {video.status === 'inactive' && (
                  <button
                    onClick={() => router.push(`/admin/video-setup?id=${video.id}`)}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white px-4 py-3 rounded-xl hover:shadow-lg hover:from-[#8a0019] hover:to-[#a1001f] transition font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Chỉnh sửa video
                  </button>
                )}
                
                <button
                  onClick={() => handleUpdateStatus('active')}
                  disabled={assigning || video.status === 'active'}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-3 rounded-xl hover:shadow-lg hover:from-green-600 hover:to-green-700 transition font-medium disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed"
                >
                  {assigning ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {video.status === 'active' ? 'Đã assign' : 'Assign video'}
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleUpdateStatus('draft')}
                  disabled={drafting || video.status === 'draft'}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-4 py-3 rounded-xl hover:shadow-lg hover:from-yellow-600 hover:to-yellow-700 transition font-medium disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed"
                >
                  {drafting ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {video.status === 'draft' ? 'Đang ở draft' : 'Lưu draft'}
                    </>
                  )}
                </button>

                {(video.status === 'active' || video.status === 'draft') && (
                  <button
                    onClick={handleLockVideo}
                    disabled={deleting}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-3 rounded-xl hover:shadow-lg hover:from-red-600 hover:to-red-700 transition font-medium disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed"
                  >
                    {deleting ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Đang khóa...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Khóa video
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-[#a1001f] to-[#c41230] rounded-2xl shadow-lg shadow-red-200/30 p-4 text-white">
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                Tóm tắt
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/70">Tỷ lệ hoàn thành</span>
                  <span className="text-2xl font-bold">
                    {totalStudents > 0 ? Math.round((completedStudents / totalStudents) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all"
                    style={{width: `${totalStudents > 0 ? (completedStudents / totalStudents) * 100 : 0}%`}}
                  ></div>
                </div>
                <div className="pt-3 border-t border-white/20 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-white/70 text-xs mb-1">Engagement</div>
                    <div className="text-xl font-bold">{avgWatchPercentage}%</div>
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">Điểm TB</div>
                    <div className="text-xl font-bold">{avgGradeValue}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal thêm câu hỏi */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Thêm câu hỏi tương tác</h2>
              <p className="text-white/80 text-sm mt-1">Tạo câu hỏi xuất hiện tại thời điểm cụ thể trong video</p>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Thời điểm (giây) *
                </label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={addTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (videoRef.current && val) {
                        const duration = videoRef.current.duration;
                        if (parseFloat(val) > duration) {
                          setAddTime(duration.toFixed(0));
                          return;
                        }
                      }
                      setAddTime(val);
                    }}
                    max={videoRef.current?.duration || undefined}
                    className="flex-1 border-2 border-gray-200 focus:border-[#a1001f] focus:ring focus:ring-[#a1001f]/20 rounded-xl px-4 py-3 transition outline-none"
                    placeholder="Ví dụ: 30"
                  />
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        setAddTime(Math.floor(videoRef.current.currentTime).toString());
                      }
                    }}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition font-medium text-gray-700 whitespace-nowrap"
                  >
                    📍 Lấy hiện tại
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Video sẽ tự động dừng tại thời điểm này để hiển thị câu hỏi
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Câu hỏi *
                </label>
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full border-2 border-gray-200 focus:border-[#a1001f] focus:ring focus:ring-[#a1001f]/20 rounded-xl px-4 py-3 transition outline-none"
                  placeholder="Nhập câu hỏi..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Đáp án (chọn đáp án đúng)
                </label>
                <div className="space-y-2">
                  {newOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="answer"
                        checked={newAnswer === idx}
                        onChange={() => setNewAnswer(idx)}
                        className="w-5 h-5 text-[#a1001f] focus:ring-[#a1001f]"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const arr = [...newOptions];
                          arr[idx] = e.target.value;
                          setNewOptions(arr);
                        }}
                        className="flex-1 border-2 border-gray-200 focus:border-[#a1001f] focus:ring focus:ring-[#a1001f]/20 rounded-xl px-4 py-3 transition outline-none"
                        placeholder={`Đáp án ${idx + 1}`}
                      />
                      {newOptions.length > 2 && (
                        <button
                          onClick={() => {
                            setNewOptions(newOptions.filter((_, i) => i !== idx));
                            if (newAnswer === idx) setNewAnswer(0);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setNewOptions([...newOptions, ""])}
                  className="mt-3 text-[#a1001f] hover:text-[#c41230] text-sm font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Thêm đáp án
                </button>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAdd(false);
                  setNewQuestion("");
                  setNewOptions(["", ""]);
                  setNewAnswer(0);
                  setAddTime("");
                }}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition font-medium"
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  if (videoRef.current && parseFloat(addTime) > videoRef.current.duration) {
                    setAddTime(videoRef.current.duration.toFixed(0));
                    return;
                  }
                  const filteredOptions = newOptions.filter(opt => opt.trim());
                  if (!newQuestion.trim() || filteredOptions.length < 2) {
                    alert("Vui lòng điền đầy đủ câu hỏi và ít nhất 2 đáp án!");
                    return;
                  }
                  const newQ = { 
                    time: parseInt(addTime), 
                    question: newQuestion, 
                    options: filteredOptions, 
                    answer: newAnswer 
                  };
                  const dbId = await saveQuestionToDb(newQ);
                  if (dbId) {
                    setQuestions([...questions, { ...newQ, id: dbId }]);
                  }
                  setShowAdd(false);
                  setNewQuestion("");
                  setNewOptions(["", ""]);
                  setNewAnswer(0);
                  setAddTime("");
                }}
                className="px-6 py-3 bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white rounded-xl hover:from-[#8a0019] hover:to-[#a1001f] transition font-medium shadow-lg hover:shadow-xl"
              >
                Lưu câu hỏi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal hiển thị câu hỏi khi video đến thời điểm */}
      {showQuestionIdx !== null && questions[showQuestionIdx] && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Câu hỏi tương tác
              </h2>
            </div>
            
            <div className="p-6">
              <p className="text-lg font-semibold text-gray-900 mb-4">
                {questions[showQuestionIdx].question}
              </p>
              <div className="space-y-2">
                {questions[showQuestionIdx].options.map((opt, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
                      userAnswer === idx
                        ? 'border-[#a1001f] bg-[#a1001f]/5'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="userAnswer"
                      checked={userAnswer === idx}
                      onChange={() => setUserAnswer(idx)}
                      className="w-5 h-5 text-[#a1001f]"
                    />
                    <span className="text-gray-900">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl border-t">
              <button
                onClick={() => {
                  setShowQuestionIdx(null);
                  setUserAnswer(null);
                  if (videoRef.current) videoRef.current.play();
                }}
                className="w-full bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white px-6 py-3 rounded-xl hover:from-[#8a0019] hover:to-[#a1001f] transition font-medium shadow-lg hover:shadow-xl"
              >
                Tiếp tục video
              </button>
            </div>
          </div>
        </div>
      )}
<<<<<<< HEAD
      <div>
        <div className="flex gap-8 border-b mb-4">
          <button
            className={`pb-2 border-b-2 font-bold ${tab === 'student' ? 'border-yellow-400' : 'border-transparent'} transition`}
            onClick={() => setTab('student')}
          >Students</button>
          <button
            className={`pb-2 border-b-2 font-bold ml-4 ${tab === 'question' ? 'border-blue-400' : 'border-transparent'} transition`}
            onClick={() => setTab('question')}
          >Câu hỏi tương tác</button>
        </div>
        {tab === 'student' && (
          <div className="overflow-x-auto mb-8">
            {video.students && video.students.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-4 py-2">Student Name</th>
                    <th className="text-left px-4 py-2">Watched</th>
                    <th className="text-left px-4 py-2">Grade</th>
                    <th className="text-left px-4 py-2">Attempts</th>
                    <th className="text-left px-4 py-2">Last watched</th>
                    <th className="text-left px-4 py-2">Turned in</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {video.students.map((s, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-4 py-2">{s.name}</td>
                      <td className="px-4 py-2"><div className="w-32 h-2 bg-gray-200 rounded"><div className="h-2 bg-red-500 rounded" style={{width: s.watched + '%'}}></div></div></td>
                      <td className="px-4 py-2">{s.grade ?? '-'}</td>
                      <td className="px-4 py-2">{s.attempts}</td>
                      <td className="px-4 py-2">{s.lastWatched}</td>
                      <td className="px-4 py-2">{s.turnedIn ? <span className="text-green-600">✓ Turned in</span> : <span className="text-gray-500">✗ Not turned in</span>}</td>
                      <td className="px-2 py-2"><button className="p-1 rounded hover:bg-gray-100">⋯</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Chưa có học sinh nào được assign video này.
              </div>
            )}
          </div>
        )}
        {tab === 'question' && (
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h3 className="font-bold">Câu hỏi tương tác đã thêm</h3>
              <div className="flex items-center gap-2">
                <button
                  className="bg-slate-200 text-slate-700 px-3 py-1 rounded hover:bg-slate-300"
                  onClick={() => {
                    setPreviewMode(!previewMode);
                    if (previewMode) {
                      setShowQuestionIdx(null);
                      setUserAnswer(null);
                      if (videoRef.current) videoRef.current.play();
                    }
                  }}
                >
                  {previewMode ? 'Tắt xem thử câu hỏi' : 'Xem thử câu hỏi'}
                </button>
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                  onClick={() => {
                    if (videoRef.current) {
                      setAddTime(videoRef.current.currentTime.toFixed(1));
                    }
                    setShowAdd(true);
                  }}
                >
                  + Thêm câu hỏi
                </button>
              </div>
            </div>
            {questions.length === 0 && <div className="text-gray-500">Chưa có câu hỏi nào.</div>}
            <ul className="space-y-2">
              {questions.map((q, idx) => (
                <li key={idx} className="bg-white rounded shadow p-3 flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div><span className="font-semibold">Thời điểm:</span> {q.time}s</div>
                      <div><span className="font-semibold">Câu hỏi:</span> {q.question}</div>
                      <div>
                        <span className="font-semibold">Đáp án:</span>
                        <ol className="list-decimal ml-6">
                          {q.options.map((opt, i) => (
                            <li key={i} className={q.answer === i ? "font-bold text-green-600" : ""}>{opt}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        if (confirm('Bạn có chắc muốn xóa câu hỏi này?')) {
                          if (q.id) {
                            await deleteQuestionFromDb(q.id);
                          }
                          setQuestions(questions.filter((_, i) => i !== idx));
                        }
                      }}
                      className="text-red-500 hover:text-red-700 px-2 py-1"
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
=======
>>>>>>> 57865e52314c2e595a82dcd7dc0cb01da7b2bbc2
    </div>
  );
}

export default function VideoDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                <div className="w-full aspect-video bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <VideoDetailContent />
    </Suspense>
  );
}

