'use client';

import { useAuth } from '@/lib/auth-context';
import { AlertCircle, ArrowLeft, CheckCircle, Clock, Send, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

interface ExamQuestion {
  id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  options: string[] | null;
  correct_answer: string | null;
  points: number;
  order_number: number;
}

interface ExamAssignment {
  id: number;
  subject_code: string;
  set_code: string;
  set_name: string;
  open_at: string;
  close_at: string;
  total_points: number;
  passing_score: number;
  assignment_status: string;
  score: number | null;
}

export default function ExamAssignmentTakingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [teacherCode, setTeacherCode] = useState('');
  const [assignment, setAssignment] = useState<ExamAssignment | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [percentage, setPercentage] = useState<number>(0);

  const assignmentId = Number(params.id);

  useEffect(() => {
    if (!user?.email) return;

    (async () => {
      try {
        const res = await fetch(`/api/teachers?email=${encodeURIComponent(user.email)}&basic=1`);
        const data = await res.json();
        if (data?.teacher?.code) {
          setTeacherCode(data.teacher.code);
          return;
        }
      } catch {
      }

      const fallback = user.email.split('@')[0];
      setTeacherCode(fallback);
    })();
  }, [user]);

  useEffect(() => {
    if (!teacherCode || !assignmentId) return;

    (async () => {
      try {
        setLoading(true);

        const detailsRes = await fetch(`/api/exam-assignment-questions?assignment_id=${assignmentId}`);
        const detailsData = await detailsRes.json();

        if (!detailsData.success) {
          toast.error(detailsData.error || 'Không thể tải dữ liệu bài thi');
          router.push('/user/assignments');
          return;
        }

        const assignmentData: ExamAssignment = detailsData.assignment;
        const questionData: ExamQuestion[] = detailsData.questions || [];

        const now = new Date();
        const openAt = new Date(assignmentData.open_at);
        const closeAt = new Date(assignmentData.close_at);

        if (now < openAt) {
          toast.error('Bài thi chưa đến thời gian mở');
          router.push('/user/assignments');
          return;
        }

        if (now > closeAt || assignmentData.assignment_status === 'expired') {
          toast.error('Bài thi đã quá hạn');
          router.push('/user/assignments');
          return;
        }

        const startRes = await fetch('/api/exam-submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignment_id: assignmentId, teacher_code: teacherCode }),
        });
        const startData = await startRes.json();

        if (!startData.success) {
          toast.error(startData.error || 'Không thể bắt đầu bài thi');
          router.push('/user/assignments');
          return;
        }

        setAssignment(assignmentData);
        setQuestions(questionData);
      } catch (error) {
        console.error('Error loading exam assignment:', error);
        toast.error('Có lỗi xảy ra khi tải bài thi');
        router.push('/user/assignments');
      } finally {
        setLoading(false);
      }
    })();
  }, [teacherCode, assignmentId, router]);

  useEffect(() => {
    if (!assignment || submitted) return;

    const tick = () => {
      const remain = Math.max(0, Math.floor((new Date(assignment.close_at).getTime() - Date.now()) / 1000));
      setTimeRemaining(remain);
      if (remain === 0 && !submitted) {
        handleSubmit(true);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [assignment, submitted]);

  const unansweredCount = useMemo(
    () => questions.length - Object.keys(answers).length,
    [questions.length, answers]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (auto = false) => {
    if (!assignment || submitting || submitted) return;

    if (!auto && unansweredCount > 0) {
      const confirmed = window.confirm(`Bạn còn ${unansweredCount} câu chưa trả lời. Bạn có chắc muốn nộp bài?`);
      if (!confirmed) return;
    }

    try {
      setSubmitting(true);

      let totalScore = 0;
      questions.forEach((question) => {
        const expected = (question.correct_answer || '').trim().toLowerCase();
        const actual = (answers[question.id] || '').trim().toLowerCase();
        if (expected && actual === expected) {
          totalScore += Number(question.points || 0);
        }
      });

      const totalPoints = Number(assignment.total_points || 0);
      const pct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
      const isPassed = totalScore >= Number(assignment.passing_score || 0);

      const response = await fetch('/api/exam-submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          teacher_code: teacherCode,
          score: totalScore,
          total_points: totalPoints,
          percentage: pct,
          is_passed: isPassed,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || 'Không thể nộp bài');
        return;
      }

      setScore(totalScore);
      setPercentage(pct);
      setSubmitted(true);
      toast.success(auto ? 'Hết giờ, hệ thống đã nộp bài tự động' : 'Nộp bài thành công');
    } catch (error) {
      console.error('Error submitting exam assignment:', error);
      toast.error('Có lỗi xảy ra khi nộp bài');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-600">Đang tải bài thi...</div>;
  }

  if (!assignment) {
    return <div className="p-6 text-center text-red-600">Không tìm thấy bài thi.</div>;
  }

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
          <CheckCircle className="w-14 h-14 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Hoàn thành bài thi</h1>
          <p className="text-gray-600 mb-4">{assignment.subject_code} - {assignment.set_code}</p>
          <p className="text-4xl font-bold text-blue-600 mb-2">{score}</p>
          <p className="text-sm text-gray-500 mb-6">Tỷ lệ đúng: {percentage.toFixed(1)}%</p>
          <Link href="/user/assignments" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <ArrowLeft className="w-4 h-4" />
            Quay lại My Assignment
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{assignment.subject_code}</h1>
            <p className="text-sm text-gray-600">Bộ đề: {assignment.set_code} - {assignment.set_name}</p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-4 h-4" />
            <span className="font-semibold">{timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <h2 className="font-semibold text-gray-900">Câu {index + 1}</h2>
              <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">{question.points} điểm</span>
            </div>
            <p className="text-gray-800 mb-3">{question.question_text}</p>

            {Array.isArray(question.options) && question.options.length > 0 ? (
              <div className="space-y-2">
                {question.options.map((opt, idx) => (
                  <label key={idx} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50">
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      value={opt}
                      checked={answers[question.id] === opt}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    />
                    <span className="text-sm text-gray-800">{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Nhập câu trả lời..."
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          Còn {unansweredCount} câu chưa trả lời
        </div>

        <Button
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 h-auto"
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Đang nộp...' : 'Nộp bài'}
        </Button>
      </div>

      <div className="mt-4">
        <Link href="/user/assignments" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          Quay lại My Assignment
        </Link>
      </div>
    </div>
  );
}
