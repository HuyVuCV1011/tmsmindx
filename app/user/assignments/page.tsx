'use client';

import { PageContainer } from '@/components/PageContainer';
import { Tabs } from '@/components/Tabs';
import { useAuth } from '@/lib/auth-context';
import { AlertCircle, ArrowLeft, Award, BookOpen, CheckCircle, Clock, FileText, Send, XCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

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

interface ExamAssignment {
  id: number;
  teacher_code: string;
  exam_type: 'expertise' | 'experience';
  registration_type: 'official' | 'additional';
  block_code: string;
  subject_code: string;
  open_at: string;
  close_at: string;
  assignment_status: 'assigned' | 'in_progress' | 'submitted' | 'expired' | 'graded';
  score: number | null;
  score_status: 'null' | 'auto_zero' | 'graded';
  selected_set_id: number;
  set_code: string;
  set_name: string;
  total_points: number;
  passing_score: number;
  explanation_status?: 'pending' | 'accepted' | 'rejected';
  is_open?: boolean;
  can_take?: boolean;
}

export default function TeacherAssignmentPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [examAssignments, setExamAssignments] = useState<ExamAssignment[]>([]);
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [trainingLoading, setTrainingLoading] = useState(true);
  const [examLoading, setExamLoading] = useState(true);
  const [error, setError] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [activeMainTab, setActiveMainTab] = useState<'exam' | 'training'>('exam');
  const [selectedExamMonth, setSelectedExamMonth] = useState('all');
  const [view, setView] = useState<'list' | 'taking' | 'result'>('list');
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);

  // Helper function to safely parse percentage
  const formatPercentage = (percentage: number | string | undefined): string => {
    if (percentage === undefined || percentage === null) return '0.0';
    const num = typeof percentage === 'number' ? percentage : parseFloat(percentage);
    return isNaN(num) ? '0.0' : num.toFixed(1);
  };

  // Extract teacher code from email (fallback method)
  const extractCodeFromEmail = (email: string): string | null => {
    const match = email.match(/^([^@]+)@/);
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
      fetchExamAssignments();
    }
  }, [teacherCode]);

  const fetchAvailableAssignments = async () => {
    try {
      setTrainingLoading(true);
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
      setTrainingLoading(false);
    }
  };

  const fetchExamAssignments = async () => {
    try {
      setExamLoading(true);

      const candidates = new Set<string>();
      const normalizedTeacherCode = teacherCode?.trim();
      if (normalizedTeacherCode) {
        candidates.add(normalizedTeacherCode);
        candidates.add(normalizedTeacherCode.toLowerCase());
        candidates.add(normalizedTeacherCode.toUpperCase());
      }

      if (user?.email) {
        const emailCode = extractCodeFromEmail(user.email)?.trim();
        if (emailCode) {
          candidates.add(emailCode);
          candidates.add(emailCode.toLowerCase());
          candidates.add(emailCode.toUpperCase());
        }
      }

      const teacherCodesParam = encodeURIComponent(Array.from(candidates).join(','));
      const response = await fetch(
        `/api/exam-assignments?teacher_code=${encodeURIComponent(teacherCode)}&teacher_codes=${teacherCodesParam}`
      );
      const data = await response.json();
      if (data.success) {
        setExamAssignments(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching exam assignments:', err);
      setError('Failed to load exam assignments');
    } finally {
      setExamLoading(false);
    }
  };

  const startAssignment = async (assignment: Assignment) => {
    try {
      // Fetch questions
      const questionsRes = await fetch(`/api/training-assignment-questions?assignment_id=${assignment.id}`);
      const questionsData = await questionsRes.json();
      
      if (!questionsData.success) {
        toast.error('Không thể tải câu hỏi');
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
        toast.error('Không thể bắt đầu bài tập: ' + submissionData.error);
        return;
      }

      setCurrentAssignment(assignment);
      setQuestions(questionsData.data);
      setSubmission(submissionData.data);
      setAnswers({});
      setView('taking');
      
      // Start timer - check if there's a saved endTime
      if (assignment.time_limit_minutes > 0) {
        const savedEndTime = localStorage.getItem(`assignment_${assignment.id}_endTime`);
        const now = Date.now();
        
        if (savedEndTime) {
          // Calculate remaining time from saved endTime
          const remainingSeconds = Math.max(0, Math.floor((parseInt(savedEndTime) - now) / 1000));
          setTimeRemaining(remainingSeconds);
          setTimerActive(remainingSeconds > 0);
          
          if (remainingSeconds === 0) {
            // Time's up - auto submit
            setTimeout(() => submitAssignment(), 100);
          }
        } else {
          // First time - set new endTime
          const endTime = now + (assignment.time_limit_minutes * 60 * 1000);
          localStorage.setItem(`assignment_${assignment.id}_endTime`, endTime.toString());
          setTimeRemaining(assignment.time_limit_minutes * 60);
          setTimerActive(true);
        }
      }
    } catch (err) {
      console.error('Error starting assignment:', err);
      toast.error('Lỗi khi bắt đầu bài tập');
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      if (!currentAssignment) return;
      
      const savedEndTime = localStorage.getItem(`assignment_${currentAssignment.id}_endTime`);
      if (!savedEndTime) return;
      
      const now = Date.now();
      const endTime = parseInt(savedEndTime);
      const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
      
      setTimeRemaining(remainingSeconds);
      
      if (remainingSeconds === 0) {
        setTimerActive(false);
        // Auto submit when time's up
        submitAssignment();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, timeRemaining, currentAssignment]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        toast.error('Lỗi: Không thể tính điểm. Vui lòng thử lại.');
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
        
        // Clear saved timer
        if (currentAssignment) {
          localStorage.removeItem(`assignment_${currentAssignment.id}_endTime`);
        }
        
        setView('result');
      } else {
        toast.error('Lỗi khi nộp bài: ' + data.error);
      }
    } catch (err) {
      console.error('Error submitting assignment:', err);
      toast.error('Lỗi khi nộp bài');
    }
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const getProgress = () => {
    return Math.round((Object.keys(answers).length / questions.length) * 100);
  };

  if (trainingLoading && examLoading) {
    return (
      <PageContainer>
        {/* Assignment Loading Skeleton */}
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (view === 'taking' && currentAssignment) {
    const progress = getProgress();
    const answeredCount = Object.keys(answers).length;
    
    return (
      <PageContainer>
        <div className="w-full">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content - Questions */}
            <div className="flex-1 min-w-0">
              {/* Mobile Header */}
              <div className="lg:hidden mb-4">
                <h1 className="text-xl font-bold text-gray-900 mb-1">{currentAssignment.assignment_title}</h1>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {currentAssignment.video_title}
                </p>
              </div>

              {/* Questions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
            {questions.map((question, idx) => {
              // Determine if question should span full width
              const isFullWidth = question.question_type === 'essay' || 
                                  question.question_type === 'multiple_choice' ||
                                  question.image_url; // Questions with images also take full width
              
              return (
              <div 
                key={question.id} 
                className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
                  answers[question.id] 
                    ? 'border-green-200 bg-green-50/30' 
                    : 'border-gray-200 hover:border-blue-200'
                } ${isFullWidth ? 'lg:col-span-2' : 'lg:col-span-1'}`}
              >
                <div className="p-4 md:p-6">
                  {/* Question Header */}
                  <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
                    <div className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-sm md:text-base font-bold ${
                      answers[question.id] 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                        <div 
                          className="prose prose-sm max-w-none flex-1"
                          dangerouslySetInnerHTML={{ __html: question.question_text }}
                        />
                        <span className="self-start px-2 md:px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] md:text-xs font-semibold shrink-0">
                          {question.points} điểm
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Question Image */}
                  {question.image_url && (
                    <div className="mb-3 md:mb-4 ml-11 md:ml-14">
                      <Image
                        src={question.image_url}
                        alt="Question"
                        width={400}
                        height={300}
                        className="rounded-lg border border-gray-300 w-full h-auto"
                      />
                    </div>
                  )}

                  {/* Answer Options */}
                  <div className="ml-11 md:ml-14">
                    {question.question_type === 'multiple_choice' && Array.isArray(question.options) ? (
                      <div className="space-y-2">
                        {question.options.map((option: string, optIdx: number) => (
                          <label
                            key={optIdx}
                            className={`flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              answers[question.id] === option
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value={option}
                              checked={answers[question.id] === option}
                              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                              className="w-4 md:w-5 h-4 md:h-5 text-blue-600"
                            />
                            <span className="flex-1 text-sm md:text-base font-medium text-gray-900">{option}</span>
                          </label>
                        ))}
                      </div>
                    ) : question.question_type === 'true_false' ? (
                      <div className="grid grid-cols-2 gap-2 md:gap-3">
                        {['Đúng', 'Sai'].map((option) => (
                          <label
                            key={option}
                            className={`flex items-center justify-center gap-2 p-3 md:p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              answers[question.id] === option
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value={option}
                              checked={answers[question.id] === option}
                              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                              className="w-4 md:w-5 h-4 md:h-5 text-blue-600"
                            />
                            <span className="text-sm md:text-base font-semibold text-gray-900">{option}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Nhập câu trả lời của bạn..."
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                        rows={question.question_type === 'essay' ? 6 : 3}
                      />
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          {/* Submit Footer */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 sticky bottom-0 lg:hidden">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm('Bạn có chắc muốn hủy bài làm? Dữ liệu sẽ không được lưu.')) {
                    setView('list');
                    setTimerActive(false);
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 md:px-6 py-3 font-medium text-gray-700 text-sm md:text-base h-auto"
              >
                <ArrowLeft className="w-4 md:w-5 h-4 md:h-5" />
                Hủy bài làm
              </Button>
              
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
                {answeredCount < questions.length && (
                  <div className="flex items-center justify-center gap-2 text-amber-600 py-2 md:py-0">
                    <AlertCircle className="w-4 md:w-5 h-4 md:h-5" />
                    <span className="text-xs md:text-sm font-medium">
                      Còn {questions.length - answeredCount} câu chưa trả lời
                    </span>
                  </div>
                )}
                
                <Button
                  onClick={submitAssignment}
                  className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 font-semibold shadow-md text-sm md:text-base h-auto"
                >
                  <Send className="w-4 md:w-5 h-4 md:h-5" />
                  Nộp bài
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Desktop only */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-4 space-y-3">
            {/* Assignment Info Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-base font-bold text-gray-900 mb-1 line-clamp-2">{currentAssignment.assignment_title}</h2>
              <p className="text-xs text-gray-600 flex items-center gap-1.5 line-clamp-1">
                <BookOpen className="w-3.5 h-3.5" />
                {currentAssignment.video_title}
              </p>
            </div>

            {/* Timer Card */}
            {timeRemaining !== null && (
              <div className={`rounded-lg shadow-sm border-2 p-4 ${
                timeRemaining < 300 ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-300'
              }`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock className={`w-4 h-4 ${timeRemaining < 300 ? 'text-red-600' : 'text-blue-600'}`} />
                  <span className={`text-xs font-semibold ${timeRemaining < 300 ? 'text-red-700' : 'text-blue-700'}`}>
                    Thời gian còn lại
                  </span>
                </div>
                <div className={`font-mono text-2xl font-bold ${timeRemaining < 300 ? 'text-red-700' : 'text-blue-700'}`}>
                  {formatTime(timeRemaining)}
                </div>
              </div>
            )}

            {/* Progress Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">Tiến độ</span>
                <span className="text-xl font-bold text-blue-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 text-center">
                {answeredCount}/{questions.length} câu đã trả lời
              </p>
            </div>

            {/* Stats Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">Thông tin bài tập</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Số câu hỏi</p>
                    <p className="text-base font-bold text-gray-900">{questions.length}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Award className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Tổng điểm</p>
                    <p className="text-base font-bold text-gray-900">{currentAssignment.total_points}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Điểm đạt yêu cầu</p>
                    <p className="text-base font-bold text-gray-900">{currentAssignment.passing_score}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {answeredCount < questions.length && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                  <div className="flex items-start gap-2 text-amber-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium">
                      Còn {questions.length - answeredCount} câu chưa trả lời
                    </span>
                  </div>
                </div>
              )}
              
              <Button
                onClick={submitAssignment}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold shadow-md h-auto"
              >
                <Send className="w-4 h-4" />
                Nộp bài
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm('Bạn có chắc muốn hủy bài làm? Dữ liệu sẽ không được lưu.')) {
                    if (currentAssignment) {
                      localStorage.removeItem(`assignment_${currentAssignment.id}_endTime`);
                    }
                    setView('list');
                    setTimerActive(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-medium text-gray-700 h-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                Hủy bài làm
              </Button>
            </div>
          </div>
        </div>
      </div>
        </div>
      </PageContainer>
    );
  }

  if (view === 'result' && submission) {
    const percentage = formatPercentage(submission.percentage);
    const isPassed = submission.is_passed;
    
    return (
      <PageContainer>
        <div className="w-full">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {/* Result Header */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                isPassed ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {isPassed ? (
                  <CheckCircle className="w-12 h-12 text-green-600" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-600" />
                )}
              </div>
              
              <h2 className="text-3xl font-bold mb-2">
                {isPassed ? 'Chúc mừng!' : 'Cố gắng thêm nhé!'}
              </h2>
              
              <p className={`text-lg font-semibold ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
                {isPassed ? '✅ Đạt yêu cầu' : '❌ Chưa đạt yêu cầu'}
              </p>
            </div>

            {/* Score Display */}
            <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-xl p-8 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Điểm số của bạn</p>
                <div className="text-6xl font-bold text-blue-600 mb-2">
                  {submission.score}
                  <span className="text-3xl text-gray-400">/{submission.total_points}</span>
                </div>
                <p className="text-sm text-gray-600">
                  Điểm đạt: {currentAssignment?.passing_score}/{submission.total_points}
                </p>
              </div>
            </div>

            {/* Statistics */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900">Tỷ lệ hoàn thành</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{percentage}%</span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${
                    isPassed ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Feedback Message */}
            <div className={`rounded-xl p-6 mb-6 ${
              isPassed ? 'bg-green-50 border-2 border-green-200' : 'bg-amber-50 border-2 border-amber-200'
            }`}>
              <p className="text-center text-gray-700">
                {isPassed 
                  ? `Xuất sắc! Bạn đã hoàn thành bài tập với ${submission.score}/${currentAssignment?.passing_score} điểm đạt!`
                  : `Bạn cần đạt tối thiểu ${currentAssignment?.passing_score} điểm để hoàn thành bài tập. Hãy thử lại nhé!`
                }
              </p>
            </div>

            {/* Action Button */}
            <Button
              onClick={() => { setView('list'); fetchAvailableAssignments(); }}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold h-auto"
            >
              <ArrowLeft className="w-5 h-5" />
              Quay lại danh sách
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const examMonthOptions = Array.from(
    new Set(
      examAssignments
        .filter(item => item.open_at)
        .map(item => {
          const date = new Date(item.open_at);
          const month = `${date.getMonth() + 1}`.padStart(2, '0');
          return `${date.getFullYear()}-${month}`;
        })
    )
  ).sort((a, b) => b.localeCompare(a));

  const filteredExamAssignments = selectedExamMonth === 'all'
    ? examAssignments
    : examAssignments.filter(item => {
        const date = new Date(item.open_at);
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        return `${date.getFullYear()}-${month}` === selectedExamMonth;
      });

  const formatRegistrationType = (type: 'official' | 'additional') =>
    type === 'official' ? 'Chính thức' : 'Bổ sung';

  const getExamStatusLabel = (item: ExamAssignment) => {
    const now = new Date();
    const closeAt = new Date(item.close_at);
    if (item.assignment_status === 'expired' || closeAt < now) return 'Quá hạn';
    if (item.assignment_status === 'submitted') return 'Đã nộp';
    if (item.assignment_status === 'graded') return 'Đã chấm';
    if (item.assignment_status === 'in_progress') return 'Đang làm';
    return 'Đang mở';
  };

  const getExamStatusClass = (item: ExamAssignment) => {
    const status = getExamStatusLabel(item);
    if (status === 'Quá hạn') return 'bg-red-100 text-red-700 border-red-300';
    if (status === 'Đã nộp' || status === 'Đã chấm') return 'bg-green-100 text-green-700 border-green-300';
    return 'bg-blue-100 text-blue-700 border-blue-300';
  };

  const mainTabs = [
    { id: 'exam', label: 'Kiểm tra chuyên môn & Quy trình - kỹ năng trải nghiệm', count: examAssignments.length },
    { id: 'training', label: 'Đào tạo nâng cao', count: assignments.length },
  ];

  return (
    <PageContainer>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bài tập của tôi</h1>
          <p className="text-gray-600">Danh sách các bài tập được giao cho bạn</p>
        </div>

        <Tabs
          tabs={mainTabs}
          activeTab={activeMainTab}
          onChange={(tabId) => setActiveMainTab(tabId as 'exam' | 'training')}
        />

        {error ? (
          <div className="mt-6 bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        ) : activeMainTab === 'exam' ? (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Danh sách bài thi đã đăng ký</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Lọc theo tháng:</span>
                <select
                  value={selectedExamMonth}
                  onChange={(e) => setSelectedExamMonth(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="all">Tất cả</option>
                  {examMonthOptions.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>
            </div>

            {examLoading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center text-gray-500">
                Đang tải danh sách bài thi...
              </div>
            ) : filteredExamAssignments.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có bài thi đăng ký</h3>
                <p className="text-gray-500">Hiện tại chưa có bài thi chuyên môn hoặc quy trình - kỹ năng trải nghiệm.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredExamAssignments.map((item) => {
                  const now = new Date();
                  const closeAt = new Date(item.close_at);
                  const isExpiredZero = (item.assignment_status === 'expired' || closeAt < now) && Number(item.score || 0) === 0;

                  return (
                    <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{item.subject_code}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getExamStatusClass(item)}`}>
                          {getExamStatusLabel(item)}
                        </span>
                      </div>

                      <div className="text-xs text-gray-600 space-y-1 mb-3">
                        <p><span className="font-medium">Loại:</span> {formatRegistrationType(item.registration_type)}</p>
                        <p><span className="font-medium">Bộ đề:</span> {item.set_code} - {item.set_name}</p>
                        <p><span className="font-medium">Mở:</span> {new Date(item.open_at).toLocaleString('vi-VN')}</p>
                        <p><span className="font-medium">Đóng:</span> {new Date(item.close_at).toLocaleString('vi-VN')}</p>
                        <p><span className="font-medium">Điểm:</span> {item.score === null ? 'Chưa có' : item.score}</p>
                      </div>

                      {item.can_take ? (
                        <Link
                          href={`/user/assignments/exam/${item.id}`}
                          className="w-full inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                        >
                          Bắt đầu làm bài
                        </Link>
                      ) : isExpiredZero && !item.explanation_status ? (
                        <Link
                          href={`/user/giaitrinh?assignment_id=${item.id}&subject=${encodeURIComponent(item.subject_code)}&test_date=${encodeURIComponent(item.open_at)}&campus=${encodeURIComponent(item.block_code)}`}
                          className="w-full inline-flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
                        >
                          Giải trình
                        </Link>
                      ) : item.explanation_status ? (
                        <div className="w-full inline-flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold">
                          Đã giải trình ({item.explanation_status})
                        </div>
                      ) : (
                        <div className="w-full inline-flex items-center justify-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">
                          {new Date(item.open_at) > now ? 'Chưa tới giờ mở' : 'Thông tin bài thi'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : assignments.length === 0 ? (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có bài tập</h3>
            <p className="text-gray-500">Hiện tại chưa có bài tập nào được giao cho bạn.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all overflow-hidden group"
              >
                <div className="bg-linear-to-br from-blue-500 to-blue-600 p-3 text-white">
                  <div className="flex items-start justify-between mb-1.5">
                    <BookOpen className="w-5 h-5 shrink-0" />
                    {assignment.status === 'published' && (
                      <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[10px] font-semibold">Mở</span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold mb-1 line-clamp-2 leading-tight">{assignment.assignment_title}</h3>
                  <p className="text-[11px] text-blue-100 line-clamp-1">{assignment.video_title}</p>
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2.5 text-xs flex-wrap">
                    <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                      <FileText className="w-3 h-3 text-gray-500" />
                      <span className="font-bold text-gray-900">{assignment.question_count || 0}</span>
                      <span className="text-gray-600">câu</span>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
                      <Award className="w-3 h-3 text-gray-500" />
                      <span className="font-bold text-gray-900">{assignment.total_points}</span>
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

                  {assignment.recent_submission && (
                    <div className={`mb-2.5 p-2.5 rounded-lg border ${
                      assignment.recent_submission.is_passed
                        ? 'bg-green-50 border-green-300'
                        : 'bg-amber-50 border-amber-300'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-gray-700">Điểm gần nhất:</span>
                        <span className={`text-lg font-bold ${
                          assignment.recent_submission.is_passed ? 'text-green-600' : 'text-amber-600'
                        }`}>
                          {assignment.recent_submission.score}
                          <span className="text-xs text-gray-500">/{assignment.total_points}</span>
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => startAssignment(assignment)}
                    disabled={assignment.status !== 'published'}
                    className={`w-full py-2 text-sm font-semibold h-auto ${
                      assignment.status === 'published'
                        ? 'shadow-sm hover:shadow-md'
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {assignment.status === 'published' ? 'Bắt đầu' : 'Chưa mở'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
