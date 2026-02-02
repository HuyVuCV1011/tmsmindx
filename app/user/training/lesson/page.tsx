'use client';

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";

interface Question {
  id: number;
  time: number;
  question: string;
  options: string[];
  answer: number;
}

function LessonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonId = searchParams.get('id');
  const videoUrl = searchParams.get('url');
  const title = searchParams.get('title');

  const [progress, setProgress] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState<number | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPaused, setVideoPaused] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  const [hasNextLesson, setHasNextLesson] = useState<boolean>(true);
  const [nextLessonData, setNextLessonData] = useState<any>(null);
  const [maxWatchedTime, setMaxWatchedTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Load questions from database
  useEffect(() => {
    const loadQuestions = async () => {
      if (!lessonId) {
        console.warn('[Lesson] ⚠️ No lessonId found in URL');
        setQuestions([]);
        return;
      }
      try {
        console.log(`[Lesson] 📥 Loading questions for video_id=${lessonId}`);
        const response = await fetch(`/api/training-video-questions?video_id=${lessonId}`);
        const data = await response.json();
        console.log('[Lesson] API Response:', { success: data.success, count: data.data?.length || 0, data });
        
        if (data.success && data.data && data.data.length > 0) {
          const loadedQuestions = data.data.map((q: any) => ({
            id: q.id,
            time: q.time_in_video || 0,
            question: q.question_text,
            options: typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []),
            answer: parseInt(q.correct_answer) || 0
          }));
          setQuestions(loadedQuestions);
          console.log(`[Lesson] ✅ Successfully loaded ${loadedQuestions.length} questions:`, loadedQuestions.map((q: Question) => `${q.question} (${q.time}s)`).join(', '));
        } else {
          console.log('[Lesson] ⚠️ No questions found in response or API failed');
          setQuestions([]);
        }
      } catch (err) {
        console.error('[Lesson] ❌ Error loading questions:', err);
        setQuestions([]);
      }
    };
    loadQuestions();
  }, [lessonId]);

  // Update playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      console.log(`[Lesson] Playback speed set to ${playbackSpeed}x`);
    }
  }, [playbackSpeed]);

  // Check for next lesson
  useEffect(() => {
    const checkNextLesson = async () => {
      if (!lessonId) return;
      
      try {
        console.log(`[Lesson] Checking for next lesson after video_id=${lessonId}`);
        const response = await fetch('/api/training-videos');
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
          const videos = data.data;
          const currentIndex = videos.findIndex((v: any) => v.id.toString() === lessonId);
          
          if (currentIndex !== -1 && currentIndex < videos.length - 1) {
            // Has next lesson
            setHasNextLesson(true);
            setNextLessonData(videos[currentIndex + 1]);
            console.log('[Lesson] ✓ Next lesson found:', videos[currentIndex + 1]);
          } else {
            // No next lesson (completed all)
            setHasNextLesson(false);
            console.log('[Lesson] ✓ All lessons completed!');
          }
        }
      } catch (err) {
        console.error('[Lesson] Error checking next lesson:', err);
      }
    };
    
    checkNextLesson();
  }, [lessonId]);

  // Check for questions at current time
  useEffect(() => {
    if (videoPaused || questions.length === 0 || currentQuestionIdx !== null) return;
    if (currentTime === 0 || duration === 0) return;
    
    // Log question status periodically
    if (Math.floor(currentTime) % 5 === 0 && Math.floor(currentTime) !== 0) {
      console.log(`[Lesson] Checking questions at ${currentTime.toFixed(2)}s. Found ${questions.length} questions:`, 
        questions.map(q => `Q${q.id}@${q.time}s(${answeredQuestions.has(q.id) ? 'answered' : 'pending'})`).join(', ')
      );
    }
    
    // Find question at current time (within 2 second tolerance)
    const foundQuestion = questions.findIndex(q => {
      const timeDiff = Math.abs(q.time - currentTime);
      return timeDiff <= 2 && !answeredQuestions.has(q.id);
    });
    
    if (foundQuestion !== -1) {
      console.log(`[Lesson] 🎯 Question triggered at ${currentTime.toFixed(2)}s:`, questions[foundQuestion]);
      setCurrentQuestionIdx(foundQuestion);
      setVideoPaused(true);
      // Pause video
      if (videoRef.current) {
        videoRef.current.pause();
        console.log('[Lesson] ⏸️ Video paused');
      }
    }
  }, [currentTime, questions, answeredQuestions, videoPaused, currentQuestionIdx]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Update max watched time
      setMaxWatchedTime(prev => Math.max(prev, video.currentTime));
      
      // Log every 5 seconds
      if (Math.floor(video.currentTime) % 5 === 0 && Math.floor(video.currentTime) !== 0) {
        console.log(`[Lesson] Video time: ${video.currentTime.toFixed(2)}s`);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      console.log(`[Lesson] ✓ Video loaded - Duration: ${video.duration.toFixed(2)}s`);
    };

    const handleEnded = () => {
      setProgress(100);
      setVideoCompleted(true);
      console.log('[Lesson] Video ended');
    };

    const handlePlaying = () => {
      console.log('[Lesson] Video playing');
    };

    const handlePause = () => {
      console.log('[Lesson] Video paused at', video.currentTime.toFixed(2) + 's');
    };

    const handleError = (e: any) => {
      console.error('[Lesson] Video error:', video.error, e);
    };

    const handleSeeking = () => {
      // Prevent seeking forward beyond what has been watched
      if (video.currentTime > maxWatchedTime + 0.5) {
        console.log(`[Lesson] ⚠️ Seeking blocked! Attempted: ${video.currentTime.toFixed(2)}s, Max watched: ${maxWatchedTime.toFixed(2)}s`);
        video.currentTime = maxWatchedTime;
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      video.removeEventListener('seeking', handleSeeking);
    };
  }, []);

  // Update progress bar based on video time
  useEffect(() => {
    if (duration > 0) {
      const calculatedProgress = (currentTime / duration) * 100;
      setProgress(Math.min(100, Math.max(0, calculatedProgress)));
    }
  }, [currentTime, duration]);

  const handleAnswerQuestion = () => {
    if (currentQuestionIdx === null || userAnswer === null) return;
    
    const question = questions[currentQuestionIdx];
    const isCorrect = userAnswer === question.answer;
    
    console.log(`[Lesson] Answer submitted:`, {
      question: question.question,
      userAnswer: userAnswer,
      correctAnswer: question.answer,
      isCorrect: isCorrect
    });
    
    // Mark as answered
    setAnsweredQuestions(prev => new Set([...prev, question.id]));
    
    // Show result UI
    setIsCorrectAnswer(isCorrect);
    setShowResult(true);
  };

  const handleContinue = () => {
    // Reset states and resume video
    setCurrentQuestionIdx(null);
    setUserAnswer(null);
    setShowResult(false);
    setIsCorrectAnswer(false);
    setVideoPaused(false);
    console.log('[Lesson] Resuming video playback');
    if (videoRef.current) {
      videoRef.current.play();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-800">{title ? decodeURIComponent(title) : 'Bài học'}</h1>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Video player */}
          <div className="flex-1 flex flex-col border-r border-gray-200 overflow-hidden">
            {/* Video container */}
            <div className="flex-1 bg-black relative overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl ? decodeURIComponent(videoUrl) : ''}
                className="w-full h-full"
                controls
              />
              {/* Playback speed controls */}
              <div className="absolute top-4 right-4 z-40">
                <div className="bg-black bg-opacity-70 rounded-lg p-2 flex gap-2">
                  <span className="text-white text-xs font-semibold self-center mr-1">Tốc độ:</span>
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition ${
                        playbackSpeed === speed
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
              {/* Question modal overlay */}
              {currentQuestionIdx !== null && (
                <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
                    <div className="mb-6">
                      {/* Result indicator */}
                      {showResult && (
                        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                          isCorrectAnswer 
                            ? 'bg-green-100 border-2 border-green-500' 
                            : 'bg-red-100 border-2 border-red-500'
                        }`}>
                          {isCorrectAnswer ? (
                            <>
                              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="font-bold text-green-700">Chính xác!</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              <span className="font-bold text-red-700">Chưa chính xác!</span>
                            </>
                          )}
                        </div>
                      )}
                      
                      <h3 className="text-lg font-bold text-gray-800 mb-4">
                        {questions[currentQuestionIdx]?.question}
                      </h3>
                      <div className="space-y-3">
                        {questions[currentQuestionIdx]?.options.map((option: string, idx: number) => {
                          const isUserAnswer = userAnswer === idx;
                          const isCorrectOption = questions[currentQuestionIdx].answer === idx;
                          
                          let buttonClass = 'w-full p-3 text-left rounded-lg border-2 transition ';
                          
                          if (!showResult) {
                            // Before answering
                            buttonClass += isUserAnswer
                              ? 'border-yellow-500 bg-yellow-50'
                              : 'border-gray-200 hover:border-yellow-300';
                          } else {
                            // After answering
                            if (isCorrectOption) {
                              // Correct answer - always green
                              buttonClass += 'border-green-500 bg-green-50';
                            } else if (isUserAnswer && !isCorrectAnswer) {
                              // User's wrong answer - red
                              buttonClass += 'border-red-500 bg-red-50';
                            } else {
                              // Other options
                              buttonClass += 'border-gray-200 bg-gray-50';
                            }
                          }
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => !showResult && setUserAnswer(idx)}
                              disabled={showResult}
                              className={buttonClass}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`font-semibold mr-2 ${
                                    showResult && isCorrectOption 
                                      ? 'text-green-600' 
                                      : showResult && isUserAnswer && !isCorrectAnswer
                                      ? 'text-red-600'
                                      : 'text-purple-600'
                                  }`}>
                                    {String.fromCharCode(65 + idx)}.
                                  </span>
                                  <span className={
                                    showResult && isCorrectOption 
                                      ? 'text-green-700 font-semibold' 
                                      : showResult && isUserAnswer && !isCorrectAnswer
                                      ? 'text-red-700'
                                      : 'text-gray-800'
                                  }>
                                    {option}
                                  </span>
                                </div>
                                {showResult && isCorrectOption && (
                                  <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                                {showResult && isUserAnswer && !isCorrectAnswer && (
                                  <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {!showResult ? (
                      <button
                        onClick={handleAnswerQuestion}
                        disabled={userAnswer === null}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-bold py-2 rounded-lg transition"
                      >
                        Trả lời
                      </button>
                    ) : (
                      <button
                        onClick={handleContinue}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg transition"
                      >
                        Tiếp tục
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar section */}
            <div className="bg-white border-t border-gray-200 p-4">
              {/* Timeline with question markers */}
              <div className="mb-4">
                <div className="relative h-8 flex items-center">
                  {/* Progress bar background */}
                  <div className="absolute left-0 right-0 h-2 bg-gray-200 rounded-full top-1/2 transform -translate-y-1/2">
                    <div
                      className="h-2 bg-gradient-to-r from-purple-600 to-yellow-500 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  
                  {/* Question markers and timeline points */}
                  <div className="absolute left-0 right-0 h-8 flex items-center top-1/2 transform -translate-y-1/2">
                    {questions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="absolute transform -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col items-center group"
                        style={{
                          left: duration > 0 ? `${(q.time / duration) * 100}%` : '0%'
                        }}
                      >
                        {/* Marker dot */}
                        <div
                          className={`w-4 h-4 rounded-full border-2 transition ${
                            answeredQuestions.has(q.id)
                              ? 'bg-green-500 border-green-600'
                              : 'bg-orange-400 border-orange-500'
                          }`}
                        />
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          Câu {idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>


              </div>

              {/* Time display */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">
                  {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
                </span>
                <span className="text-purple-600 font-bold">{Math.round(progress)}%</span>
              </div>
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="w-80 bg-white flex flex-col overflow-hidden">
            {/* Sidebar header */}
            <div className="border-b border-gray-200 p-4">
              <h2 className="text-lg font-bold text-gray-800">Thông tin bài học</h2>
            </div>

            {/* Sidebar content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Questions list */}
              {questions.length > 0 ? (
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">📝 Câu hỏi tương tác ({questions.length})</h3>
                  <div className="space-y-2">
                    {questions.map((q, idx) => (
                      <div
                        key={q.id}
                        className={`p-3 rounded-lg text-sm border transition cursor-default ${
                          answeredQuestions.has(q.id)
                            ? 'bg-green-50 border-green-200'
                            : 'bg-orange-50 border-orange-200 hover:border-orange-300'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-purple-600 shrink-0">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-700 font-medium line-clamp-2">{q.question}</p>
                            <p className="text-xs text-gray-500 mt-1 font-mono">
                              🕐 {Math.floor(q.time / 60)}:{String(Math.floor(q.time % 60)).padStart(2, '0')}
                            </p>
                          </div>
                          {answeredQuestions.has(q.id) && (
                            <span className="text-green-600 font-bold shrink-0 text-lg">✓</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-700 font-medium">
                      ℹ️ Bài học này chưa có câu hỏi tương tác
                    </p>
                  </div>
                  {/* Debug info */}
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-xs font-mono text-gray-600">
                    <p className="font-bold mb-1">🔍 Debug Info:</p>
                    <p>Video ID: <span className="text-purple-600">{lessonId || 'Not found'}</span></p>
                    <p>Duration: <span className="text-purple-600">{duration > 0 ? duration.toFixed(2) + 's' : 'Loading...'}</span></p>
                    <p>Mở Console (F12) để xem logs chi tiết</p>
                  </div>
                </div>
              )}

              {/* Completion message */}
              {videoCompleted && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700 font-semibold">
                    ✓ Bạn đã hoàn thành bài học!
                  </p>
                </div>
              )}

              {/* Assignment - Show after video completed */}
              {videoCompleted && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-bold text-gray-800 mb-3">📋 Kiểm tra tổng kết</h3>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-blue-800 mb-1">Bài tập tổng hợp</p>
                        <p className="text-xs text-blue-700 leading-relaxed mb-3">
                          Hoàn thành bài kiểm tra để củng cố kiến thức đã học
                        </p>
                        <button
                          onClick={() => {
                            // Navigate to assignment page
                            router.push(`/user/assignments?lesson_id=${lessonId}`);
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <span>Bắt đầu làm bài</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Next lesson */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-bold text-gray-800 mb-3">Bài học kế tiếp</h3>
                {hasNextLesson && nextLessonData ? (
                  <div 
                    onClick={() => router.push(`/user/training/lesson?id=${nextLessonData.id}&url=${encodeURIComponent(nextLessonData.video_url)}&title=${encodeURIComponent(nextLessonData.title)}`)}
                    className="p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 cursor-pointer transition"
                  >
                    <p className="text-xs font-semibold text-purple-600 mb-1">Lesson {nextLessonData.id}</p>
                    <p className="text-sm text-gray-700">{nextLessonData.title}</p>
                  </div>
                ) : !hasNextLesson && videoCompleted ? (
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-green-800 mb-1">🎉 Xuất sắc!</p>
                        <p className="text-xs text-green-700 leading-relaxed">
                          Chúc mừng bạn đã hoàn thành tất cả các bài đào tạo nâng cao
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs text-gray-500">Đang tải...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    );
  }

export default function LessonPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-purple-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Đang tải bài học...</p>
        </div>
      </div>
    }>
      <LessonContent />
    </Suspense>
  );
}
