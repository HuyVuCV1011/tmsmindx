'use client';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from "@/lib/auth-context";
import { setVideo } from "@/lib/redux/features/trainingSlice";
import { useAppDispatch } from "@/lib/redux/hooks";
import { useTeacher } from "@/lib/teacher-context";
import { Award, BookOpen, CheckCircle, Clock, FileText } from 'lucide-react';
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import AssignmentsPage from "../assignments/page";

interface TrainingLesson {
  id: number;
  name: string;
  score: number;
  link?: string;
  thumbnail_url?: string;
  description?: string;
  duration_minutes?: number;
  lesson_number?: number;
  completion_status?: string;
  completed_at?: string;
  time_spent_seconds?: number;
}

interface TrainingAssignment {
  id: number;
  assignment_title: string;
  description: string;
  video_id: number;
  assignment_type: string;
  passing_score: number;
  max_attempts: number;
  time_limit_minutes: number;
}

interface TrainingData {
  no: string;
  fullName: string;
  code: string;
  userName: string;
  workEmail: string;
  phoneNumber: string;
  status: string;
  centers: string;
  khoiFinal: string;
  position: string;
  averageScore: number;
  lessons: TrainingLesson[];
}

interface Teacher {
  code: string;
  name: string;
  emailMindx: string;
  emailPersonal: string;
}

const API_SECRET_KEY = process.env.NEXT_PUBLIC_API_SECRET || 'mindx-teaching-internal-2025';

function extractCodeFromEmail(email: string): string {
  const match = email.match(/^([^@]+)@/);
  return match ? match[1] : '';
}

export default function TrainingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const startAssignmentId = searchParams.get('start_assignment_id');

  const [tab, setTab] = useState<'lessons' | 'stats' | 'tests'>('lessons');
  const [submitCode, setSubmitCode] = useState("");
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const [isResolvingCode, setIsResolvingCode] = useState(false);

  const { teacherProfile, isLoading: isTeacherLoading } = useTeacher();

  // ── Guard: block non-admin users if teacher profile is missing ──
  const [missingProfile, setMissingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Skip check while loading
    if (isTeacherLoading) return;

    const isAdmin = (user as any).role === 'admin' || (user as any).isAdmin === true;
    if (isAdmin) return;
    
    if (!teacherProfile) {
      setMissingProfile(true);
    } else {
      setMissingProfile(false);
    }
  }, [user, isTeacherLoading, teacherProfile]);

  const handleForceLogout = () => {
    try {
      localStorage.removeItem('teacher_auto_fill_data');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    } catch {}
    router.push('/login');
  };

  const secureFetcher = useCallback(async (url: string) => {
    let token = localStorage.getItem('token');

    const doFetch = async (tok: string | null) => {
      const headers: HeadersInit = {
        'x-api-key': API_SECRET_KEY
      };
      if (tok) headers['Authorization'] = `Bearer ${tok}`;

      const res = await fetch(url, { headers });
      return res;
    };

    let response = await doFetch(token);

    if (response.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
          const refreshRes = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=refresh_token&refresh_token=${refreshToken}`
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newIdToken = refreshData.id_token;
            const newRefreshToken = refreshData.refresh_token;

            if (newIdToken) {
              localStorage.setItem('token', newIdToken);
              if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
              token = newIdToken;
              response = await doFetch(token);
            }
          }
        } catch (e) {
          console.warn('Silent token refresh failed', e);
        }
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }

      const error: any = new Error('An error occurred while fetching the data.');
      try {
        error.info = await response.json();
      } catch (e) {
        error.info = null;
      }
      error.status = response.status;
      throw error;
    }

    return response.json();
  }, []);

  // Auto-search based on logged-in user's email
  useEffect(() => {
    if (user && user.email && !hasAutoSearched && !submitCode) {
      setHasAutoSearched(true);
      setIsResolvingCode(true);

      (async () => {
        try {
          const res = await secureFetcher(`/api/teachers?email=${encodeURIComponent(user.email)}&basic=1`);
          if (res?.teacher?.code) {
            setSubmitCode(res.teacher.code);
            setIsResolvingCode(false);
            return;
          }
        } catch (err) {
          console.warn('Email-based lookup failed, falling back to code extraction');
        }

        const code = extractCodeFromEmail(user.email);
        if (code) {
          setSubmitCode(code);
        }

        setIsResolvingCode(false);
      })();
    }
  }, [user, hasAutoSearched, submitCode, secureFetcher]);

  const { data: teacherData, isLoading: isLoadingTeacher } = useSWR(
    submitCode && user ? `/api/teachers?code=${submitCode}` : null,
    secureFetcher,
    { 
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 120000,
      shouldRetryOnError: false
    }
  );

  const teacher = teacherData?.teacher || null;

  const { data: trainingData, isLoading: isLoadingTraining } = useSWR(
    teacher && user ? `/api/training-db?code=${submitCode}` : null,
    secureFetcher,
    { 
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 120000,
      shouldRetryOnError: false
    }
  );

  const { data: assignmentsData, isLoading: isLoadingAssignments } = useSWR(
    teacher && user ? `/api/training-assignments?status=published&teacher_code=${teacher.code}` : null,
    secureFetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 120000
    }
  );


  const completedLessons = useMemo(() => {
    if (!trainingData?.lessons) return 0;
    return trainingData.lessons.filter((l: TrainingLesson) => 
      l.completion_status === 'completed'
    ).length;
  }, [trainingData]);

  const handleLessonClick = (lesson: TrainingLesson, index: number) => {
    if (lesson.link) {
      console.log('[Training] Opening lesson:', { id: lesson.id, name: lesson.name, index: index + 1 });
      dispatch(setVideo({
        id: lesson.id,
        link: lesson.link,
        duration: lesson.duration_minutes || 0,
        title: lesson.name
      }));
      router.push(`/user/training/lesson?id=${lesson.id}`);
    }
  };

  if (startAssignmentId) {
      return <AssignmentsPage />;
  }

  // localStorage guard modal
  if (missingProfile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Phiên làm việc không hợp lệ</h2>
          <p className="text-slate-500 text-sm mb-6">
            Không tìm thấy thông tin giáo viên trong hệ thống. Vui lòng đăng xuất và đăng nhập lại để tiếp tục.
          </p>
          <button
            onClick={handleForceLogout}
            className="w-full bg-[#a1001f] text-white font-semibold py-2.5 rounded-xl hover:bg-[#80001a] transition-colors"
          >
            Đăng xuất và đăng nhập lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="w-full">
        {/* Header */}

        <div className="bg-linear-to-r from-[#a1001f] to-[#c41230] text-white rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
            </svg>
            <div>
              <h1 className="text-2xl font-bold">Đào tạo nâng cao</h1>
              <p className="text-sm opacity-90 mt-1">Điểm học trực tuyến - {trainingData?.lessons?.length || 0} bài học</p>
            </div>
          </div>
        </div>

        {/* Always show content structure with skeleton when loading */}
        <div className="flex gap-6 border-b mb-6">
          <button
            className={`pb-3 px-2 border-b-2 font-bold transition-colors ${
              tab === 'lessons' 
                ? 'border-[#a1001f] text-[#a1001f]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab('lessons')}
          >
            Bài học nâng cao
          </button>
          <button
            className={`pb-3 px-2 border-b-2 font-bold transition-colors ${
              tab === 'stats' 
                ? 'border-[#a1001f] text-[#a1001f]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab('stats')}
          >
            Thống kê điểm số
          </button>
          <button
            className={`pb-3 px-2 border-b-2 font-bold transition-colors ${
              tab === 'tests' 
                ? 'border-[#a1001f] text-[#a1001f]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab('tests')}
          >
            Bài kiểm tra
          </button>
        </div>

        {/* Loading Skeleton or Content */}
        {(isResolvingCode || isLoadingTeacher || isLoadingTraining) ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4" style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="aspect-video bg-gray-200 rounded mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : trainingData ? (
          <>
            {/* Tab: Bài học nâng cao */}
            {tab === 'lessons' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-[#a1001f]">Danh sách bài học</h2>
                  
                  {/* Progress Bar */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <div className="text-sm text-gray-600 mb-1">
                        Tiến độ: <span className="font-bold text-[#a1001f]">{completedLessons}/{trainingData.lessons.length}</span>
                      </div>
                      <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-linear-to-r from-[#a1001f] to-[#c41230] transition-all duration-500 ease-out"
                          style={{ 
                            width: `${trainingData.lessons.length > 0 ? (completedLessons / trainingData.lessons.length * 100) : 0}%` 
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {trainingData.lessons.length > 0 ? Math.round(completedLessons / trainingData.lessons.length * 100) : 0}% hoàn thành
                      </div>
                    </div>
                  </div>
                </div>
                {trainingData.lessons.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Chưa có video nào được giao
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {trainingData.lessons.map((lesson: TrainingLesson, idx: number) => {
                      const isCompleted = lesson.completion_status === 'completed';
                      const notStarted = lesson.score === 0;
                      const passed = lesson.score >= 7;
                      const lessonNumber = lesson.lesson_number || (idx + 1);

                      return (
                        <div 
                          key={lesson.id || idx}
                          className={`flex gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer ${
                            isCompleted 
                              ? 'border-green-300 bg-green-50/30' 
                              : 'border-gray-200'
                          }`}
                          onClick={() => handleLessonClick(lesson, idx)}
                        >
                          {/* Thumbnail */}
                          <div className="shrink-0 relative">
                            <div className="w-40 h-24 bg-gray-200 rounded-lg overflow-hidden">
                              {lesson.thumbnail_url ? (
                                <img 
                                  src={lesson.thumbnail_url} 
                                  alt={lesson.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIGZpbGw9IiNlNWU3ZWIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzljYTNhZiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0Ij5WaWRlbzwvdGV4dD48L3N2Zz4=';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-rose-100 to-red-100">
                                  <svg className="w-12 h-12 text-[#a1001f]/60" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {/* Duration badge - Hide default 30 min placeholder */}
                            {lesson.duration_minutes && lesson.duration_minutes !== 30 && (
                              <div className="absolute bottom-1 right-1 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded">
                                {lesson.duration_minutes} phút
                              </div>
                            )}
                            {/* Completion badge */}
                            {isCompleted && (
                              <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Video Info */}
                          <div className="grow min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="grow">
                                <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">
                                  {lesson.name}
                                </h3>
                                {lessonNumber && (
                                  <span className="inline-block bg-rose-100 text-[#a1001f] text-xs font-medium px-2 py-1 rounded">
                                    LESSON {lessonNumber.toString().padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                isCompleted
                                  ? 'bg-green-100 text-green-800'
                                  : notStarted 
                                    ? 'bg-gray-100 text-gray-800'
                                    : passed 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {isCompleted ? '✓ Hoàn thành' : notStarted ? 'Chưa học' : passed ? '✓ Đã đạt' : 'Điểm: ' + lesson.score.toFixed(1)}
                              </span>
                            </div>
                            
                            {/* Progress info if not completed but started */}
                            {!isCompleted && (lesson.time_spent_seconds ?? 0) > 0 && (
                                <div className="mb-2">
                                    <div className="flex justify-between text-xs text-[#a1001f] mb-1">
                                        <span>Đang học</span>
                                        <span>{Math.round(((lesson.time_spent_seconds || 0) / ((lesson.duration_minutes || 1) * 60)) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                      <div className="bg-[#c41230] h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.round(((lesson.time_spent_seconds || 0) / ((lesson.duration_minutes || 1) * 60)) * 100))}%` }}></div>
                                    </div>
                                </div>
                            )}

                            {lesson.description && (
                              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                {lesson.description}
                              </p>
                            )}

                            {/* Quiz Button */}
                            {(() => {
                              const assignmentList = assignmentsData?.data || [];
                              const assignment = assignmentList.find((a: any) => a.video_id === lesson.id);
                              
                              if (!assignment) return null;
                              
                              return (
                                <div className="mt-2 mb-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isCompleted) {
                                        router.push(`/user/training?start_assignment_id=${assignment.id}`);
                                      }
                                    }}
                                    disabled={!isCompleted}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                      isCompleted 
                                        ? 'bg-[#a1001f] text-white hover:bg-[#8a001a] shadow-md hover:scale-105 active:scale-95' 
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                    }`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                    Làm bài kiểm tra
                                    {!isCompleted && <span className="text-xs ml-1 opacity-70">(Hoàn thành video để mở)</span>}
                                  </button>
                                </div>
                              );
                            })()}
                            
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              {lesson.completed_at && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Hoàn thành: {new Date(lesson.completed_at).toLocaleDateString('vi-VN')}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Video #{idx + 1}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Thống kê điểm số */}
            {tab === 'stats' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4 text-[#a1001f]">Thống kê điểm số các bài học</h2>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2 border-gray-200">
                        <TableHead className="uppercase font-bold text-gray-700">Lesson</TableHead>
                        <TableHead className="uppercase font-bold text-gray-700">Tên bài học</TableHead>
                        <TableHead className="text-center uppercase font-bold text-gray-700">Điểm số</TableHead>
                        <TableHead className="text-center uppercase font-bold text-gray-700">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trainingData.lessons.map((lesson: TrainingLesson, idx: number) => {
                        const notStarted = lesson.score === 0;
                        const passed = lesson.score >= 7;
                        
                        return (
                          <TableRow key={idx} className="hover:bg-gray-50 transition-colors">
                            <TableCell className="font-medium text-[#a1001f]">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="text-gray-900">
                              {lesson.name.replace(/^Lesson \d+:\s*/, '')}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`text-lg font-bold ${
                                notStarted ? 'text-gray-400' : passed ? 'text-green-600' : 'text-yellow-600'
                              }`}>
                                {notStarted ? '—' : lesson.score.toFixed(1)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                notStarted 
                                  ? 'bg-gray-100 text-gray-700'
                                  : passed 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {notStarted ? 'Chưa học' : passed ? 'Đạt' : 'Cần cải thiện'}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Stats Summary */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                    <div className="text-sm text-gray-600 mb-1">Điểm trung bình</div>
                    <div className="text-2xl font-bold text-[#a1001f]">
                      {trainingData.averageScore?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="text-sm text-gray-600 mb-1">Bài học hoàn thành</div>
                    <div className="text-2xl font-bold text-green-600">
                      {completedLessons}/{trainingData.lessons.length}
                    </div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <div className="text-sm text-gray-600 mb-1">Tỷ lệ hoàn thành</div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {trainingData.lessons.length > 0 ? ((completedLessons / trainingData.lessons.length) * 100).toFixed(0) : 0}%
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Tab: Bài kiểm tra */}
            {tab === 'tests' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4 text-[#a1001f]">Bài kiểm tra & Bài tập</h2>
                {isLoadingAssignments ? (
                   <div className="text-center py-4">Đang tải danh sách bài tập...</div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {assignmentsData?.data?.filter((a: any) => {
                      if (!a.video_id) return false;
                      const linkedVideo = trainingData?.lessons?.find((l: any) => l.id === a.video_id);
                      return !!linkedVideo;
                    }).length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500">
                            Không có bài kiểm tra nào được tìm thấy
                        </div>
                    )}
                    {assignmentsData?.data?.filter((a: any) => {
                        if (!a.video_id) return false;
                        const linkedVideo = trainingData?.lessons?.find((l: any) => l.id === a.video_id);
                        return !!linkedVideo;
                    }).map((assignment: any) => {
                        const linkedVideo = trainingData?.lessons?.find((l: any) => l.id === assignment.video_id);
                        const isLocked = !linkedVideo || linkedVideo.completion_status !== 'completed';
                        
                        return (
                          <div
                            key={assignment.id}
                            className={`bg-white rounded-lg shadow-sm border hover:shadow-md transition-all overflow-hidden group flex flex-col ${
                              isLocked ? 'border-gray-200 opacity-75' : 'border-gray-200'
                            }`}
                          >
                            <div className={`p-3 text-white ${isLocked ? 'bg-gray-400' : 'bg-linear-to-br from-[#a1001f] to-[#c41230]'}`}>
                              <div className="flex items-start justify-between mb-1.5">
                                <BookOpen className="w-5 h-5 shrink-0" />
                                {!isLocked && (
                                  <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[10px] font-semibold">Mở</span>
                                )}
                                {isLocked && (
                                  <span className="px-1.5 py-0.5 bg-black/20 rounded-full text-[10px] font-semibold">Locked</span>
                                )}
                              </div>
                              <h3 className="text-sm font-bold mb-1 line-clamp-2 leading-tight min-h-[2.5em]">{assignment.assignment_title}</h3>
                              <p className="text-[11px] text-rose-50 line-clamp-1 opacity-90">
                                {linkedVideo?.name ? linkedVideo.name.replace(/^Lesson \d+:\s*/, '') : 'Unknown Video'}
                              </p>
                            </div>

                            <div className="p-3 flex flex-col flex-1">
                              <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
                                <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                                  <FileText className="w-3 h-3 text-gray-500" />
                                  <span className="font-bold text-gray-900">{assignment.question_count || '?'}</span>
                                  <span className="text-gray-600">câu</span>
                                </div>

                                <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                                  <Award className="w-3 h-3 text-gray-500" />
                                  <span className="font-bold text-gray-900">{assignment.total_points || '?'}</span>
                                  <span className="text-gray-600">đ</span>
                                </div>

                                <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                                  <CheckCircle className="w-3 h-3 text-gray-500" />
                                  <span className="font-bold text-gray-900">{assignment.passing_score}</span>
                                </div>

                                <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                                  <Clock className="w-3 h-3 text-gray-500" />
                                  <span className="font-bold text-gray-900">{assignment.time_limit_minutes}p</span>
                                </div>
                              </div>

                              <div className="mt-auto">
                                {(linkedVideo?.score > 0 || assignment.recent_submission) ? (
                                    <div className={`mb-2.5 p-2 rounded-lg border flex justify-between items-center ${
                                      (linkedVideo?.score >= assignment.passing_score)
                                        ? 'bg-green-50 border-green-200'
                                        : 'bg-amber-50 border-amber-200'
                                    }`}>
                                        <span className="text-[10px] font-semibold text-gray-700">Điểm số:</span>
                                        <span className={`text-sm font-bold ${
                                          (linkedVideo?.score >= assignment.passing_score) ? 'text-green-600' : 'text-amber-600'
                                        }`}>
                                          {linkedVideo?.score > 0 ? linkedVideo.score : (assignment.recent_submission?.score || 0)}
                                          <span className="text-xs text-gray-500">/{assignment.total_points || '?'}</span>
                                        </span>
                                    </div>
                                ) : null}

                                <Button
                                    onClick={() => router.push(`/user/training?start_assignment_id=${assignment.id}`)}
                                    disabled={isLocked}
                                    variant={isLocked ? "secondary" : "default"}
                                    className={`w-full h-9 text-xs font-semibold ${
                                      !isLocked ? 'bg-[#a1001f] hover:bg-[#8a001a] text-white shadow-sm' : ''
                                    }`}
                                >
                                    {isLocked ? 'Hoàn thành video để mở' : ((linkedVideo?.score > 0 || assignment.recent_submission) ? 'Làm lại' : 'Làm bài')}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}

        {/* No Data State */}
        {!isLoadingTeacher && !isLoadingTraining && !trainingData && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="w-16 h-16 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có dữ liệu đào tạo</h3>
            <p className="text-sm text-gray-600">
              Vui lòng liên hệ quản lý để được cấp quyền truy cập
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
