'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';

interface Assignment {
  id: number;
  video_title: string;
  assignment_title: string;
  assignment_type: string;
  total_points: number;
  passing_score: number;
  time_limit_minutes: number;
  max_attempts: number;
  due_date: string;
  status: string;
  question_count: number;
  recent_submission?: {
    score: number;
    percentage: number;
    is_passed: boolean;
    submitted_at: string;
    attempt_number: number;
  };
}

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  correct_answer: string;
  options: any;
  image_url: string;
  points: number;
  order_number: number;
}

interface Submission {
  id: number;
  teacher_code: string;
  assignment_id: number;
  attempt_number: number;
  score: number;
  total_points: number;
  percentage: number;
  is_passed: boolean;
  status: string;
  started_at: string;
  submitted_at: string;
  time_spent_seconds: number;
}

export default function TeacherAssignmentPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [view, setView] = useState<'list' | 'taking' | 'result'>('list');

  // Helper function to safely parse percentage
  const formatPercentage = (percentage: number | string | undefined): string => {
    if (percentage === undefined || percentage === null) return '0.0';
    const num = typeof percentage === 'number' ? percentage : parseFloat(percentage);
    return isNaN(num) ? '0.0' : num.toFixed(1);
  };

  // Extract teacher code from email (fallback method)
  const extractCodeFromEmail = (email: string): string | null => {
    const match = email.match(/^([a-zA-Z0-9]+)@/);
    return match ? match[1] : null;
  };

  // Get teacher code from user email
  useEffect(() => {
    if (user && user.email && !teacherCode) {
      (async () => {
        try {
          // Try to get teacher code from API
          const res = await fetch(`/api/teachers?email=${encodeURIComponent(user.email)}`);
          const data = await res.json();
          if (data?.teacher?.code) {
            setTeacherCode(data.teacher.code);
            return;
          }
        } catch (err) {
          console.warn('Email-based lookup failed, falling back to code extraction');
        }

        // Fallback: extract code from email
        const code = extractCodeFromEmail(user.email);
        if (code) {
          setTeacherCode(code);
        }
      })();
    }
  }, [user, teacherCode]);

  useEffect(() => {
    if (teacherCode) {
      fetchAvailableAssignments();
    }
  }, [teacherCode]);

  const fetchAvailableAssignments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/training-assignments?status=published');
      const data = await response.json();
      if (data.success) {
        // Fetch recent submissions for each assignment
        const assignmentsWithScores = await Promise.all(
          data.data.map(async (assignment: Assignment) => {
            try {
              const submissionRes = await fetch(
                `/api/training-submissions?teacher_code=${teacherCode}&assignment_id=${assignment.id}&latest=true`
              );
              const submissionData = await submissionRes.json();
              if (submissionData.success && submissionData.data?.length > 0) {
                const latestSubmission = submissionData.data[0];
                return {
                  ...assignment,
                  recent_submission: {
                    score: latestSubmission.score,
                    percentage: latestSubmission.percentage,
                    is_passed: latestSubmission.is_passed,
                    submitted_at: latestSubmission.submitted_at,
                    attempt_number: latestSubmission.attempt_number
                  }
                };
              }
            } catch (err) {
              console.warn('Failed to fetch submission for assignment:', assignment.id);
            }
            return assignment;
          })
        );
        setAssignments(assignmentsWithScores);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const startAssignment = async (assignment: Assignment) => {
    try {
      // Fetch questions
      const questionsRes = await fetch(`/api/training-assignment-questions?assignment_id=${assignment.id}`);
      const questionsData = await questionsRes.json();
      
      if (!questionsData.success) {
        alert('Không thể tải câu hỏi');
        return;
      }

      // Create submission
      const submissionRes = await fetch('/api/training-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_code: teacherCode,
          assignment_id: assignment.id,
          attempt_number: 1
        })
      });

      const submissionData = await submissionRes.json();
      if (!submissionData.success) {
        alert('Không thể bắt đầu assignment: ' + submissionData.error);
        return;
      }

      setCurrentAssignment(assignment);
      setQuestions(questionsData.data);
      setSubmission(submissionData.data);
      setAnswers({});
      setView('taking');
    } catch (err) {
      console.error('Error starting assignment:', err);
      alert('Lỗi khi bắt đầu assignment');
    }
  };

  const submitAssignment = async () => {
    if (!submission) return;

    const unansweredCount = questions.length - Object.keys(answers).length;
    if (unansweredCount > 0) {
      if (!confirm(`Bạn còn ${unansweredCount} câu chưa trả lời. Bạn có chắc muốn nộp bài?`)) {
        return;
      }
    }

    try {
      // Calculate score synchronously
      let totalScore = 0;
      console.log('[Assignment] Starting score calculation for', questions.length, 'questions');
      
      questions.forEach((question, idx) => {
        const userAnswer = answers[question.id] || '';
        const correctAnswer = (question.correct_answer || '').trim().toLowerCase();
        const isCorrect = userAnswer.trim().toLowerCase() === correctAnswer;
        const points = parseFloat(question.points?.toString() || '0');
        const pointsEarned = isCorrect ? points : 0;
        
        console.log(`[Assignment] Q${idx + 1}:`, {
          questionId: question.id,
          points: points,
          userAnswer: userAnswer,
          correctAnswer: correctAnswer,
          isCorrect: isCorrect,
          pointsEarned: pointsEarned
        });
        
        totalScore += pointsEarned;
      });

      console.log('[Assignment] Final calculated total score:', totalScore, 'type:', typeof totalScore);

      // Ensure score is a valid number
      if (isNaN(totalScore) || totalScore === null || totalScore === undefined) {
        console.error('[Assignment] Invalid total score calculated:', totalScore);
        alert('Lỗi: Không thể tính điểm. Vui lòng thử lại.');
        return;
      }

      // Update submission
      const isPassed = totalScore >= currentAssignment!.passing_score;
      const response = await fetch('/api/training-submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submission.id,
          action: 'grade',
          score: totalScore,
          is_passed: isPassed
        })
      });

      const data = await response.json();
      if (data.success) {
        setSubmission(data.data);
        setView('result');
      } else {
        alert('Lỗi khi nộp bài: ' + data.error);
      }
    } catch (err) {
      console.error('Error submitting assignment:', err);
      alert('Lỗi khi nộp bài');
    }
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-8 text-center">Đang tải...</div>;
  }

  if (view === 'taking' && currentAssignment) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h1 className="text-2xl font-bold mb-2">{currentAssignment.assignment_title}</h1>
            <p className="text-gray-600 mb-4">{currentAssignment.video_title}</p>
            <div className="flex gap-4 text-sm">
              <span>⏱️ Thời gian: {currentAssignment.time_limit_minutes} phút</span>
              <span>📊 Tổng điểm: {currentAssignment.total_points}</span>
              <span>✅ Điểm đạt: {currentAssignment.passing_score}</span>
            </div>
          </div>

          <div className="space-y-6">
            {questions.map((question, idx) => (
              <div key={question.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium">
                    Câu {idx + 1}: {question.question_text}
                  </h3>
                  <span className="text-sm text-gray-500">{question.points} điểm</span>
                </div>

                {question.image_url && (
                  <img src={question.image_url} alt="Question" className="max-w-md mb-4 rounded" />
                )}

                {question.question_type === 'multiple_choice' && question.options ? (
                  <div className="space-y-2">
                    {Array.isArray(question.options) ? (
                      question.options.map((option: string, optIdx: number) => (
                        <label key={optIdx} className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option}
                            checked={answers[question.id] === option}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          />
                          <span>{option}</span>
                        </label>
                      ))
                    ) : (
                      <textarea
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        rows={3}
                        placeholder="Nhập câu trả lời..."
                      />
                    )}
                  </div>
                ) : (
                  <textarea
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    rows={4}
                    placeholder="Nhập câu trả lời của bạn..."
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-4 justify-end">
            <button
              onClick={() => setView('list')}
              className="px-6 py-2 border rounded hover:bg-gray-100"
            >
              Hủy
            </button>
            <button
              onClick={submitAssignment}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Nộp bài
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'result' && submission) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">
              {submission.is_passed ? '🎉 Chúc mừng!' : '😔 Chưa đạt'}
            </h1>
            <div className="text-6xl font-bold mb-4" style={{ color: submission.is_passed ? '#10b981' : '#ef4444' }}>
              {submission.score}/{submission.total_points}
            </div>
            <p className="text-xl mb-6">
              Điểm số: {formatPercentage(submission.percentage)}%
            </p>
            <p className="text-gray-600 mb-8">
              {submission.is_passed 
                ? `Bạn đã hoàn thành assignment với điểm ${submission.score}/${currentAssignment?.passing_score} điểm đạt!`
                : `Bạn cần đạt tối thiểu ${currentAssignment?.passing_score} điểm để pass.`
              }
            </p>
            <button
              onClick={() => { setView('list'); fetchAvailableAssignments(); }}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Quay lại danh sách
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Assignments của tôi</h1>

        {error ? (
          <div className="text-red-500 text-center py-12">{error}</div>
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
            Hiện tại chưa có assignment nào được giao.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="mb-4">
                  <span className="text-xs text-gray-500">{assignment.video_title}</span>
                  <h3 className="text-lg font-bold mt-1">{assignment.assignment_title}</h3>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div>📝 Số câu hỏi: {assignment.question_count || 0}</div>
                  <div>📊 Tổng điểm: {assignment.total_points}</div>
                  <div>✅ Điểm đạt: {assignment.passing_score}</div>
                  <div>⏱️ Thời gian: {assignment.time_limit_minutes} phút</div>
                  {assignment.due_date && (
                    <div>📅 Hạn nộp: {new Date(assignment.due_date).toLocaleDateString('vi-VN')}</div>
                  )}
                </div>

                {/* Recent Score Display */}
                {assignment.recent_submission && (
                  <div className={`mb-4 p-3 rounded-lg border-2 ${
                    assignment.recent_submission.is_passed 
                      ? 'bg-green-50 border-green-500' 
                      : 'bg-red-50 border-red-500'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">Điểm gần nhất:</span>
                      <span className={`text-lg font-bold ${
                        assignment.recent_submission.is_passed ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {assignment.recent_submission.score}/{assignment.total_points}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{assignment.recent_submission.is_passed ? '✅ Đạt' : '❌ Chưa đạt'}</span>
                      <span>Lần {assignment.recent_submission.attempt_number}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(assignment.recent_submission.submitted_at).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => startAssignment(assignment)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={assignment.status !== 'published'}
                >
                  {assignment.status === 'published' ? 'Bắt đầu làm bài' : 'Chưa mở'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
