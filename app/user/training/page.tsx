'use client';

import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";

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
  const [tab, setTab] = useState<'lessons' | 'stats'>('lessons');
  const [submitCode, setSubmitCode] = useState("");
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const [isResolvingCode, setIsResolvingCode] = useState(false);

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
          const res = await secureFetcher(`/api/teachers?email=${encodeURIComponent(user.email)}`);
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

  const completedLessons = useMemo(() => {
    if (!trainingData?.lessons) return 0;
    return trainingData.lessons.filter((l: TrainingLesson) => 
      l.completion_status === 'completed'
    ).length;
  }, [trainingData]);

  const handleLessonClick = (lesson: TrainingLesson, index: number) => {
    if (lesson.link) {
      console.log('[Training] Opening lesson:', { id: lesson.id, name: lesson.name, index: index + 1 });
      router.push(`/user/training/lesson?id=${lesson.id}&url=${encodeURIComponent(lesson.link)}&title=${encodeURIComponent(lesson.name)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg p-6 mb-6">
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

        {/* Loading State */}
        {(isResolvingCode || isLoadingTeacher || isLoadingTraining) && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="inline-flex items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-lg text-gray-600">Đang tải dữ liệu...</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        {!isLoadingTeacher && !isLoadingTraining && trainingData && (
          <>
            <div className="flex gap-6 border-b mb-6">
              <button
                className={`pb-3 px-2 border-b-2 font-bold transition-colors ${
                  tab === 'lessons' 
                    ? 'border-purple-500 text-purple-700' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setTab('lessons')}
              >
                Bài học nâng cao
              </button>
              <button
                className={`pb-3 px-2 border-b-2 font-bold transition-colors ${
                  tab === 'stats' 
                    ? 'border-yellow-500 text-yellow-700' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setTab('stats')}
              >
                Thống kê điểm số
              </button>
            </div>

            {/* Tab: Bài học nâng cao */}
            {tab === 'lessons' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-purple-700">Danh sách bài học</h2>
                  
                  {/* Progress Bar */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <div className="text-sm text-gray-600 mb-1">
                        Tiến độ: <span className="font-bold text-purple-600">{completedLessons}/{trainingData.lessons.length}</span>
                      </div>
                      <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500 ease-out"
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
                          <div className="flex-shrink-0 relative">
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
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200">
                                  <svg className="w-12 h-12 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {/* Duration badge */}
                            {lesson.duration_minutes && (
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
                          <div className="flex-grow min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-grow">
                                <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">
                                  {lesson.name}
                                </h3>
                                {lessonNumber && (
                                  <span className="inline-block bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded">
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
                            
                            {lesson.description && (
                              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                {lesson.description}
                              </p>
                            )}
                            
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
                <h2 className="text-xl font-bold mb-4 text-yellow-700">Thống kê điểm số các bài học</h2>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Lesson</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Tên bài học</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Điểm số</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {trainingData.lessons.map((lesson: TrainingLesson, idx: number) => {
                        const notStarted = lesson.score === 0;
                        const passed = lesson.score >= 7;
                        
                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-purple-600">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {lesson.name.replace(/^Lesson \d+:\s*/, '')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-lg font-bold ${
                                notStarted ? 'text-gray-400' : passed ? 'text-green-600' : 'text-yellow-600'
                              }`}>
                                {notStarted ? '—' : lesson.score.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                notStarted 
                                  ? 'bg-gray-100 text-gray-700'
                                  : passed 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {notStarted ? 'Chưa học' : passed ? 'Đạt' : 'Cần cải thiện'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Stats Summary */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="text-sm text-gray-600 mb-1">Điểm trung bình</div>
                    <div className="text-2xl font-bold text-purple-600">
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
          </>
        )}

        {/* No Data State */}
        {!isLoadingTeacher && !isLoadingTraining && !trainingData && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
