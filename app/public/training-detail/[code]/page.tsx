'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface VideoScore {
  video_id: string;
  video_title: string;
  video_link: string | null;
  video_description: string;
  score: number | null;
  completion_status: string | null;
  time_spent_seconds: number;
  viewed_at: string | null;
  completed_at: string | null;
  submission_id: number | null;
  answers: Record<string, string> | null;
}

interface TeacherDetail {
  teacher_code: string;
  full_name: string;
  center: string;
  teaching_block: string;
  total_score: number;
  status: string;
}

interface ApiResponse {
  success: boolean;
  teacher: TeacherDetail;
  video_scores: VideoScore[];
  error?: string;
}

function formatTime(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        ✓ Hoàn thành
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        🔄 Đang xem
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      — Chưa xem
    </span>
  );
}

export default function TrainingDetailPage() {
  const params = useParams();
  const code = params.code as string;
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/public/training-detail?code=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then((res: ApiResponse) => {
        if (res.success) setData(res);
        else setError(res.error || 'Không tìm thấy dữ liệu');
      })
      .catch(() => setError('Lỗi kết nối'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-md p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="font-semibold text-slate-800 mb-2">Không tìm thấy</h2>
          <p className="text-slate-500 text-sm">{error || 'Dữ liệu không tồn tại.'}</p>
        </div>
      </div>
    );
  }

  const { teacher, video_scores } = data;
  const completedCount = video_scores.filter(v => v.completion_status === 'completed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🎓</span>
            <h1 className="text-xl font-bold text-slate-800">Chi tiết đào tạo giáo viên</h1>
          </div>
          <p className="text-xs text-slate-400 ml-9">MindX Training Portal · Dữ liệu công khai</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Teacher Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{teacher.full_name}</h2>
              <p className="text-slate-500 text-sm mt-0.5">Mã GV: <span className="font-mono font-medium text-slate-700">{teacher.teacher_code}</span></p>
              <div className="flex flex-wrap gap-2 mt-3">
                {teacher.center && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                    🏫 {teacher.center}
                  </span>
                )}
                {teacher.teaching_block && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-sm font-medium">
                    📚 Khối {teacher.teaching_block}
                  </span>
                )}
              </div>
            </div>
            <div className="text-center bg-gradient-to-br from-blue-500 to-violet-600 text-white rounded-2xl px-6 py-4 shadow-md">
              <div className="text-3xl font-bold">{teacher.total_score.toFixed(1)}</div>
              <div className="text-xs opacity-80 mt-0.5">Điểm tổng kết</div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800">{video_scores.length}</div>
              <div className="text-xs text-slate-500">Video được giao</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{completedCount}</div>
              <div className="text-xs text-slate-500">Đã hoàn thành</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {video_scores.length > 0 ? Math.round((completedCount / video_scores.length) * 100) : 0}%
              </div>
              <div className="text-xs text-slate-500">Tỉ lệ hoàn thành</div>
            </div>
          </div>
        </div>

        {/* Video Scores Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Chi tiết từng video</h3>
          </div>
          {video_scores.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Chưa có dữ liệu video</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">Video</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-center">Trạng thái</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-center">Điểm</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-center">Minh chứng</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-center">Thời gian xem</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-center">Hoàn thành lúc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {video_scores.map((v, i) => (
                    <tr key={v.video_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        {v.video_link ? (
                          <a 
                            href={v.video_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-slate-800 hover:text-blue-600 hover:underline flex items-center gap-1 group"
                          >
                            {v.video_title}
                            <svg className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        ) : (
                          <div className="font-medium text-slate-800">{v.video_title}</div>
                        )}
                        {v.video_description && (
                          <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{v.video_description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={v.completion_status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {v.score != null ? (
                          <span className="font-semibold text-blue-600">{v.score.toFixed(1)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {v.submission_id ? (
                          <a
                            href={`/public/training-submission-detail/${v.submission_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-colors shadow-sm"
                            title="Xem chi tiết bài làm"
                          >
                            <span>📝 Xem bài làm</span>
                          </a>
                        ) : (
                          <span className="text-slate-300 text-xs italic">Chưa làm bài</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {formatTime(v.time_spent_seconds)}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs">
                        {v.completed_at
                          ? new Date(v.completed_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">
          MindX Training · Dữ liệu cập nhật theo thời gian thực
        </p>
      </div>
    </div>
  );
}
