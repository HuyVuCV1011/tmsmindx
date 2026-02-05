"use client";

import { useRouter, useSearchParams } from "next/navigation";
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

export default function VideoDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoId = searchParams.get("id");
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          // Load questions from database
          loadQuestions(videoId);
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
  const [questions, setQuestions] = useState<Array<{id?: number, time: number, question: string, options: string[], answer: number}>>([]);
  const [tab, setTab] = useState<'student' | 'question'>('student');
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [newAnswer, setNewAnswer] = useState(0);
  const [addTime, setAddTime] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [assigning, setAssigning] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [showQuestionIdx, setShowQuestionIdx] = useState<number|null>(null);
  const [userAnswer, setUserAnswer] = useState<number|null>(null);

  // Tự động pause video khi đến thời điểm có câu hỏi
  useEffect(() => {
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
  }, [questions, showQuestionIdx]);

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
      <div className="max-w-6xl mx-auto p-6">
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
          {/* Video Info Card Skeleton */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
          </div>
          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 space-y-2 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
          {/* Table Skeleton */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <button className="mb-4 text-blue-600 hover:underline" onClick={() => router.back()}>&larr; Quay lại</button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error || "Không tìm thấy video"}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <button className="mb-4 text-blue-600 hover:underline" onClick={() => router.back()}>&larr; Video Assignment</button>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-6 items-center">
          <div className="w-64 h-40 bg-gray-200 flex items-center justify-center rounded relative">
            {video.video_link ? (
              <video ref={videoRef} src={video.video_link} controls className="w-full h-full rounded" />
            ) : (
              <span className="text-5xl text-gray-400">▶</span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">{video.title}</h1>
            <div className="text-gray-600 mb-1">Lesson: {video.lesson_number}</div>
            <div className="text-sm text-gray-500 mb-1">Ngày bắt đầu: <span className="font-medium">{new Date(video.start_date).toLocaleString('vi-VN')}</span></div>
            <div className="text-sm text-gray-500 mb-1">Thời lượng: <span className="font-medium">{video.duration_minutes} phút</span></div>
            <div className="text-sm text-gray-500 mb-1">Lượt xem: <span className="font-medium">{video.view_count}</span></div>
            <div className="text-sm text-gray-500 mb-2">Trạng thái: <span className={`font-medium ${video.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>{video.status === 'active' ? 'Đã assign' : 'Draft'}</span></div>
            {video.description && (
              <div className="text-sm text-gray-700 mb-2 p-2 bg-gray-50 rounded">
                {video.description}
              </div>
            )}
            {msg && <div className={`mt-2 text-sm p-2 rounded ${msg.startsWith('Lỗi') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>}
            <div className="mt-4 flex gap-2">
              {video.status === 'inactive' && (
                <button
                  className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
                  onClick={() => router.push(`/admin/video-setup?id=${video.id}`)}
                >
                  ✏️ Sửa Video
                </button>
              )}
              <button
                className="bg-green-500 text-white px-4 py-1 rounded hover:bg-green-600 disabled:bg-gray-300"
                disabled={assigning || video.status === 'active'}
                onClick={() => handleUpdateStatus('active')}
              >
                {assigning ? 'Đang xử lý...' : 'Assign Video'}
              </button>
              <button
                className="bg-gray-400 text-white px-4 py-1 rounded hover:bg-gray-500 disabled:bg-gray-300"
                disabled={drafting || video.status === 'draft'}
                onClick={() => handleUpdateStatus('draft')}
              >
                {drafting ? 'Đang xử lý...' : 'Lưu Draft'}
              </button>
              {(video.status === 'active' || video.status === 'draft') && (
                <button
                  className="bg-orange-500 text-white px-4 py-1 rounded hover:bg-orange-600 disabled:bg-gray-300"
                  disabled={deleting}
                  onClick={handleLockVideo}
                >
                  {deleting ? 'Đang khóa...' : '🔒 Khóa Video'}
                </button>
              )}
            </div>
            {msg && <div className="mt-2 text-green-600 font-semibold">{msg}</div>}
          </div>
        </div>
      </div>
      {/* Modal thêm câu hỏi tương tác */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2">Thêm câu hỏi tương tác</h2>
            <div className="mb-2">Thời điểm dừng (giây): <input type="number" min="0" step="0.1" value={addTime} onChange={e => {
              const val = e.target.value;
              // Check duration
              if (videoRef.current && val) {
                const duration = videoRef.current.duration;
                if (parseFloat(val) > duration) {
                  setAddTime(duration.toFixed(1));
                  return;
                }
              }
              setAddTime(val);
            }} className="border px-2 py-1 rounded w-24" max={videoRef.current?.duration || undefined} /></div>
            <div className="mb-2">Câu hỏi:<br/>
              <input type="text" value={newQuestion} onChange={e => setNewQuestion(e.target.value)} className="border px-2 py-1 rounded w-full" />
            </div>
            <div className="mb-2">Đáp án:
              {newOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-1">
                  <input type="radio" name="answer" checked={newAnswer === idx} onChange={() => setNewAnswer(idx)} />
                  <input type="text" value={opt} onChange={e => {
                    const arr = [...newOptions]; arr[idx] = e.target.value; setNewOptions(arr);
                  }} className="border px-2 py-1 rounded flex-1" />
                  {newOptions.length > 2 && <button onClick={() => {
                    setNewOptions(newOptions.filter((_, i) => i !== idx));
                    if (newAnswer === idx) setNewAnswer(0);
                  }} className="text-red-500">X</button>}
                </div>
              ))}
              <button className="text-blue-600 text-xs mt-1" onClick={() => setNewOptions([...newOptions, ""])}>+ Thêm đáp án</button>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="bg-yellow-500 text-white px-4 py-1 rounded hover:bg-yellow-600" onClick={async () => {
                if (videoRef.current && parseFloat(addTime) > videoRef.current.duration) {
                  setAddTime(videoRef.current.duration.toFixed(1));
                  return;
                }
                const filteredOptions = newOptions.filter(opt => opt.trim());
                if (!newQuestion.trim() || filteredOptions.length < 2) {
                  alert("Vui lòng điền câu hỏi và ít nhất 2 đáp án!");
                  return;
                }
                const newQ = { time: parseFloat(addTime), question: newQuestion, options: filteredOptions, answer: newAnswer };
                console.log('[Video Detail] Saving question:', newQ);
                const dbId = await saveQuestionToDb(newQ);
                console.log('[Video Detail] Saved with ID:', dbId);
                if (dbId) {
                  setQuestions([...questions, { ...newQ, id: dbId }]);
                }
                setShowAdd(false); setNewQuestion(""); setNewOptions(["", ""]); setNewAnswer(0);
              }}>Lưu</button>
              <button className="bg-gray-300 px-4 py-1 rounded" onClick={() => setShowAdd(false)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal hiển thị câu hỏi khi video đến thời điểm tương tác */}
      {showQuestionIdx !== null && questions[showQuestionIdx] && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2">Câu hỏi tương tác</h2>
            <div className="mb-2">{questions[showQuestionIdx].question}</div>
            <div className="mb-2">
              {questions[showQuestionIdx].options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-1">
                  <input type="radio" name="userAnswer" checked={userAnswer === idx} onChange={() => setUserAnswer(idx)} />
                  <span>{opt}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600" onClick={() => {
                setShowQuestionIdx(null); setUserAnswer(null);
                if (videoRef.current) videoRef.current.play();
              }}>Tiếp tục video</button>
            </div>
          </div>
        </div>
      )}
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
            <h3 className="font-bold mb-2">Câu hỏi tương tác đã thêm</h3>
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
    </div>
  );
}
