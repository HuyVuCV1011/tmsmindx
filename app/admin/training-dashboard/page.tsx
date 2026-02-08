'use client';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/PageContainer';
import { Tabs } from '@/components/Tabs';
import { TableSkeleton } from '@/components/skeletons';
import { BarChart3, Calendar, Play, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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
  const router = useRouter();
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
    <PageContainer
      title="Thống kê đào tạo nâng cao"
      description="Theo dõi tiến độ và thành tích đào tạo"
    >
      <Card>
        <Tabs
          tabs={[
            { id: 'assigned', label: 'Video đã giao', count: assignedVideos.length },
            { id: 'dashboard', label: 'Thống kê giáo viên', count: dashboardData.length },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as 'assigned' | 'dashboard')}
        />

        {/* Tab 1: Video đã assigned */}
        {tab === 'assigned' && (
          <div className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 p-3 border border-gray-200 rounded-lg animate-pulse">
                    <div className="w-32 h-20 bg-gray-200 rounded-lg"></div>
                    <div className="flex-grow space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-red-600 text-center py-8">{error}</div>
            ) : assignedVideos.length === 0 ? (
              <EmptyState
                icon={Video}
                title="Chưa có bài học"
                description="Chưa có bài học nào được giao cho giáo viên"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {assignedVideos.map((v, idx) => (
                  <div 
                    key={v.id} 
                    className="flex gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => router.push(`/admin/video-detail?id=${v.id}`)}
                  >
                    {/* Thumbnail */}
                    <div className="flex-shrink-0 relative">
                      <div className="w-32 h-20 bg-gray-100 rounded-lg overflow-hidden">
                        {v.thumbnail_url ? (
                          <img 
                            src={v.thumbnail_url} 
                            alt={v.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      {v.duration_minutes && (
                        <div className="absolute bottom-1 right-1 bg-black/75 text-white text-xs px-1.5 py-0.5 rounded">
                          {v.duration_minutes}p
                        </div>
                      )}
                    </div>

                    {/* Video Info */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-grow">
                          <h3 className="font-semibold text-sm text-gray-900 line-clamp-2">
                            {v.title}
                          </h3>
                          {v.lesson_number && (
                            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded mt-1">
                              L{v.lesson_number.toString().padStart(2, '0')}
                            </span>
                          )}
                        </div>
                        <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-medium whitespace-nowrap">
                          Đã giao
                        </span>
                      </div>
                      
                      {v.description && (
                        <p className="text-xs text-gray-600 line-clamp-1 mb-1">
                          {v.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(v.start_date).toLocaleDateString('vi-VN')}
                        </span>
                        <span>Video #{idx + 1}</span>
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
          <div className="mt-4">
            <div className="flex gap-3 items-center mb-4">
              <label className="text-sm font-medium">Lọc theo cơ sở:</label>
              <select 
                value={centerFilter} 
                onChange={e => setCenterFilter(e.target.value)} 
                className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]"
              >
                <option value="">Tất cả</option>
                {centers.map(center => (
                  <option key={center} value={center}>{center}</option>
                ))}
              </select>
            </div>
            
            {loading ? (
              <TableSkeleton rows={10} columns={10} />
            ) : error ? (
              <div className="text-red-600 text-center py-8">{error}</div>
            ) : filteredDashboard.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Chưa có dữ liệu"
                description="Chưa có thống kê nào được ghi nhận"
              />
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">No</th>
                      <th className="px-3 py-2 text-left font-semibold">Họ tên</th>
                      <th className="px-3 py-2 text-left font-semibold">Mã GV</th>
                      <th className="px-3 py-2 text-left font-semibold">Cơ sở</th>
                      <th className="px-3 py-2 text-center font-semibold">Điểm TK</th>
                      <th className="px-3 py-2 text-center font-semibold">Video</th>
                      <th className="px-3 py-2 text-center font-semibold">Hoàn thành</th>
                      <th className="px-3 py-2 text-center font-semibold">ĐTB Video</th>
                      <th className="px-3 py-2 text-center font-semibold">Bài tập</th>
                      <th className="px-3 py-2 text-center font-semibold">ĐTB BT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDashboard.map((row, idx) => (
                      <tr key={row.teacher_code} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{row.full_name}</td>
                        <td className="px-3 py-2">{row.teacher_code}</td>
                        <td className="px-3 py-2 text-xs">{row.center || '-'}</td>
                        <td className="px-3 py-2 text-center font-bold">
                          {row.total_score ? Number(row.total_score).toFixed(2) : '0.00'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.total_videos_assigned || 0}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.videos_completed || 0}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.avg_video_score ? Number(row.avg_video_score).toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.assignments_passed || 0}/{row.total_assignments_taken || 0}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.avg_assignment_score ? Number(row.avg_assignment_score).toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
