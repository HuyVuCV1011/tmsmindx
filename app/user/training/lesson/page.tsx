'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { useTeacher } from "@/lib/teacher-context";
import { useToast } from "@/lib/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";

interface Question {
  id: number;
  time: number;
  question: string;
  options: string[];
  answer: number;
}

function LessonContent() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { teacherProfile, isLoading: isTeacherLoading } = useTeacher();
  const toast = useToast();
  const searchParams = useSearchParams();
  const lessonIdParam = searchParams.get('id');

  // Get video details from Redux
  const { currentVideoId, videoLink, title: reduxTitle, duration: reduxDurationMinutes, segments } = useAppSelector((state) => state.training);

  // If IDs don't match or no video link, session is invalid (e.g. refresh)
  const isSessionValid = currentVideoId?.toString() === lessonIdParam && !!videoLink;

  const lessonId = isSessionValid ? currentVideoId!.toString() : null;
  const title = isSessionValid ? reduxTitle : null;
  // Convert minutes from Redux to seconds for the video player overlay
  const overrideDurationSeconds = isSessionValid ? (reduxDurationMinutes || 1) * 60 : 0;

  const videoSegments = useMemo(() => {
    return isSessionValid && segments && segments.length > 0
      ? segments
      : (videoLink ? [{ id: currentVideoId!, url: videoLink, duration_minutes: overrideDurationSeconds / 60 }] : []);
  }, [isSessionValid, segments, videoLink, currentVideoId, overrideDurationSeconds]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [localTime, setLocalTime] = useState(0); // Thời gian của video hiện tại
  const [pendingSeekTime, setPendingSeekTime] = useState<number | null>(null);

  // Tính toán trước mốc thời gian bắt đầu của từng video và tổng thời lượng từ DB / Redux
  const { totalDurationMap, startTimes } = useMemo(() => {
    let total = 0;
    const starts: number[] = [];
    videoSegments.forEach((vid: any) => {
      starts.push(total);
      // Sử dụng ưu tiên duration_seconds nếu có, else duration_minutes
      let segmentSecs = vid.duration_seconds != null ? Number(vid.duration_seconds) : (vid.duration_minutes || 0) * 60;
      total += segmentSecs;
    });
    // Nếu db không có chi tiết segment length nhưng có overide length
    if (total === 0) total = overrideDurationSeconds;

    return { totalDurationMap: total, startTimes: starts };
  }, [videoSegments, overrideDurationSeconds]);

  // globalTime sẽ là thời gian thực tế trong chuỗi video (để match với tracking progress API)
  const globalTime = (startTimes[currentIndex] ?? 0) + localTime;
  const videoUrl = videoSegments[currentIndex]?.url || null;

  const [progress, setProgress] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
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
  const [currentAssignment, setCurrentAssignment] = useState<any>(null); // Trạng thái bài tập của video hiện tại
  const [maxWatchedTime, setMaxWatchedTime] = useState(0);

  // Ref to track user for event handlers
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Ref to track current lesson ID for event handlers to access latest value
  const lessonIdRef = useRef(lessonId);
  useEffect(() => {
    lessonIdRef.current = lessonId;
  }, [lessonId]);

  // ── Guard: redirect non-admin users if teacher profile missing ──
  useEffect(() => {
    if (!user) return;
    if (isTeacherLoading) return;

    const isAdmin = (user as any).role === 'admin' || (user as any).isAdmin === true;
    if (isAdmin) return;

    // Check if teacher profile is valid
    if (!teacherProfile) {
      // Clear session data and redirect
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      router.replace('/login');
    }
  }, [user, isTeacherLoading, teacherProfile, router]);


  // Helper to save progress
  const saveCompletion = async (id: string | null, time: number) => {
    const currentUser = userRef.current;
    if (!id || !currentUser?.email) return;
    try {
      const teacherCode = currentUser.email.split('@')[0];
      await fetch('/api/training-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherCode,
          videoId: id,
          timeSpent: time,
          isCompleted: true,
          totalDuration: time, // Send total duration to update metadata
        })
      });
      console.log(`[Lesson] Saved completion for ${id}`);
    } catch (err) {
      console.error('[Lesson] Failed to save completion:', err);
    }
  };

  // Load assignment for the current video
  useEffect(() => {
    const loadAssignment = async () => {
      if (!lessonId) return;
      try {
        // Fetch assignment linked to this video
        const res = await fetch(`/api/training-assignments?video_id=${lessonId}&status=published`);
        const data = await res.json();

        if (data.success && data.data && data.data.length > 0) {
          // Lấy bài tập đầu tiên (hoặc có thể thêm logic chọn bài tập phù hợp)
          setCurrentAssignment(data.data[0]);
          console.log('[Lesson] Found assignment:', data.data[0]);
        } else {
          setCurrentAssignment(null);
        }
      } catch (err) {
        console.error('[Lesson] Failed to load assignment:', err);
      }
    };
    loadAssignment();
  }, [lessonId]);

  // (Rest of the component code...)

  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const lastValidTimeRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Ref to track if we are in quiz mode (to prevent auto-resume)
  const isQuizActiveRef = useRef(false);
  const isPlayingRef = useRef(false);
  /** false after tab hide / blur — blocks segment switch, loadedmetadata, canplay from calling play() until user clicks Play */
  const playbackAllowedRef = useRef(false);
  useEffect(() => {
    isQuizActiveRef.current = videoPaused || currentQuestionIdx !== null;
  }, [videoPaused, currentQuestionIdx]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Reset state when lesson changes
  useEffect(() => {
    setProgress(0);
    setVideoCompleted(false);
    setCurrentTime(0);
    setDuration(0);
    setQuestions([]);
    setCurrentQuestionIdx(null);
    setUserAnswer(null);
    setAnsweredQuestions(new Set());
    setVideoPaused(false);
    setShowResult(false);
    setIsCorrectAnswer(false);
    setMaxWatchedTime(0);
    setIsPlaying(false);
    playbackAllowedRef.current = false;

    // Reset video element
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.load();
    }
  }, [lessonId]);

  useEffect(() => {
    const docHidden = () =>
      typeof document !== 'undefined' &&
      (document.hidden ||
        document.visibilityState !== 'visible' ||
        // Safari legacy
        !!(document as Document & { webkitHidden?: boolean }).webkitHidden);

    const pauseAllVideos = (reason: string) => {
      playbackAllowedRef.current = false;
      isPlayingRef.current = false;
      setIsPlaying(false);
      document.querySelectorAll('video').forEach((v) => {
        if (!v.paused) v.pause();
      });
      console.log(`[Lesson] ⏸️ Paused: ${reason}`);
    };

    const handleVisibilityChange = () => {
      if (docHidden()) pauseAllVideos('visibility');
    };

    const handlePageHide = () => pauseAllVideos('pagehide');

    // Bổ sung khi visibility không đổi (ví dụ focus sang app/cửa sổ khác) — document mất focus → dừng phát
    const handleWindowBlur = () => {
      if (typeof document !== 'undefined' && !document.hasFocus()) {
        pauseAllVideos('window-blur');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange, true);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('blur', handleWindowBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved progress
  useEffect(() => {
    const loadProgress = async () => {
      if (!lessonId || !user?.email) return;

      try {
        const teacherCode = user.email.split('@')[0];
        const res = await fetch(`/api/training-progress?teacherCode=${teacherCode}&videoId=${lessonId}`);
        const data = await res.json();

        if (data.success && data.data) {
          const { time_spent_seconds, completion_status } = data.data;

          if (time_spent_seconds > 0) {
            // Find target video segment
            let targetIndex = 0;
            let timeInTargetVideo = time_spent_seconds;

            for (let i = 0; i < startTimes.length; i++) {
              const start = startTimes[i];
              const nextStart = startTimes[i + 1] || totalDurationMap;

              if (time_spent_seconds >= start && time_spent_seconds < nextStart) {
                targetIndex = i;
                timeInTargetVideo = time_spent_seconds - start;
                break;
              }
            }

            if (targetIndex === currentIndex) {
              if (videoRef.current) {
                const offset = videoRef.current.seekable.length > 0 ? videoRef.current.seekable.start(0) : 0;
                lastValidTimeRef.current = time_spent_seconds;
                videoRef.current.currentTime = timeInTargetVideo + offset;
                setLocalTime(timeInTargetVideo);
              }
            } else {
              setIsPlaying(false);
              isPlayingRef.current = false;
              lastValidTimeRef.current = time_spent_seconds;
              setCurrentIndex(targetIndex);
              setPendingSeekTime(timeInTargetVideo);
            }
            console.log(`[Lesson] Resumed at ${time_spent_seconds}s`);
          }

          if (completion_status === 'completed') {
            // setVideoCompleted(true); // Don't show overlay immediately
            setProgress(100);
          }
        }
      } catch (err) {
        console.error('[Lesson] Failed to load progress:', err);
      }
    };

    loadProgress();
  }, [lessonId, user]);

  // Save progress periodically (every 10 seconds)
  useEffect(() => {
    if (!isPlaying || !lessonId || !user?.email) return;

    const teacherCode = user.email.split('@')[0];
    const interval = setInterval(async () => {
      // Get current time directly from video element for accuracy
      const time = videoRef.current ? videoRef.current.currentTime : 0;
      const duration = videoRef.current ? videoRef.current.duration : 0;
      if (time <= 0) return;

      try {
        await fetch('/api/training-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacherCode,
            videoId: lessonId,
            timeSpent: time,
            isCompleted: false,
            totalDuration: duration > 0 ? duration : undefined
          })
        });
      } catch (err) {
        console.error('[Lesson] Failed to save progress:', err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isPlaying, lessonId, user]);

  // Save progress on completion (removed)
  useEffect(() => {
    // Only run when lessonId changes to reset state
    // Old implementation was causing auto-complete on next video
    // Keeping this comment for context, but effect is effectively removed
  }, []);

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

    // Immediately play if already buffered — chỉ khi user đã bật phát (không tự play sau khi vừa ẩn tab)
    if (
      playbackAllowedRef.current &&
      isPlayingRef.current &&
      video.readyState >= 1 &&
      !document.hidden &&
      document.visibilityState === 'visible'
    ) {
      video.play().catch(e => console.log('[Lesson] Play blocked:', e));
      setIsWaiting(false);
    }

    // Đảm bảo volume áp dụng lại cho video mới
    video.volume = volume;

    const handleTimeUpdate = () => {
      const webkitHidden = !!(document as Document & { webkitHidden?: boolean }).webkitHidden;
      if (document.hidden || document.visibilityState !== 'visible' || webkitHidden) {
        if (!video.paused) video.pause();
        playbackAllowedRef.current = false;
        isPlayingRef.current = false;
        setIsPlaying(false);
        return;
      }
      if (!playbackAllowedRef.current) {
        if (!video.paused) video.pause();
        isPlayingRef.current = false;
        setIsPlaying(false);
        return;
      }

      // Security: Enforce max playback speed of 2x (Anti-cheat)
      if (video.playbackRate > 2) {
        console.log('[Lesson] ⚠️ Speed limit exceeded! Resetting to 2x');
        video.playbackRate = 2;
        setPlaybackSpeed(2);
      }

      const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0;
      const localCrtTime = Math.max(0, video.currentTime - offset);
      const gTime = (startTimes[currentIndex] ?? 0) + localCrtTime;
      const lastTime = lastValidTimeRef.current;

      // Block both forward and backward seeking beyond 3 seconds (to allow natural playback and normal minor variations)
      const allowedJump = Math.max(3, video.playbackRate * 2);

      if (Math.abs(gTime - lastTime) > allowedJump) {
        console.log(`[Lesson] 🚫 Seek blocked! Attempted: ${gTime.toFixed(2)}s (Last: ${lastTime.toFixed(2)}s)`);
        video.currentTime = Math.max(0, lastValidTimeRef.current - (startTimes[currentIndex] ?? 0)) + offset;
        return;
      }

      // Update last valid time (for seeking prevention)
      lastValidTimeRef.current = gTime;

      setLocalTime(localCrtTime);
      setCurrentTime(gTime);

      // Update max watched time
      setMaxWatchedTime(prev => Math.max(prev, gTime));

      // [Pre-Fetching & Early Switch] Chuyển trước 250ms — không làm khi tab ẩn (tránh vẫn phát / auto-next ở background)
      if (currentIndex < videoSegments.length - 1 && video.duration > 0) {
        const timeRemaining = video.duration - localCrtTime;
        if (timeRemaining <= 0.25) {
          const tabHidden = document.hidden || document.visibilityState !== 'visible' || webkitHidden;
          if (tabHidden || !playbackAllowedRef.current) {
            if (!video.paused) video.pause();
            setIsPlaying(false);
            isPlayingRef.current = false;
            return;
          }
          console.log(`[Lesson] Early switching to segment ${currentIndex + 1} (Pre-ending by ${timeRemaining.toFixed(2)}s)`);
          setIsWaiting(true);
          setCurrentIndex(prev => prev + 1);
          setIsPlaying(true);
          isPlayingRef.current = true;
          return;
        }
      }

      // Log every 5 seconds
      if (Math.floor(gTime) % 5 === 0 && Math.floor(gTime) !== 0) {
        console.log(`[Lesson] Video time: ${gTime.toFixed(2)}s`);
      }
    };

    const handleLoadedMetadata = () => {
      const webkitHidden = !!(document as Document & { webkitHidden?: boolean }).webkitHidden;
      const visible =
        !document.hidden && document.visibilityState === 'visible' && !webkitHidden;
      // Setup the real video segment duration mapped against start times if DB missed them
      const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0;
      if (pendingSeekTime !== null) {
        video.currentTime = pendingSeekTime + offset;
        setPendingSeekTime(null);
      } else {
        if (playbackAllowedRef.current && isPlayingRef.current && visible) {
          video.play().catch(e => console.log('[Lesson] Auto-play policy blocked next video play:', e));
          setIsWaiting(false);
        }
      }

      if (playbackAllowedRef.current && (isPlayingRef.current || pendingSeekTime !== null) && visible) {
        video.play().catch(console.error);
        setIsPlaying(true);
        isPlayingRef.current = true;
      }

      // For single-segment videos, always use the real duration from the browser.
      // overrideDurationSeconds (from DB) is only a fallback when browser can't determine duration.
      if (startTimes.length === 1) {
        setDuration(video.duration > 0 ? video.duration : overrideDurationSeconds);
      } else {
        setDuration(totalDurationMap);
      }
    };

    const handleCanPlay = () => {
      if (
        playbackAllowedRef.current &&
        isPlayingRef.current &&
        !document.hidden &&
        document.visibilityState === 'visible'
      ) {
        video.play().catch(e => console.log('Auto-play issue:', e));
        setIsWaiting(false);
      }
    };

    const handleEnded = () => {
      if (currentIndex < videoSegments.length - 1) {
        // Có phần tiếp theo của video hiện tại (Cloudinary parts)
        console.log(`[Lesson] Switching to segment ${currentIndex + 1}`);

        // Vanilla DOM fix for gapless transitions
        const nextVideoEl = document.getElementById(`video-part-${currentIndex + 1}`) as HTMLVideoElement;
        if (nextVideoEl) {
          nextVideoEl.muted = volume === 0;
          nextVideoEl.volume = volume;
          nextVideoEl.currentTime = 0;
          
          const isHidden =
            document.hidden ||
            document.visibilityState === 'hidden' ||
            !!(document as Document & { webkitHidden?: boolean }).webkitHidden;
          if (playbackAllowedRef.current && isPlayingRef.current && !isHidden) {
            nextVideoEl.play().catch(e => console.error('[Lesson] Gapless playback blocked:', e));
            setIsPlaying(true);
          } else {
            setIsPlaying(false);
            isPlayingRef.current = false;
          }
          
          nextVideoEl.classList.remove('hidden');
          nextVideoEl.classList.add('block');

          video.classList.remove('block');
          video.classList.add('hidden');
        }

        setIsWaiting(false);
        setCurrentIndex(prev => prev + 1);
        if (!document.hidden && playbackAllowedRef.current && isPlayingRef.current) {
          setIsPlaying(true);
        } else {
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
      } else {
        setProgress(100);
        setVideoCompleted(true);
        setIsPlaying(false);
        console.log('[Lesson] Video ended');

        // Save completion immediately using the current lesson ID and user
        if (lessonIdRef.current && userRef.current?.email) {
          saveCompletion(lessonIdRef.current, totalDurationMap || duration);
        }
      }
    };

    const handlePlaying = () => {
      const webkitHidden = !!(document as Document & { webkitHidden?: boolean }).webkitHidden;
      if (document.hidden || document.visibilityState !== 'visible' || webkitHidden || !playbackAllowedRef.current) {
        video.pause();
        playbackAllowedRef.current = false;
        setIsPlaying(false);
        isPlayingRef.current = false;
        return;
      }
      setIsWaiting(false);
      console.log('[Lesson] Video playing');
    };

    const handlePause = () => {
      console.log('[Lesson] Video paused at', video.currentTime.toFixed(2) + 's');
      if (lessonIdRef.current && userRef.current?.email) {
        const teacherCode = userRef.current.email.split('@')[0];
        fetch('/api/training-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacherCode,
            videoId: lessonIdRef.current,
            timeSpent: video.currentTime,
            isCompleted: false,
            totalDuration: video.duration // Update duration
          })
        }).catch(err => console.error('[Lesson] Failed to save on pause:', err));
      }
    };

    const handleError = (e: any) => {
      console.error('[Lesson] Video error:', video.error, e);
      if (video.error && video.error.code === 4) {
        toast.error("Không thể ghép nối video trên bộ nhớ Cloudinary (Vượt size 100MB!).");
      } else {
        toast.error("Lỗi tải luồng trình phát video, vui lòng tải lại trang.");
      }
    };

    const handleSeeking = () => {
      const offset = video.seekable.length > 0 ? video.seekable.start(0) : 0;
      const attemptedTime = Math.max(0, video.currentTime - offset);
      const localLastTime = Math.max(0, lastValidTimeRef.current - (startTimes[currentIndex] ?? 0));

      const allowedJump = Math.max(5, video.playbackRate * 2);

      // Block seeking both forward and backward
      if (Math.abs(attemptedTime - localLastTime) > allowedJump) {
        console.log(`[Lesson] 🚫 Seeking blocked! Attempted: ${attemptedTime.toFixed(2)}s → Reverted to: ${localLastTime.toFixed(2)}s`);
        video.currentTime = localLastTime + offset;
      }
    };

    const handleRateChange = () => {
      if (video.playbackRate > 2) {
        console.log('[Lesson] 🚫 External speed tool detected! Resetting to 2x');
        video.playbackRate = 2;
        setPlaybackSpeed(2);
      }
    };

    const handleWaiting = () => setIsWaiting(true);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ratechange', handleRateChange);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);
    video.addEventListener('waiting', handleWaiting);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ratechange', handleRateChange);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('waiting', handleWaiting);
    };
  }, [currentIndex, isPlaying, volume, pendingSeekTime, videoSegments, startTimes, overrideDurationSeconds, totalDurationMap, duration]);

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
      playbackAllowedRef.current = true;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // Custom video controls handlers
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        playbackAllowedRef.current = true;
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    if (!isFullscreen) {
      if (playerContainerRef.current.requestFullscreen) {
        playerContainerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle invalid session (e.g. refresh) by redirecting
  useEffect(() => {
    if (!videoUrl) {
      router.push('/user/training');
    }
  }, [videoUrl, router]);

  if (!videoUrl) return null; // Render nothing while redirecting

  return (
    <div className="bg-black h-screen overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Header - compact */}
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 px-4 py-2 flex items-center gap-3 z-50">
          <button
            onClick={() => router.back()}
            className="p-1.5 hover:bg-white/10 rounded-full transition"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-sm font-bold text-white truncate flex-1">{title || 'Bài học'}</h1>
          <div className="text-xs text-white/80">
            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
          </div>
        </div>

        {/* Video player container */}
        <div
          ref={playerContainerRef}
          className="flex-1 relative bg-black overflow-hidden"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
        >
          {/* Multi-video buffering logic: We render ALL video segments but only ONE is visible and attached to videoRef.
              This guarantees the browser completes DNS handshake, preload cache, and audio initialization bounds BEFORE they appear.
          */}
          {videoSegments.map((segment: any, idx: number) => {
            const isActive = idx === currentIndex;
            const isNext = idx === currentIndex + 1;

            // Only render current, next, or keep DOM alive to prevent re-load
            if (!isActive && !isNext) return null;

            return (
              <video
                key={segment.id}
                id={`video-part-${idx}`}
                ref={isActive ? videoRef : null}
                src={segment.url}
                preload={isActive || isNext ? "auto" : "none"}
                className={`w-full h-full object-contain ${isActive ? 'block' : 'hidden'}`}
                onClick={isActive ? togglePlayPause : undefined}
                onContextMenu={(e) => e.preventDefault()}
                playsInline
                // If this is the next video, keep it muted so browser aggressive autoplay policies don't complain during background buffer
                muted={!isActive || volume === 0}
              />
            );
          })}

          {/* Loading overlay */}
          {isWaiting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
              <Loader2 className="w-16 h-16 text-white animate-spin" />
            </div>
          )}

          {/* Central Play/Pause overlay */}
          {!isPlaying && currentQuestionIdx === null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <button
                onClick={togglePlayPause}
                className="bg-white/90 hover:bg-white rounded-full p-8 transition-all hover:scale-110"
              >
                <svg className="w-16 h-16 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </button>
            </div>
          )}

          {/* Custom Controls Overlay */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6 transition-all duration-300 ${showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
              }`}
          >
            {/* Progress bar - Enhanced MultiVideoPlayer features */}
            <div className="mb-4">
              <div
                className="relative h-10 flex items-center cursor-pointer group"
              >
                {/* Progress bar background */}
                <div className="absolute left-0 right-0 h-1.5 bg-white/20 rounded-full top-1/2 transform -translate-y-1/2 group-hover:h-2 transition-all">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-yellow-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Question markers */}
                <div className="absolute left-0 right-0 h-10 flex items-center top-1/2 transform -translate-y-1/2">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="absolute transform -translate-x-1/2"
                      style={{
                        left: duration > 0 ? `${(q.time / duration) * 100}%` : '0%'
                      }}
                    >
                      <div
                        className={`w-3 h-3 rounded-full border-2 transition ${answeredQuestions.has(q.id)
                            ? 'bg-green-400 border-green-500'
                            : 'bg-orange-400 border-orange-500 animate-pulse'
                          }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Controls bar */}
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="p-2 hover:bg-white/10 rounded-full transition"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVolumeChange(volume > 0 ? 0 : 1)}
                  className="p-2 hover:bg-white/10 rounded-full transition"
                >
                  {volume === 0 ? (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`
                  }}
                />
              </div>

              {/* Speed control */}
              <div className="flex items-center gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-1 rounded text-xs font-semibold transition ${playbackSpeed === speed
                        ? 'bg-purple-600 text-white'
                        : 'text-white/70 hover:bg-white/10'
                      }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Progress percentage */}
              <span className="text-white text-sm font-bold">
                {Math.round(progress)}%
              </span>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-white/10 rounded-full transition"
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Question modal overlay */}
          {currentQuestionIdx !== null && (
            <div className="absolute inset-0 bg-transparent flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4 border border-gray-200">
                <div className="mb-6">
                  {/* Result indicator */}
                  {showResult && (
                    <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${isCorrectAnswer
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
                              <span className={`font-semibold mr-2 ${showResult && isCorrectOption
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
                  <Button
                    onClick={handleAnswerQuestion}
                    disabled={userAnswer === null}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white font-bold py-2 h-auto text-base"
                  >
                    Trả lời
                  </Button>
                ) : (
                  <Button
                    onClick={handleContinue}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 h-auto text-base"
                  >
                    Tiếp tục
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Completion overlay */}
          {videoCompleted && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
              <div className="bg-white rounded-xl p-8 max-w-md w-full text-center space-y-6 animate-fade-in">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Chúc mừng bạn đã hoàn thành!</h2>
                  <p className="text-gray-600">Bạn đã xem hết nội dung bài học này.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 w-full">
                  <Button
                    onClick={() => {
                      if (currentAssignment) {
                        // User requested to keep flow in /user/training
                        router.push(`/user/training?start_assignment_id=${currentAssignment.id}`);
                      } else {
                        // Fallback to training list if no assignment found
                        router.push(`/user/training`);
                      }
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 h-auto text-lg rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-center gap-2">

                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      Làm bài tập & Kiểm tra
                    </div>
                  </Button>

                  {/* Next Lesson button removed */}

                  <Button
                    variant="ghost"
                    onClick={() => {
                      playbackAllowedRef.current = true;
                      setVideoCompleted(false);
                      videoRef.current?.play();
                      setIsPlaying(true);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Xem lại video
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom info bar - only in non-fullscreen */}
        {!isFullscreen && (
          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white px-4 py-3 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Video không cho phép tua</span>
            </div>
            <div className="h-4 w-px bg-white/30" />
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>{questions.length} câu hỏi</span>
            </div>
            <div className="h-4 w-px bg-white/30" />
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{answeredQuestions.size} {" / "} {questions.length} đã trả lời</span>
            </div>
            <div className="flex-1" />
            {videoCompleted && (
              <Button
                variant="ghost"
                onClick={() => router.push(`/user/assignments?lesson_id=${lessonId}`)}
                className="bg-white/10 hover:bg-white/20 hover:text-white px-4 py-1.5 font-semibold transition flex items-center gap-2 h-auto text-white"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
                <span>Làm bài tập</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LessonPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          <div className="aspect-video bg-gray-300 rounded"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            <div className="h-4 bg-gray-300 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    }>
      <LessonContent />
    </Suspense>
  );
}
