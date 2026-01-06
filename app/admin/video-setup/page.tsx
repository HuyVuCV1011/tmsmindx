"use client";

import { useSearchParams, useRouter } from "next/navigation";
import React, { useRef, useState, useEffect, Suspense } from "react";

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
  const videoId = searchParams.get("id");
  const videoRef = useRef<HTMLVideoElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

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

  // Assignment state
  const [assignmentForm, setAssignmentForm] = useState({
    assignment_title: "",
    assignment_type: "quiz",
    description: "",
    total_points: "10",
    passing_score: "7",
    time_limit_minutes: "30",
    max_attempts: "0",
    is_required: true,
    status: "published"
  });

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
          
          // Auto-fill assignment title from video title
          setAssignmentForm(prev => ({
            ...prev,
            assignment_title: `Assignment - ${currentVideo.title}`
          }));

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

  const handleAddQuestion = async () => {
    if (!newQuestion || newOptions.some(opt => !opt)) {
      alert("Vui lòng điền đầy đủ câu hỏi và các đáp án!");
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
    if (confirm("Bạn có chắc muốn xóa câu hỏi này?")) {
      const question = questions[index];
      if (question.id) {
        await deleteQuestionFromDb(question.id);
      }
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const handleSaveAssignment = async () => {
    if (!video) return;

    try {
      const response = await fetch('/api/training-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: video.id,
          ...assignmentForm,
          total_points: parseFloat(assignmentForm.total_points),
          passing_score: parseFloat(assignmentForm.passing_score),
          time_limit_minutes: parseInt(assignmentForm.time_limit_minutes),
          max_attempts: parseInt(assignmentForm.max_attempts)
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Tạo assignment thành công! Chuyển sang trang thêm câu hỏi...');
        // Redirect to assignment questions page
        const assignmentId = data.data?.id || data.id;
        if (assignmentId) {
          router.push(`/admin/assignment-questions?assignment_id=${assignmentId}`);
        }
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error creating assignment:', err);
      alert('Lỗi khi tạo assignment');
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
        alert('Lỗi khi upload thumbnail: ' + (data.error || 'Unknown error'));
        return null;
      }
    } catch (err) {
      console.error('Error uploading thumbnail:', err);
      alert('Lỗi khi upload thumbnail');
      return null;
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleSaveVideo = async (status: 'draft' | 'active') => {
    if (!video) return;
    
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
          id: video.id,
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
        alert(status === 'draft' ? 'Lưu draft thành công!' : 'Giao bài thành công!');
        router.push('/admin/page5');
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error saving video:', err);
      alert('Lỗi khi lưu video');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div>Đang tải thông tin video...</div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">
            {error || "Không tìm thấy video"}
          </div>
          <button
            onClick={() => router.push('/admin/page5')}
            className="px-4 py-2 bg-gray-600 text-white rounded"
          >
            Quay lại danh sách video
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={() => router.push('/admin/page5')}
              className="text-blue-600 hover:underline mb-2"
            >
              ← Quay lại danh sách video
            </button>
            <h1 className="text-3xl font-bold">Setup Video: {videoForm.title}</h1>
            <p className="text-gray-600 mt-1">Chỉnh sửa thông tin video, thêm câu hỏi và tạo assignment</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleSaveVideo('draft')}
              disabled={saving}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium disabled:bg-gray-400"
            >
              {saving ? 'Đang lưu...' : 'Lưu Draft'}
            </button>
            <button
              onClick={() => handleSaveVideo('active')}
              disabled={saving}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium disabled:bg-green-400"
            >
              {saving ? 'Đang lưu...' : 'Giao bài'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Video Preview & Info */}
          <div className="space-y-4">
            {/* Video Player */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Preview Video</h2>
              <div className="aspect-video bg-gray-900 rounded overflow-hidden">
                <video
                  ref={videoRef}
                  src={video.video_link}
                  controls
                  className="w-full h-full"
                />
              </div>
              {/* Video info display below video */}
              <div className="mt-3 flex gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Thời lượng:</span>
                  <span>{videoForm.duration_minutes} phút</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  <span className="font-medium">Lesson:</span>
                  <span>#{videoForm.lesson_number}</span>
                </div>
              </div>
            </div>

            {/* Video Info Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Thông tin Video</h2>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium text-sm">Tên video *</label>
                  <input
                    type="text"
                    value={videoForm.title}
                    onChange={(e) => setVideoForm({...videoForm, title: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Ví dụ: LESSON 01: Kỹ năng trao đổi với PHHS"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium text-sm">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={videoForm.start_date}
                    onChange={(e) => setVideoForm({...videoForm, start_date: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium text-sm">Mô tả</label>
                  <textarea
                    value={videoForm.description}
                    onChange={(e) => setVideoForm({...videoForm, description: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    rows={3}
                    placeholder="Mô tả về video..."
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium text-sm">Thumbnail</label>
                  <input
                    type="file"
                    ref={thumbnailInputRef}
                    onChange={handleThumbnailChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex gap-3 items-center">
                    {thumbnailPreview ? (
                      <div className="relative w-32 h-20 bg-gray-100 rounded overflow-hidden">
                        <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                        <button
                          onClick={() => {
                            setThumbnailPreview("");
                            setThumbnailFile(null);
                            setVideoForm({...videoForm, thumbnail_url: ""});
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-20 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                        <span className="text-2xl">🖼️</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      disabled={uploadingThumbnail}
                    >
                      {uploadingThumbnail ? 'Đang tải...' : thumbnailPreview ? 'Đổi ảnh' : 'Chọn ảnh'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Tabs for Questions and Assignment */}
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* Tab Headers */}
            <div className="flex border-b mb-4">
              <button
                onClick={() => setActiveTab('questions')}
                className={`px-4 py-2 font-medium border-b-2 transition ${
                  activeTab === 'questions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Câu hỏi trong video ({questions.length})
              </button>
              <button
                onClick={() => setActiveTab('assignment')}
                className={`px-4 py-2 font-medium border-b-2 transition ${
                  activeTab === 'assignment'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Tạo Assignment
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'questions' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Interactive Questions</h3>
                  <button
                    onClick={() => {
                      setShowQuestionForm(true);
                      setEditingQuestionIndex(null);
                      getCurrentTime();
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                  >
                    + Thêm câu hỏi
                  </button>
                </div>

                {/* Questions List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {questions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Chưa có câu hỏi nào. Nhấn "Thêm câu hỏi" để bắt đầu.
                    </div>
                  ) : (
                    questions.map((q, idx) => (
                      <div key={idx} className="border rounded p-3 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                {Math.floor(q.time / 60)}:{String(q.time % 60).padStart(2, '0')}
                              </span>
                              <span className="font-medium text-sm">{q.question}</span>
                            </div>
                            <div className="space-y-1">
                              {q.options.map((opt, i) => (
                                <div key={i} className={`text-sm pl-4 ${i === q.answer ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                                  {i === q.answer ? '✓ ' : '○ '}{opt}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditQuestion(idx)}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(idx)}
                              className="text-red-600 hover:text-red-700 text-sm"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Question Form Modal */}
                {showQuestionForm && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                      <h3 className="text-xl font-bold mb-4">
                        {editingQuestionIndex !== null ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block mb-1 font-medium text-sm">Thời điểm (giây)</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={addTime}
                              onChange={(e) => setAddTime(e.target.value)}
                              className="flex-1 border rounded px-3 py-2"
                              placeholder="Ví dụ: 30"
                            />
                            <button
                              onClick={getCurrentTime}
                              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              Lấy thời điểm hiện tại
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block mb-1 font-medium text-sm">Câu hỏi *</label>
                          <input
                            type="text"
                            value={newQuestion}
                            onChange={(e) => setNewQuestion(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                            placeholder="Nhập câu hỏi..."
                          />
                        </div>

                        <div>
                          <label className="block mb-2 font-medium text-sm">Các đáp án</label>
                          {newOptions.map((opt, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                              <input
                                type="radio"
                                name="answer"
                                checked={newAnswer === i}
                                onChange={() => setNewAnswer(i)}
                                className="mt-2"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...newOptions];
                                  updated[i] = e.target.value;
                                  setNewOptions(updated);
                                }}
                                className="flex-1 border rounded px-3 py-2"
                                placeholder={`Đáp án ${i + 1}`}
                              />
                            </div>
                          ))}
                          <p className="text-xs text-gray-500 mt-1">Chọn radio button để đánh dấu đáp án đúng</p>
                        </div>

                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => {
                              setShowQuestionForm(false);
                              setEditingQuestionIndex(null);
                              setNewQuestion("");
                              setNewOptions(["", "", "", ""]);
                              setNewAnswer(0);
                              setAddTime("");
                            }}
                            className="px-4 py-2 border rounded hover:bg-gray-100"
                          >
                            Hủy
                          </button>
                          <button
                            onClick={handleAddQuestion}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            {editingQuestionIndex !== null ? 'Cập nhật' : 'Thêm'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Tạo Assignment cho video</h3>
                
                <div>
                  <label className="block mb-1 font-medium text-sm">Tên Assignment *</label>
                  <input
                    type="text"
                    value={assignmentForm.assignment_title}
                    onChange={(e) => setAssignmentForm({...assignmentForm, assignment_title: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 font-medium text-sm">Loại</label>
                    <select
                      value={assignmentForm.assignment_type}
                      onChange={(e) => setAssignmentForm({...assignmentForm, assignment_type: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="quiz">Quiz</option>
                      <option value="test">Test</option>
                      <option value="homework">Homework</option>
                      <option value="project">Project</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-sm">Trạng thái</label>
                    <select
                      value={assignmentForm.status}
                      onChange={(e) => setAssignmentForm({...assignmentForm, status: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 font-medium text-sm">Mô tả</label>
                  <textarea
                    value={assignmentForm.description}
                    onChange={(e) => setAssignmentForm({...assignmentForm, description: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 font-medium text-sm">Điểm tối đa</label>
                    <input
                      type="number"
                      step="0.01"
                      value={assignmentForm.total_points}
                      onChange={(e) => setAssignmentForm({...assignmentForm, total_points: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-sm">Điểm đạt</label>
                    <input
                      type="number"
                      step="0.01"
                      value={assignmentForm.passing_score}
                      onChange={(e) => setAssignmentForm({...assignmentForm, passing_score: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 font-medium text-sm">Thời gian (phút)</label>
                    <input
                      type="number"
                      value={assignmentForm.time_limit_minutes}
                      onChange={(e) => setAssignmentForm({...assignmentForm, time_limit_minutes: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-sm">Số lần làm tối đa</label>
                    <input
                      type="number"
                      value={assignmentForm.max_attempts}
                      onChange={(e) => setAssignmentForm({...assignmentForm, max_attempts: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="0 = không giới hạn"
                    />
                    <p className="text-xs text-gray-500 mt-1">Để 0 để không giới hạn số lần nộp</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={assignmentForm.is_required}
                    onChange={(e) => setAssignmentForm({...assignmentForm, is_required: e.target.checked})}
                    className="mr-2"
                  />
                  <label className="text-sm">Bắt buộc hoàn thành</label>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    onClick={handleSaveAssignment}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                  >
                    Tạo Assignment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VideoSetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">Đang tải...</div>}>
      <VideoSetupContent />
    </Suspense>
  );
}
