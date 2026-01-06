'use client';

import { useState, useMemo, useEffect } from 'react';

interface Video {
  id: number;
  title: string;
  video_link: string;
  start_date: string;
  status: string;
  lesson_number: number;
  thumbnail_url?: string;
  duration_minutes?: number;
  description?: string;
}

interface TeacherStats {
  teacher_code: string;
  full_name: string;
  username: string;
  work_email: string;
  center: string;
  teacher_status: string;
  total_score: number;
  total_videos_assigned: number;
  videos_completed: number;
  avg_video_score: number;
  total_assignments_taken: number;
  assignments_passed: number;
  avg_assignment_score: number;
}

export default function TrainingDashboardPage() {
  const [tab, setTab] = useState<'assigned' | 'dashboard'>('assigned');
  const [assignedVideos, setAssignedVideos] = useState<Video[]>([]);
  const [dashboardData, setDashboardData] = useState<TeacherStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [centerFilter, setCenterFilter] = useState('');
  const centers = useMemo(() => Array.from(new Set(dashboardData.map(d => d.center))), [dashboardData]);
  const filteredDashboard = useMemo(() => centerFilter ? dashboardData.filter(d => d.center === centerFilter) : dashboardData, [dashboardData, centerFilter]);

  // Fetch assigned videos
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch('/api/training-videos?status=active');
        const data = await response.json();
        if (data.success) {
          setAssignedVideos(data.data);
        }
      } catch (err) {
        console.error('Error fetching videos:', err);
        setError('Failed to load videos');
      }
    };
    fetchVideos();
  }, []);

  // Fetch teacher statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/training-teacher-stats-db');
        const data = await response.json();
        if (data.success) {
          setDashboardData(data.data);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Thống kê đào tạo nâng cao</h1>
        <div className="flex gap-6 border-b mb-8">
          <button
            className={`pb-2 border-b-2 font-bold ${tab === 'assigned' ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500'}`}
            onClick={() => setTab('assigned')}
          >Video đã giao</button>
          <button
            className={`pb-2 border-b-2 font-bold ${tab === 'dashboard' ? 'border-yellow-500 text-yellow-700' : 'border-transparent text-gray-500'}`}
            onClick={() => setTab('dashboard')}
          >Thống kê</button>
        </div>

        {/* Tab 1: Video đã assigned */}
        {tab === 'assigned' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-blue-700">Danh sách bài học</h2>
            {loading ? (
              <div className="text-center py-8">Đang tải dữ liệu...</div>
            ) : error ? (
              <div className="text-red-500 text-center py-8">{error}</div>
            ) : assignedVideos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Chưa có bài học nào được giao
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {assignedVideos.map((v, idx) => (
                  <div 
                    key={v.id} 
                    className="flex gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => window.open(v.video_link, '_blank')}
                  >
                    {/* Thumbnail */}
                    <div className="flex-shrink-0 relative">
                      <div className="w-40 h-24 bg-gray-200 rounded-lg overflow-hidden">
                        {v.thumbnail_url ? (
                          <img 
                            src={v.thumbnail_url} 
                            alt={v.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIGZpbGw9IiNlNWU3ZWIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzljYTNhZiIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0Ij5WaWRlbzwvdGV4dD48L3N2Zz4=';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                            <svg className="w-12 h-12 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Duration badge */}
                      {v.duration_minutes && (
                        <div className="absolute bottom-1 right-1 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded">
                          {v.duration_minutes} phút
                        </div>
                      )}
                    </div>

                    {/* Video Info */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-grow">
                          <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">
                            {v.title}
                          </h3>
                          {v.lesson_number && (
                            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                              LESSON {v.lesson_number.toString().padStart(2, '0')}
                            </span>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          v.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {v.status === 'active' ? '✓ Đã giao' : 'Chưa giao'}
                        </span>
                      </div>
                      
                      {v.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {v.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(v.start_date).toLocaleDateString('vi-VN')}
                        </span>
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
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Dashboard thống kê */}
        {tab === 'dashboard' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-yellow-700">Thống kê</h2>
            <div className="flex gap-4 items-center mb-4">
              <label className="font-medium">Lọc theo cơ sở:</label>
              <select value={centerFilter} onChange={e => setCenterFilter(e.target.value)} className="border px-2 py-1 rounded">
                <option value="">Tất cả</option>
                {centers.map(center => (
                  <option key={center} value={center}>{center}</option>
                ))}
              </select>
            </div>
            {loading ? (
              <div className="text-center py-8">Đang tải dữ liệu...</div>
            ) : error ? (
              <div className="text-red-500 text-center py-8">{error}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">No</th>
                      <th className="border border-gray-300 px-4 py-2">Full name</th>
                      <th className="border border-gray-300 px-4 py-2">Code</th>
                      <th className="border border-gray-300 px-4 py-2">Cơ sở</th>
                      <th className="border border-gray-300 px-4 py-2">Điểm tổng kết</th>
                      <th className="border border-gray-300 px-4 py-2">Video đã assigned</th>
                      <th className="border border-gray-300 px-4 py-2">Video hoàn thành</th>
                      <th className="border border-gray-300 px-4 py-2">Điểm TB Video</th>
                      <th className="border border-gray-300 px-4 py-2">Assignment hoàn thành</th>
                      <th className="border border-gray-300 px-4 py-2">Điểm TB Assignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDashboard.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                          Chưa có dữ liệu thống kê
                        </td>
                      </tr>
                    ) : (
                      filteredDashboard.map((row, idx) => (
                        <tr key={row.teacher_code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-4 py-2">{idx + 1}</td>
                          <td className="border border-gray-300 px-4 py-2">{row.full_name}</td>
                          <td className="border border-gray-300 px-4 py-2">{row.teacher_code}</td>
                          <td className="border border-gray-300 px-4 py-2">{row.center || '-'}</td>
                          <td className="border border-gray-300 px-4 py-2 font-bold text-center">
                            {row.total_score ? Number(row.total_score).toFixed(2) : '0.00'}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            {row.total_videos_assigned || 0}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            {row.videos_completed || 0}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            {row.avg_video_score ? Number(row.avg_video_score).toFixed(2) : '-'}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            {row.assignments_passed || 0}/{row.total_assignments_taken || 0}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            {row.avg_assignment_score ? Number(row.avg_assignment_score).toFixed(2) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
