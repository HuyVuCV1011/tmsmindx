'use client';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PageContainer } from '@/components/PageContainer';
import { Tabs } from '@/components/Tabs';
import { TableSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

  const [selectedTeacherCode, setSelectedTeacherCode] = useState<string | null>(null);
  const [teacherDetail, setTeacherDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Detail Modal Helper
  const openDetail = async (code: string) => {
    setSelectedTeacherCode(code);
    setIsLoadingDetail(true);
    setTeacherDetail(null);
    try {
        const response = await fetch(`/api/training-db?code=${code}`);
        const data = await response.json();
        setTeacherDetail(data);
    } catch (e) {
        console.error("Failed to load details", e);
    } finally {
        setIsLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedTeacherCode(null);
    setTeacherDetail(null);
  };

  
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
                        <Badge variant="success" className="whitespace-nowrap">
                          Đã giao
                        </Badge>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Mã GV</TableHead>
                      <TableHead>Cơ sở</TableHead>
                      <TableHead className="text-center">Điểm TK</TableHead>
                      <TableHead className="text-center">Video</TableHead>
                      <TableHead className="text-center">Hoàn thành</TableHead>
                      <TableHead className="text-center">ĐTB Video</TableHead>
                      <TableHead className="text-center">Bài tập</TableHead>
                      <TableHead className="text-center">ĐTB BT</TableHead>
                      <TableHead className="text-center">Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDashboard.map((row, idx) => (
                      <TableRow key={row.teacher_code}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{row.full_name}</TableCell>
                        <TableCell>{row.teacher_code}</TableCell>
                        <TableCell className="text-xs">{row.center || '-'}</TableCell>
                        <TableCell className="text-center font-bold">
                          {row.total_score ? Number(row.total_score).toFixed(2) : '0.00'}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.total_videos_assigned || 0}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.videos_completed || 0}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.avg_video_score ? Number(row.avg_video_score).toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.assignments_passed || 0}/{row.total_assignments_taken || 0}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.avg_assignment_score ? Number(row.avg_assignment_score).toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                              <button onClick={() => openDetail(row.teacher_code)} className="text-blue-600 hover:underline">
                                Xem
                            </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
