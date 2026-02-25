"use client";

import { useAuth } from "@/lib/auth-context";
import { Briefcase, Calendar, Clock, Mail, MapPin, Search, TrendingUp, User, UserCheck } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from 'react-hot-toast';
import useSWR, { mutate } from "swr";

// Cache for processed data
const dataCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface TeacherAvailability {
  timestamp: string;
  email: string;
  name: string;
  mainSubject: string;
  subjects: string;
  mainBranch: string;
  branches: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  notes: string;
}

interface TestRecord {
  area: string;
  name: string;
  email: string;
  subject?: string;
  branch: string;
  code: string;
  type: string;
  teachingLevel?: string;
  month: string;
  year: string;
  batch: string;
  time: string;
  exam?: string;
  correct: string;
  score: string;
  emailExplanation: string;
  processing: string;
  date: string;
  isCountedInAverage: boolean;
}

interface MonthlyAverage {
  month: string;
  average: number;
  count: number;
  records: TestRecord[];
}

interface Teacher {
  stt: string;
  name: string;
  code: string;
  emailMindx: string;
  emailPersonal: string;
  status: string;
  branchIn: string;
  programIn: string;
  branchCurrent: string;
  programCurrent: string;
  manager: string;
  responsible: string;
  position: string;
  startDate: string;
  onboardBy: string;
}

interface TrainingLesson {
  name: string;
  score: number;
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

// Memoized InfoItem component
const InfoItem = memo(({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => {
  return (
    <div className="flex items-start gap-2 p-2 rounded border border-gray-200">
      <div className="text-gray-600 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-600">{label}</div>
        <div className="text-sm font-medium text-gray-900 truncate">{value}</div>
      </div>
    </div>
  );
});
InfoItem.displayName = 'InfoItem';

// API Secret Key for internal requests
const API_SECRET_KEY = process.env.NEXT_PUBLIC_API_SECRET || 'mindx-teaching-internal-2025';

// Optimized fetcher with better caching and compression
const fetcher = async (url: string) => {
  // Check cache first
  const cacheKey = url;
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('📦 Using cached data for:', url);
    return cached.data;
  }

  const res = await fetch(url, {
    next: { revalidate: 300 }, // Cache 5 minutes
    headers: {
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=300, stale-while-revalidate=600',
      'x-api-key': API_SECRET_KEY
    }
  });
  if (!res.ok) throw new Error('Failed to fetch');

  const data = await res.json();

  // Store in cache
  dataCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  return data;
};

// Function to extract teacher code from email
function extractCodeFromEmail(email: string): string {
  const match = email.match(/^([^@]+)@/);
  return match ? match[1] : '';
}

export default function Page1() {
  const { user } = useAuth();
  const [searchCode, setSearchCode] = useState("");
  const [submitCode, setSubmitCode] = useState("");
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const [isResolvingCode, setIsResolvingCode] = useState(false);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("12");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedTableYear, setSelectedTableYear] = useState("2025");

  // Debounce refs
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchRef = useRef("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMonth, setModalMonth] = useState<string | null>(null);
  const [modalType, setModalType] = useState<"expertise" | "experience" | null>(null);
  const [modalRecords, setModalRecords] = useState<TestRecord[]>([]);

  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackFeature, setFeedbackFeature] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccessModalOpen, setFeedbackSuccessModalOpen] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [isFirstTimeFeedback, setIsFirstTimeFeedback] = useState(false);
  const [feedbackEnabled, setFeedbackEnabled] = useState(true); // can be turned off by user

  const disableFeedback = () => {
    try {
      localStorage.setItem('feedbackDisabled', 'true');
      setFeedbackEnabled(false);
      setFeedbackModalOpen(false);
    } catch (e) {
      console.warn('Unable to persist feedbackDisabled flag', e);
      setFeedbackEnabled(false);
      setFeedbackModalOpen(false);
    }
  };

  const enableFeedback = () => {
    try {
      localStorage.removeItem('feedbackDisabled');
      setFeedbackEnabled(true);
    } catch (e) {
      console.warn('Unable to remove feedbackDisabled flag', e);
      setFeedbackEnabled(true);
    }
  };
  const [availabilityPeriod, setAvailabilityPeriod] = useState<"week" | "month" | "year">("month");
  const [notFoundModalOpen, setNotFoundModalOpen] = useState(false);
  const [registrationCheckModalOpen, setRegistrationCheckModalOpen] = useState(false);

  // Custom fetcher với Authorization header và token refresh
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

    // Handle 401 -> attempt silent refresh with refreshToken
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
              // retry original request
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
        // If still unauthorized after refresh attempt, force logout
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

  // Auto-search based on logged-in user's email - ONLY ONCE
  useEffect(() => {
    if (user && user.email && !hasAutoSearched && !submitCode) {
      // Mark we've attempted auto-search so we don't repeat
      setHasAutoSearched(true);
      setIsResolvingCode(true);

      // First try resolving teacher by exact email (work OR personal)
      (async () => {
        try {
          console.log('🔍 Attempting teacher lookup by email first:', user.email);
          const res = await secureFetcher(`/api/teachers?email=${encodeURIComponent(user.email)}`);
          if (res?.teacher?.code) {
            console.log('✅ Found teacher by email:', res.teacher.code);
            setSearchCode(res.teacher.code);
            setSubmitCode(res.teacher.code);
            setIsResolvingCode(false);
            return;
          }
        } catch (err) {
          // ignore and fallback to code extraction
          console.warn('Email-based lookup failed, falling back to code extraction');
        }

        // Fallback: try extracting code from the email local-part
        const code = extractCodeFromEmail(user.email);
        if (code) {
          console.log('🔁 Fallback: Auto-searching for teacher code from email prefix:', code);
          setSearchCode(code);
          setSubmitCode(code);
        }

        setIsResolvingCode(false);
      })();
    }

    // Check if user has already given feedback
    if (!hasAutoSearched) {
      const feedbackGiven = localStorage.getItem('userHasFeedback');
      if (feedbackGiven === 'true') {
        setHasFeedback(true);
      }

      const disabled = localStorage.getItem('feedbackDisabled');
      if (disabled === 'true') {
        setFeedbackEnabled(false);
      }
    }
  }, [user, hasAutoSearched, submitCode, secureFetcher]);

  // Optimized SWR with better caching and parallel loading
  const { data: teacherData, isLoading: isLoadingTeacher, error: teacherError } = useSWR(
    submitCode && user ? `/api/teachers?code=${submitCode}` : null,
    secureFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000, // 5 minutes deduping
      shouldRetryOnError: false,
      revalidateIfStale: false // Don't revalidate stale data automatically
    }
  );

  const teacher = teacherData?.teacher || null;

  // Parallel loading of score data - start immediately after teacher is found
  const { data: expertiseDataRes, isLoading: isLoadingExpertise } = useSWR(
    teacher && user ? `/api/rawdata?code=${submitCode}` : null,
    secureFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000,
      shouldRetryOnError: false,
      revalidateIfStale: false
    }
  );

  const { data: experienceDataRes, isLoading: isLoadingExperience } = useSWR(
    teacher && user ? `/api/rawdata-experience?code=${submitCode}` : null,
    secureFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000,
      shouldRetryOnError: false,
      revalidateIfStale: false
    }
  );

  // Load training data in parallel
  const { data: trainingData, isLoading: isLoadingTraining } = useSWR(
    teacher && user ? `/api/training?code=${submitCode}` : null,
    secureFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000,
      shouldRetryOnError: false,
      revalidateIfStale: false
    }
  );

  const expertiseData = expertiseDataRes?.monthlyData || [];
  const experienceData = experienceDataRes?.monthlyData || [];
  const scoresLoaded = !isLoadingExpertise && !isLoadingExperience;

  // Show feedback modal 30 seconds after successful teacher search
  useEffect(() => {
    // Auto-show disabled by default; enable by setting NEXT_PUBLIC_FEEDBACK_AUTO_SHOW=true
    const autoShowEnabled = process.env.NEXT_PUBLIC_FEEDBACK_AUTO_SHOW === 'true';

    if (autoShowEnabled && submitCode && teacherData && !hasFeedback && !feedbackModalOpen && feedbackEnabled) {
      const timer = setTimeout(() => {
        setFeedbackModalOpen(true);
        setIsFirstTimeFeedback(false); // Disabled mandatory behavior
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [submitCode, teacherData, hasFeedback, feedbackModalOpen, feedbackEnabled]);

  // If code-based lookup fails on first auto-search, try resolving teacher by the logged-in email (work OR personal)
  useEffect(() => {
    if (teacherError && hasAutoSearched && user?.email) {
      (async () => {
        try {
          setIsResolvingCode(true);
          console.log('🔁 Teacher lookup by code failed; trying lookup by email:', user.email);
          const res = await secureFetcher(`/api/teachers?email=${encodeURIComponent(user.email)}`);
          if (res?.teacher?.code) {
            console.log('✅ Resolved teacher code by email:', res.teacher.code);
            setSubmitCode(res.teacher.code);
          }
        } catch (err) {
          console.warn('Lookup by email failed', err);
        } finally {
          setIsResolvingCode(false);
        }
      })();
    }
  }, [teacherError, hasAutoSearched, user?.email, secureFetcher]);

  // Prevent body scroll when feedback modal is open
  useEffect(() => {
    if (feedbackModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [feedbackModalOpen]);

  // Fetch availability data - dynamic date range based on period
  const { fromDate: availabilityFromDate, toDate: availabilityToDate } = useMemo(() => {
    const date = new Date();
    const today = date.toISOString().split('T')[0];
    const fromDate = new Date();

    if (availabilityPeriod === 'week') {
      // Get start of current week (Sunday)
      const dayOfWeek = date.getDay();
      fromDate.setDate(date.getDate() - dayOfWeek);
    } else if (availabilityPeriod === 'month') {
      // Get start of current month
      fromDate.setDate(1);
    } else {
      // Get start of current year
      fromDate.setMonth(0);
      fromDate.setDate(1);
    }

    return {
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: today
    };
  }, [availabilityPeriod]);

  // Load availability AFTER scores are loaded - filter by teacher name on server side
  // This allows UI to render first, then load availability data later
  const { data: availabilityDataRes, isLoading: isLoadingAvailabilityData } = useSWR(
    (teacher && scoresLoaded) ? `/api/availability?fromDate=${availabilityFromDate}&toDate=${availabilityToDate}&teacherName=${encodeURIComponent(teacher.name || '')}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 120000,
      shouldRetryOnError: false
    }
  );

  const availabilityRecords = useMemo(() => {
    if (!availabilityDataRes?.teachers || !teacher) return [];
    // Additional client-side filter for email matching (backup)
    const records = availabilityDataRes.teachers.filter((t: TeacherAvailability) => {
      const emailMatch = t.email?.toLowerCase() === teacher.emailMindx?.toLowerCase() ||
        t.email?.toLowerCase() === teacher.emailPersonal?.toLowerCase();
      const nameMatch = t.name?.toLowerCase().includes(teacher.name?.toLowerCase()) ||
        teacher.name?.toLowerCase().includes(t.name?.toLowerCase());
      return emailMatch || nameMatch;
    });

    console.log('🔍 Availability Records:', {
      totalTeachers: availabilityDataRes.teachers.length,
      filteredRecords: records.length,
      teacherEmail: teacher.emailMindx,
      teacherName: teacher.name,
      sampleRecord: records[0]
    });

    return records;
  }, [availabilityDataRes, teacher]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modalOpen) {
        setModalOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [modalOpen]);

  // Handle teacher data errors
  useEffect(() => {
    (async () => {
      if (teacherError) {
        // If unauthorized, try silent refresh and revalidate once
        const status = (teacherError as any)?.status;
        if (status === 401) {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
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
                  // Revalidate teacher data
                  await mutate(`/api/teachers?code=${submitCode}`);
                  return;
                }
              }
            } catch (e) {
              console.warn('Silent refresh failed', e);
            }
          }

          // If refresh not possible or failed, force logout
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return;
        }

        // Other API errors: show not found modal
        setNotFoundModalOpen(true);
      } else if (teacherData && teacherData.error) {
        // API returned error in response body
        setError(teacherData.error);
        setNotFoundModalOpen(true);
      } else if (submitCode && !isLoadingTeacher && teacherData && !teacher) {
        // API returned but no teacher found
        setNotFoundModalOpen(true);
      } else if (teacher) {
        setError("");
      }
    })();
  }, [teacherData, teacher, submitCode, isLoadingTeacher, teacherError]);

  // Handle not found modal confirm
  const handleNotFoundConfirm = useCallback(() => {
    setNotFoundModalOpen(false);
    setSearchCode("");
    setSubmitCode("");
    setError("");
    localStorage.removeItem('lastSearchCode');
  }, []);

  // Optimized search with better debouncing
  const handleSearch = useCallback(() => {
    if (!searchCode.trim()) {
      setError("Vui lòng nhập mã giáo viên");
      return;
    }

    const trimmedCode = searchCode.trim();

    // Skip if same as previous search
    if (trimmedCode === lastSearchRef.current) {
      return;
    }

    lastSearchRef.current = trimmedCode;
    setError("");
    setSubmitCode(trimmedCode);

    // Save to localStorage for quick access
    try {
      localStorage.setItem('lastSearchCode', trimmedCode);
    } catch (e) {
      console.warn('Unable to save to localStorage:', e);
    }

    // Track search analytics (non-blocking)
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'search',
        searchCode: trimmedCode
      })
    }).catch(err => console.warn('Analytics tracking failed:', err));
  }, [searchCode]);

  // Improved debounced search
  useEffect(() => {
    if (!searchCode.trim()) return;

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for auto-search
    searchTimeoutRef.current = setTimeout(() => {
      const trimmedCode = searchCode.trim();
      if (trimmedCode && trimmedCode !== submitCode && trimmedCode.length >= 2) {
        handleSearch();
      }
    }, 800); // Increased debounce time for better performance

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchCode, submitCode, handleSearch]);

  // Track page visit on mount
  useEffect(() => {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'visit' })
    }).catch(err => console.error('Visit tracking failed:', err));
  }, []);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (feedbackSuccessModalOpen) {
          setFeedbackSuccessModalOpen(false);
        } else if (feedbackModalOpen) {
          setFeedbackModalOpen(false);
          setFeedbackRating(0);
          setFeedbackComment("");
          setFeedbackFeature("");
        } else if (registrationCheckModalOpen) {
          setRegistrationCheckModalOpen(false);
        } else if (notFoundModalOpen) {
          setNotFoundModalOpen(false);
        } else if (modalOpen) {
          setModalOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [feedbackSuccessModalOpen, feedbackModalOpen, isFirstTimeFeedback, registrationCheckModalOpen, notFoundModalOpen, modalOpen]);

  const getScoreForMonth = useCallback((data: MonthlyAverage[], month: string): string => {
    const found = data.find(d => d.month === month);
    return found ? found.average.toFixed(1) : "N/A";
  }, []);

  const openModal = useCallback((month: string, type: "expertise" | "experience") => {
    const data = type === "expertise" ? expertiseData : experienceData;
    const monthData = data.find((d: MonthlyAverage) => d.month === month);

    if (monthData && monthData.records.length > 0) {
      setModalMonth(month);
      setModalType(type);
      setModalRecords(monthData.records);
      setModalOpen(true);
    }
  }, [expertiseData, experienceData]);

  const handleFeedbackSubmit = async () => {
    if (feedbackRating === 0) {
      toast.error('Vui lòng chọn số sao đánh giá');
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_SECRET_KEY
        },
        body: JSON.stringify({
          rating: feedbackRating,
          comment: feedbackComment.trim(),
          feature: feedbackFeature.trim(),
          timestamp: new Date().toISOString(),
          userCode: submitCode || 'anonymous'
        })
      });

      if (response.ok) {
        setFeedbackRating(0);
        setFeedbackComment("");
        setFeedbackFeature("");
        setFeedbackModalOpen(false);
        setFeedbackSuccessModalOpen(true);
        setIsFirstTimeFeedback(false); // Reset first-time flag after successful submission

        // Save to localStorage so modal doesn't show again
        localStorage.setItem('userHasFeedback', 'true');
        setHasFeedback(true);
      } else {
        toast.error('Gửi feedback thất bại. Vui lòng thử lại.');
      }
    } catch (error) {
      toast.error('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Memoize tính toán điểm để tránh re-calculate
  const expertiseScore = useMemo(() => {
    const currentMonth = parseInt(selectedMonth);
    const currentYear = parseInt(selectedYear);
    const scores: number[] = [];

    for (let i = 0; i < 6; i++) {
      let month = currentMonth - i;
      let year = currentYear;

      if (month <= 0) {
        month += 12;
        year -= 1;
      }

      const monthKey = `${month}/${year}`;
      const score = getScoreForMonth(expertiseData, monthKey);

      if (score !== "N/A") {
        scores.push(parseFloat(score));
      }
    }

    return scores.length > 0 ? Math.max(...scores).toFixed(1) : "N/A";
  }, [selectedMonth, selectedYear, expertiseData, getScoreForMonth]);

  const experienceScore = useMemo(() => {
    const currentMonth = parseInt(selectedMonth);
    const currentYear = parseInt(selectedYear);
    const scores: number[] = [];

    for (let i = 0; i < 6; i++) {
      let month = currentMonth - i;
      let year = currentYear;

      if (month <= 0) {
        month += 12;
        year -= 1;
      }

      const monthKey = `${month}/${year}`;
      const score = getScoreForMonth(experienceData, monthKey);

      if (score !== "N/A") {
        scores.push(parseFloat(score));
      }
    }

    return scores.length > 0 ? Math.max(...scores).toFixed(1) : "N/A";
  }, [selectedMonth, selectedYear, experienceData, getScoreForMonth]);

  // Memoize highlighted months
  const highlightedMonths = useMemo(() => {
    const currentMonth = parseInt(selectedMonth);
    const currentYear = parseInt(selectedYear);
    const months: string[] = [];

    for (let i = 0; i < 6; i++) {
      let month = currentMonth - i;
      let year = currentYear;

      if (month <= 0) {
        month += 12;
        year -= 1;
      }

      months.push(`${month}/${year}`);
    }

    return months;
  }, [selectedMonth, selectedYear]);

  // Calculate detailed availability statistics with time slot analysis
  const availabilityStats = useMemo(() => {
    if (availabilityRecords.length === 0) return null;

    const DAYS = [
      { key: 'monday' as const, label: 'Thứ 2', short: 'T2' },
      { key: 'tuesday' as const, label: 'Thứ 3', short: 'T3' },
      { key: 'wednesday' as const, label: 'Thứ 4', short: 'T4' },
      { key: 'thursday' as const, label: 'Thứ 5', short: 'T5' },
      { key: 'friday' as const, label: 'Thứ 6', short: 'T6' },
      { key: 'saturday' as const, label: 'Thứ 7', short: 'T7' },
      { key: 'sunday' as const, label: 'Chủ nhật', short: 'CN' },
    ];
    const TIME_SLOTS = ['Sáng', 'Chiều', 'Tối'] as const;

    const dayCount: Record<string, number> = {};
    const timeSlotCount: Record<string, number> = { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 };
    const periodData: { label: string; count: number }[] = [];

    // Create availability matrix for heatmap
    type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    type TimeSlot = 'Sáng' | 'Chiều' | 'Tối';
    const availabilityMatrix: Record<DayKey, Record<TimeSlot, number>> = {
      monday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      tuesday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      wednesday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      thursday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      friday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      saturday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
      sunday: { 'Sáng': 0, 'Chiều': 0, 'Tối': 0 },
    };

    DAYS.forEach(day => { dayCount[day.key] = 0; });

    // Group records by period and count slots
    const recordsByPeriod = new Map<string, number>();

    availabilityRecords.forEach((record: TeacherAvailability) => {
      // Parse record date
      const [datePart] = record.timestamp.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const recordDate = new Date(year, month - 1, day);

      // Count total available slots in this record
      let recordSlotCount = 0;

      DAYS.forEach(({ key: dayKey }) => {
        const availability = record[dayKey as keyof TeacherAvailability] as string;
        if (availability && availability !== 'Bận') {
          dayCount[dayKey]++;

          // Count by time slot and build matrix
          TIME_SLOTS.forEach(slot => {
            if (availability.includes(slot)) {
              timeSlotCount[slot as TimeSlot]++;
              availabilityMatrix[dayKey as DayKey][slot as TimeSlot]++;
              recordSlotCount++;
            }
          });
        }
      });

      // Determine period key based on filter selection
      let periodKey = '';
      const now = new Date();
      const recordMonth = recordDate.getMonth();
      const recordYear = recordDate.getFullYear();
      const nowMonth = now.getMonth();
      const nowYear = now.getFullYear();

      if (availabilityPeriod === 'week') {
        // Only include records in current week
        const nowWeekStart = new Date(now);
        nowWeekStart.setDate(now.getDate() - now.getDay());
        nowWeekStart.setHours(0, 0, 0, 0);

        if (recordDate >= nowWeekStart && recordDate <= now) {
          const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
          periodKey = `${dayNames[recordDate.getDay()]} (${day}/${month})`;
        }
      } else if (availabilityPeriod === 'month') {
        // Only include records in current month
        if (recordMonth === nowMonth && recordYear === nowYear) {
          // Group by week of month
          const weekOfMonth = Math.floor((day - 1) / 7) + 1;
          periodKey = `Tuần ${weekOfMonth}`;
        }
      } else {
        // Only include records in current year
        if (recordYear === nowYear) {
          const displayMonth = recordMonth + 1; // 1-based month
          periodKey = `T${displayMonth}/${recordYear}`;
        }
      }

      if (periodKey) {
        recordsByPeriod.set(periodKey, (recordsByPeriod.get(periodKey) || 0) + recordSlotCount);
      }
    });

    // Convert to array and sort
    const entries = Array.from(recordsByPeriod.entries()).map(([label, count]) => ({ label, count }));

    if (availabilityPeriod === 'week') {
      // Sort by day of week (CN, T2, T3, ...)
      entries.sort((a, b) => {
        const dayOrder = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const aDay = a.label.split(' ')[0];
        const bDay = b.label.split(' ')[0];
        return dayOrder.indexOf(aDay) - dayOrder.indexOf(bDay);
      });
    } else if (availabilityPeriod === 'month') {
      // Sort by week number
      entries.sort((a, b) => {
        const aNum = parseInt(a.label.replace('Tuần ', ''));
        const bNum = parseInt(b.label.replace('Tuần ', ''));
        return aNum - bNum;
      });
    } else {
      // Sort by month
      entries.sort((a, b) => {
        const [aMonth, aYear] = a.label.replace('T', '').split('/').map(Number);
        const [bMonth, bYear] = b.label.replace('T', '').split('/').map(Number);
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
      });
    }

    periodData.push(...entries);

    // Find most available day and time
    const mostAvailableDay = Object.entries(dayCount).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const mostAvailableTime = Object.entries(timeSlotCount).reduce((a, b) => a[1] > b[1] ? a : b)[0];

    const totalRegistrations = availabilityRecords.length;
    const avgPerPeriod = availabilityPeriod === 'week' ? Math.round(totalRegistrations / 7) :
      availabilityPeriod === 'month' ? Math.round((totalRegistrations / 30) * 7) :
        Math.round(totalRegistrations / 12);

    // Calculate total slots across all records
    const totalSlots = Object.values(timeSlotCount).reduce((sum, count) => sum + count, 0);

    const stats = {
      totalRegistrations,
      dayCount,
      timeSlotCount,
      periodData,
      mostAvailableDay,
      mostAvailableTime,
      avgPerPeriod,
      availabilityMatrix,
      totalSlots,
      DAYS,
      TIME_SLOTS,
    };

    // Debug logging
    if (periodData.length === 0) {
      console.warn('⚠️ No availability data:', {
        period: availabilityPeriod,
        totalRecords: availabilityRecords.length,
        dateRange: { from: availabilityFromDate, to: availabilityToDate }
      });
    }

    return stats;
  }, [availabilityRecords, availabilityPeriod, availabilityFromDate, availabilityToDate]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="border-b border-gray-900 pb-2 sm:pb-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Thông tin của tôi</h1>
          <div className="text-xs text-gray-600 mt-1">
            {(isLoadingTeacher || isResolvingCode) ? (
              <span className="inline-flex items-center gap-2">
                <div className="w-3 h-1 bg-gray-300 rounded overflow-hidden">
                  <div className="w-full h-full bg-blue-500 animate-pulse"></div>
                </div>
                Đang tải thông tin của bạn...
              </span>
            ) : user?.displayName ? `Xin chào ${user.displayName}` : 'Đang tải thông tin của bạn...'}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!submitCode && !error && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 sm:p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Tìm kiếm giáo viên</h3>
              <p className="text-xs sm:text-sm text-gray-600 max-w-md">
                Nhập mã giáo viên vào ô tìm kiếm phía trên để xem thông tin chi tiết, điểm đánh giá và hiệu suất làm việc
              </p>
            </div>
          </div>
        )}

        {/* Teacher Info Skeleton */}
        {(isResolvingCode || (isLoadingTeacher && submitCode)) && (
          <div className="border border-gray-900 rounded-lg overflow-hidden">
            {/* Header Skeleton */}
            <div className="bg-gray-900 text-white p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gray-700 animate-pulse"></div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-5 bg-gray-700 rounded w-40 animate-pulse"></div>
                  <div className="h-3 bg-gray-700 rounded w-24 animate-pulse"></div>
                </div>
                <div className="h-6 w-16 bg-gray-700 rounded-full animate-pulse"></div>
              </div>
            </div>

            {/* Info Grid Skeleton */}
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-white border border-gray-100 rounded">
                    <div className="w-4 h-4 bg-gray-300 rounded animate-pulse mt-0.5"></div>
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-gray-300 rounded w-20 animate-pulse"></div>
                      <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Teacher Info */}
        {teacher && !isLoadingTeacher && (
          <div className="border border-gray-900 rounded-lg overflow-hidden animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            {/* Header Card */}
            <div className="bg-gray-900 text-white p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white text-gray-900 flex items-center justify-center font-bold text-base sm:text-lg shrink-0">
                  {teacher.name.split(" ").pop()?.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-bold truncate">{teacher.name}</h2>
                  <p className="text-xs opacity-90">{teacher.code}</p>
                </div>
                <div className="shrink-0">
                  <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${teacher.status === "Active"
                      ? "bg-green-500 text-white"
                      : "bg-gray-500 text-white"
                    }`}>
                    {teacher.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                {teacher.emailMindx && teacher.emailMindx !== "N/A" && (
                  <InfoItem icon={<Mail className="h-4 w-4" />} label="Email MindX" value={teacher.emailMindx} />
                )}
                {teacher.emailPersonal && teacher.emailPersonal !== "N/A" && (
                  <InfoItem icon={<Mail className="h-4 w-4" />} label="Email cá nhân" value={teacher.emailPersonal} />
                )}
                {teacher.branchCurrent && teacher.branchCurrent !== "N/A" && (
                  <InfoItem icon={<MapPin className="h-4 w-4" />} label="Chi nhánh hiện tại" value={teacher.branchCurrent} />
                )}
                {teacher.status && teacher.status !== "N/A" && (
                  <InfoItem icon={<Briefcase className="h-4 w-4" />} label="Program" value={teacher.status} />
                )}
                {teacher.position && teacher.position !== "N/A" && (
                  <InfoItem icon={<User className="h-4 w-4" />} label="Vị trí" value={teacher.position} />
                )}
                {teacher.startDate && teacher.startDate !== "N/A" && (
                  <InfoItem icon={<Calendar className="h-4 w-4" />} label="Ngày vào" value={teacher.startDate} />
                )}
                {teacher.manager && teacher.manager !== "N/A" && (
                  <InfoItem icon={<UserCheck className="h-4 w-4" />} label="Người quản lý" value={teacher.manager} />
                )}
                {teacher.responsible && teacher.responsible !== "N/A" && (
                  <InfoItem icon={<UserCheck className="h-4 w-4" />} label="Người phụ trách" value={teacher.responsible} />
                )}
              </div>

              {/* Additional Info */}
              <div className="pt-3 border-t border-gray-200">
                <h3 className="text-xs font-bold text-gray-900 mb-2">Thông tin ban đầu</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="text-xs">
                    <span className="text-gray-600">Chi nhánh đầu vào:</span>
                    <span className="ml-2 font-medium">{teacher.branchIn}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Program đầu vào:</span>
                    <span className="ml-2 font-medium">{teacher.status}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Onboard bởi:</span>
                    <span className="ml-2 font-medium">{teacher.onboardBy}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Trạng thái hoạt động:</span>
                    <span className={`ml-2 font-medium ${teacher.programIn === "Active" ? "text-green-600" : "text-gray-600"
                      }`}>{teacher.programIn}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Score Summary Skeleton */}
        {teacher && !scoresLoaded && (
          <div className="border border-gray-900 rounded-lg p-3 sm:p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-end">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="h-3 bg-gray-200 rounded w-16 mb-1 animate-pulse"></div>
                  <div className="h-10 bg-gray-300 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score Summary */}
        {teacher && scoresLoaded && (expertiseData.length > 0 || experienceData.length > 0) && (
          <div className="border border-gray-900 rounded-lg p-3 sm:p-4 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tháng</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-900 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Năm</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-900 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Chuyên môn</label>
                <div className="px-4 py-2 bg-gray-900 text-white rounded text-center">
                  <span className="text-lg font-bold">{expertiseScore}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Quy trình & Kỹ năng trải nghiệm</label>
                <div className="px-4 py-2 bg-gray-900 text-white rounded text-center">
                  <span className="text-lg font-bold">{experienceScore}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Metrics */}
        {teacher && (
          <div className="border border-gray-900 rounded-lg overflow-hidden mt-3 sm:mt-4 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <div className="bg-gray-900 text-white p-2 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Các chỉ số theo tháng</h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs">Năm:</label>
                <select
                  value={selectedTableYear}
                  onChange={(e) => setSelectedTableYear(e.target.value)}
                  className="px-2 py-1 text-xs bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-white flex-1 sm:flex-initial"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
            </div>
            <div className="p-2 sm:p-4 overflow-x-auto -mx-2 sm:mx-0">
              {!scoresLoaded ? (
                /* Loading Skeleton */
                <div className="space-y-3">
                  <div className="animate-pulse">
                    <div className="flex gap-2 mb-3">
                      <div className="h-8 bg-gray-200 rounded w-24"></div>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="h-8 bg-gray-200 rounded flex-1 min-w-12.5"></div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[1, 2].map((row) => (
                        <div key={row} className="flex gap-2">
                          <div className="h-10 bg-gray-300 rounded w-24"></div>
                          {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="h-10 bg-gray-100 rounded flex-1 min-w-12.5"></div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (expertiseData.length === 0 && experienceData.length === 0) ? (
                /* No Data Message */
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Chưa có dữ liệu điểm số</p>
                </div>
              ) : (
                /* Actual Table */
                <>
                  {(() => {
                    const months = Array.from({ length: 12 }, (_, i) => `${i + 1}/${selectedTableYear}`);

                    return (
                      <table className="w-full text-[10px] sm:text-xs min-w-150">
                        <thead>
                          <tr className="border-b border-gray-900">
                            <th className="text-left py-1.5 sm:py-2 px-1.5 sm:px-2 font-bold text-gray-900 min-w-25 sticky left-0 bg-white z-10">Chỉ tiêu</th>
                            {months.map((month) => (
                              <th key={month} className={`text-center py-1.5 sm:py-2 px-1 sm:px-2 min-w-12.5 sm:min-w-15 ${highlightedMonths.includes(month) ? "bg-blue-50" : ""
                                }`}>
                                <div className="font-medium text-gray-700 whitespace-nowrap">T{month.split('/')[0]}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-200">
                            <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 sticky left-0 bg-white z-10">
                              <div className="font-medium text-gray-900 text-[10px] sm:text-xs">CM Chuyên sâu</div>
                            </td>
                            {months.map((month) => {
                              const score = getScoreForMonth(expertiseData, month);
                              const scoreValue = score === "N/A" ? 0 : parseFloat(score);
                              const isCurrentMonth = month === `${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
                              return (
                                <td key={month} className={`text-center py-1.5 sm:py-2 px-1 sm:px-2 ${highlightedMonths.includes(month) ? "bg-blue-50" : ""
                                  }`}>
                                  <span
                                    onClick={() => {
                                      if (score === "N/A" && isCurrentMonth) {
                                        setRegistrationCheckModalOpen(true);
                                      } else if (score !== "N/A") {
                                        openModal(month, "expertise");
                                      }
                                    }}
                                    className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium whitespace-nowrap ${score === "N/A"
                                        ? isCurrentMonth
                                          ? "bg-yellow-200 text-yellow-900 cursor-pointer hover:bg-yellow-300 animate-pulse font-bold shadow-lg border-2 border-yellow-400"
                                          : "bg-gray-200 text-gray-700"
                                        : scoreValue >= 8
                                          ? "bg-green-100 text-green-800 cursor-pointer hover:bg-green-200"
                                          : "bg-red-100 text-red-800 cursor-pointer hover:bg-red-200"
                                      }`}>
                                    {score === "N/A" && isCurrentMonth ? "📝 Đăng ký" : score}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 sticky left-0 bg-white z-10">
                              <div className="font-medium text-gray-900 text-[10px] sm:text-xs">KN - QT Trải nghiệm</div>
                            </td>
                            {months.map((month) => {
                              const score = getScoreForMonth(experienceData, month);
                              const scoreValue = score === "N/A" ? 0 : parseFloat(score);
                              const isCurrentMonth = month === `${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
                              return (
                                <td key={month} className={`text-center py-1.5 sm:py-2 px-1 sm:px-2 ${highlightedMonths.includes(month) ? "bg-blue-50" : ""
                                  }`}>
                                  <span
                                    onClick={() => {
                                      if (score === "N/A" && isCurrentMonth) {
                                        setRegistrationCheckModalOpen(true);
                                      } else if (score !== "N/A") {
                                        openModal(month, "experience");
                                      }
                                    }}
                                    className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium whitespace-nowrap ${score === "N/A"
                                        ? isCurrentMonth
                                          ? "bg-yellow-200 text-yellow-900 cursor-pointer hover:bg-yellow-300 animate-pulse font-bold shadow-lg border-2 border-yellow-400"
                                          : "bg-gray-200 text-gray-700"
                                        : scoreValue >= 8
                                          ? "bg-green-100 text-green-800 cursor-pointer hover:bg-green-200"
                                          : "bg-red-100 text-red-800 cursor-pointer hover:bg-red-200"
                                      }`}>
                                    {score === "N/A" && isCurrentMonth ? "📝 Đăng ký" : score}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    );
                  })()}
                  {scoresLoaded && (
                    <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row gap-1.5 sm:gap-4 text-[10px] sm:text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-green-100 border border-green-200 rounded shrink-0"></span>
                        <span>≥ 8.0 điểm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-red-100 border border-red-200 rounded shrink-0"></span>
                        <span>&lt; 7.0 điểm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-3 h-3 sm:w-4 sm:h-4 bg-gray-200 border border-gray-300 rounded shrink-0"></span>
                        <span>N/A (Click vào tháng hiện tại để đăng ký)</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Advanced Training Section */}
        {teacher && (
          <div className="border border-gray-900 rounded-lg overflow-hidden mt-3 sm:mt-4 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            {/* Header */}
            <div className="bg-linear-to-r from-purple-600 to-purple-700 text-white p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold">Đào tạo nâng cao</h3>
                  <p className="text-xs sm:text-sm opacity-90 mt-0.5">
                    Điểm học trực tuyến - 10 bài học
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 sm:p-4">
              {isLoadingTraining ? (
                /* Loading Skeleton */
                <div className="space-y-3">
                  <div className="animate-pulse space-y-2">
                    <div className="h-6 bg-gray-200 rounded w-48"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-20 bg-gray-100 rounded"></div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : !trainingData ? (
                /* No Data Message */
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Chưa có dữ liệu đào tạo</p>
                </div>
              ) : (
                /* Actual Data */
                <>
                  <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-700">Điểm trung bình</div>
                        <div className="text-2xl font-bold text-purple-600 mt-1">
                          {trainingData.averageScore?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        <div>Hoàn thành: {trainingData.lessons?.filter((l: any) => l.score > 0).length || 0}/10</div>
                        <div className="mt-1">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-600 rounded-full transition-all"
                              style={{ width: `${((trainingData.lessons?.filter((l: any) => l.score > 0).length || 0) / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lessons Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(trainingData.lessons || []).map((lesson: any, idx: number) => {
                      const score = lesson.score || 0;
                      const hasScore = score > 0;
                      const isPerfect = score >= 10;
                      const needsImprovement = hasScore && !isPerfect;
                      const notStarted = !hasScore;

                      const scoreColor = hasScore ? 'text-purple-600' : 'text-gray-400';
                      const bgColor = hasScore ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200';

                      return (
                        <div
                          key={idx}
                          className={`border rounded-lg p-3 transition-all hover:shadow-md ${bgColor}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-purple-700 mb-1">
                                Lesson {idx + 1}
                              </div>
                              <div className="text-xs text-gray-700 line-clamp-2 mb-2">
                                {lesson.name.replace(/^Lesson \d+:\s*/, '')}
                              </div>

                              {/* Buttons - Show only for lessons not perfect (< 10 points) */}
                              {!isPerfect && (
                                lesson.link ? (
                                  <a
                                    href={lesson.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${notStarted
                                        ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                                        : 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer'
                                      }`}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {notStarted ? 'Xem đào tạo' : 'Cải thiện điểm'}
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-gray-300 text-gray-500 cursor-not-allowed">
                                    Chưa có link
                                  </span>
                                )
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-xl font-bold ${scoreColor}`}>
                                {hasScore ? score?.toFixed(1) || '—' : '—'}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {hasScore ? '/10' : 'Chưa học'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-purple-50 border border-purple-200 rounded"></div>
                        <span>Đã hoàn thành</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
                        <span>Chưa học</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Availability Performance Analysis - Show skeleton while loading */}
        {teacher && (
          <div className="border border-gray-900 rounded-lg overflow-hidden mt-3 sm:mt-4 animate-fadeIn" style={{ animationDelay: '0.5s' }}>
            {/* Header */}
            <div className="bg-linear-to-r from-blue-600 to-indigo-700 text-white p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                  <div>
                    <h3 className="text-base sm:text-lg font-bold">Phân tích hiệu suất làm việc</h3>
                    <p className="text-xs sm:text-sm opacity-90 mt-0.5">
                      Xu hướng đăng ký lịch rảnh theo khung giờ
                    </p>
                  </div>
                </div>

                {/* Period Filter */}
                <div className="flex gap-1 sm:gap-2">
                  {[
                    { value: 'week', label: 'Tuần' },
                    { value: 'month', label: 'Tháng' },
                    { value: 'year', label: 'Năm' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setAvailabilityPeriod(value as any)}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-medium transition-all ${availabilityPeriod === value
                          ? 'bg-white text-blue-600 shadow-md'
                          : 'bg-white/20 hover:bg-white/30 text-white'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-white space-y-4">
              {isLoadingAvailabilityData ? (
                /* Loading Skeleton */
                <>
                  {/* Summary Stats Skeleton */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="bg-gray-100 rounded-lg p-2 sm:p-3 animate-pulse">
                        <div className="h-6 sm:h-8 bg-gray-300 rounded mb-2"></div>
                        <div className="h-3 sm:h-4 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>

                  {/* Heatmap Skeleton */}
                  <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                    <div className="h-4 bg-gray-300 rounded w-48 mb-3 animate-pulse"></div>
                    <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
                  </div>

                  {/* Charts Skeleton */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                      <div className="h-4 bg-gray-300 rounded w-32 mb-3 animate-pulse"></div>
                      <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                      <div className="h-4 bg-gray-300 rounded w-32 mb-3 animate-pulse"></div>
                      <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                </>
              ) : !availabilityStats || availabilityStats.totalSlots === 0 ? (
                /* No Data Message */
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Chưa có dữ liệu lịch rảnh trong khoảng thời gian này</p>
                </div>
              ) : (
                /* Actual Data */
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-linear-to-br from-blue-50 to-white border border-blue-200 rounded-lg p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-blue-600">{availabilityStats.totalSlots}</div>
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Tổng slots rảnh</div>
                    </div>
                    <div className="bg-linear-to-br from-green-50 to-white border border-green-200 rounded-lg p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-green-600">
                        {availabilityStats.DAYS.find(d => d.key === availabilityStats.mostAvailableDay)?.short || 'N/A'}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Ngày ưa thích</div>
                    </div>
                    <div className="bg-linear-to-br from-purple-50 to-white border border-purple-200 rounded-lg p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-purple-600">{availabilityStats.mostAvailableTime}</div>
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Khung giờ ưa thích</div>
                    </div>
                    <div className="bg-linear-to-br from-orange-50 to-white border border-orange-200 rounded-lg p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-orange-600">
                        {availabilityStats.totalRegistrations}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Lần đăng ký</div>
                    </div>
                  </div>

                  {/* Heatmap - Availability Matrix */}
                  <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Bản đồ nhiệt - Phân bố theo ngày & khung giờ
                      </h4>

                      {/* Info Icon with Tooltip */}
                      <div className="relative group">
                        <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold cursor-help">
                          i
                        </div>
                        <div className="absolute right-0 top-6 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-30 shadow-xl">
                          <div className="font-bold mb-2">Hướng dẫn đọc bản đồ:</div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-gray-100 rounded shrink-0 border border-gray-600"></div>
                              <span><strong>0 lần:</strong> Không có lịch rảnh</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-300 rounded shrink-0"></div>
                              <span><strong>1 lần:</strong> Ít</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-400 rounded shrink-0"></div>
                              <span><strong>2 lần:</strong> Trung bình</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded shrink-0"></div>
                              <span><strong>3 lần:</strong> Nhiều</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-600 rounded shrink-0"></div>
                              <span><strong>4+ lần:</strong> Rất nhiều</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-300 space-y-1">
                            <div><strong>Thang đo chuẩn:</strong></div>
                            <div>• <strong>Tuần:</strong> 1 lần = Rất nhiều</div>
                            <div>• <strong>Tháng:</strong> 4 lần = Rất nhiều</div>
                            <div>• <strong>Năm:</strong> 48 lần = Rất nhiều</div>
                            <div className="text-[9px] italic mt-1">(Năm: 4 lần/tháng × 12 tháng = 48 lần)</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-125">
                        {/* Header */}
                        <div className="grid grid-cols-8 gap-1 mb-1">
                          <div className="text-xs text-gray-600 font-medium"></div>
                          {availabilityStats.DAYS.map(day => (
                            <div key={day.key} className="text-xs text-gray-600 font-medium text-center">
                              {day.short}
                            </div>
                          ))}
                        </div>

                        {/* Rows */}
                        {availabilityStats.TIME_SLOTS.map(slot => {
                          // Fixed scale based on period: week=1, month=4, year=48
                          const maxStandard = availabilityPeriod === 'week' ? 1 :
                            availabilityPeriod === 'month' ? 4 : 48;

                          return (
                            <div key={slot} className="grid grid-cols-8 gap-1 mb-1">
                              <div className="text-xs text-gray-600 font-medium flex items-center">
                                {slot}
                              </div>
                              {availabilityStats.DAYS.map(day => {
                                const dayKey = day.key as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
                                const timeSlot = slot as 'Sáng' | 'Chiều' | 'Tối';
                                const count = availabilityStats.availabilityMatrix[dayKey][timeSlot];

                                // Fixed scale: calculate thresholds based on maxStandard
                                const threshold4 = maxStandard;                    // 100% = Very high
                                const threshold3 = Math.ceil(maxStandard * 0.75); // 75% = High
                                const threshold2 = Math.ceil(maxStandard * 0.5);  // 50% = Medium
                                const threshold1 = Math.ceil(maxStandard * 0.25); // 25% = Low

                                let bgColor = 'bg-gray-100';
                                if (count >= threshold4) bgColor = 'bg-blue-600';      // 100%+ = Very high
                                else if (count >= threshold3) bgColor = 'bg-blue-500'; // 75%+ = High
                                else if (count >= threshold2) bgColor = 'bg-blue-400'; // 50%+ = Medium
                                else if (count >= threshold1) bgColor = 'bg-blue-300'; // 25%+ = Low

                                return (
                                  <div
                                    key={`${day.key}-${slot}`}
                                    className={`${bgColor} rounded p-2 text-center text-xs font-bold transition-all hover:scale-105 cursor-pointer relative group ${count >= 2 ? 'text-white' : 'text-gray-900'
                                      }`}
                                  >
                                    {count}
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                      {day.label} {slot}: {count} lần
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}

                        {/* Legend */}
                        <div className="mt-4 flex items-center gap-3 text-xs">
                          <span className="text-gray-600 font-medium">Cường độ:</span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-4 bg-gray-100 rounded border border-gray-300"></div>
                              <span>0</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-4 bg-blue-300 rounded"></div>
                              <span>Ít</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-4 bg-blue-400 rounded"></div>
                              <span>TB</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-4 bg-blue-500 rounded"></div>
                              <span>Nhiều</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-4 bg-blue-600 rounded"></div>
                              <span>Rất nhiều</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bar Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* By Day */}
                    <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white">
                      <h4 className="text-sm font-bold text-gray-900 mb-6">Phân bố theo ngày</h4>
                      <div className="flex items-end justify-between gap-2 h-64">
                        {availabilityStats.DAYS.map(day => {
                          const count = availabilityStats.dayCount[day.key] || 0;
                          const maxDay = Math.max(...availabilityStats.DAYS.map(d => availabilityStats.dayCount[d.key] || 0), 1);
                          // Calculate height in pixels for better control (180px max in h-64 container)
                          const maxHeight = 180;
                          const heightPx = count > 0 ? Math.max(24, (count / maxDay) * maxHeight) : 8;

                          return (
                            <div key={day.key} className="flex-1 flex flex-col items-center gap-2 group">
                              <div className="relative w-full flex flex-col justify-end h-64">
                                <div
                                  className={`w-full rounded-t transition-all duration-300 hover:scale-105 relative cursor-pointer shadow-md ${count === 0 ? 'bg-gray-200' : 'bg-linear-to-t from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500'
                                    }`}
                                  style={{
                                    height: `${heightPx}px`
                                  }}
                                >
                                  {/* Count inside bar */}
                                  {count > 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                                      {count}
                                    </div>
                                  )}

                                  {/* Tooltip */}
                                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    {day.label}: {count} lần
                                  </div>
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-900 font-bold">{day.short}</div>
                                <div className="text-[10px] text-gray-500">{count}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* By Time Slot */}
                    <div className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white">
                      <h4 className="text-sm font-bold text-gray-900 mb-6">Phân bố theo khung giờ</h4>
                      <div className="flex items-end justify-around gap-4 h-64">
                        {availabilityStats.TIME_SLOTS.map((slot, idx) => {
                          const count = availabilityStats.timeSlotCount[slot] || 0;
                          const maxSlot = Math.max(...availabilityStats.TIME_SLOTS.map(s => availabilityStats.timeSlotCount[s] || 0), 1);
                          // Calculate height in pixels for better control (180px max in h-64 container)
                          const maxHeight = 180;
                          const heightPx = count > 0 ? Math.max(24, (count / maxSlot) * maxHeight) : 8;
                          const colors = ['from-amber-500 to-amber-400', 'from-blue-500 to-blue-400', 'from-indigo-600 to-indigo-500'];
                          const textColors = ['text-amber-600', 'text-blue-600', 'text-indigo-600'];

                          return (
                            <div key={slot} className="flex-1 flex flex-col items-center gap-2 max-w-32 group">
                              <div className="relative w-full flex flex-col justify-end h-64">
                                <div
                                  className={`w-full rounded-t transition-all duration-300 hover:scale-105 relative cursor-pointer shadow-md ${count === 0 ? 'bg-gray-200' : `bg-linear-to-t ${colors[idx]}`
                                    }`}
                                  style={{
                                    height: `${heightPx}px`
                                  }}
                                >
                                  {/* Count inside bar */}
                                  {count > 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">
                                      {count}
                                    </div>
                                  )}

                                  {/* Tooltip */}
                                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-2 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    {slot}: {count} lần
                                  </div>
                                </div>
                              </div>
                              <div className="text-center">
                                <div className={`text-sm font-bold ${textColors[idx]}`}>{slot}</div>
                                <div className="text-[10px] text-gray-500">{count} lần</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                    <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Nhận xét xu hướng
                    </h4>
                    <div className="space-y-1 text-xs sm:text-sm text-gray-700">
                      <p>• Giáo viên thường rảnh nhất vào <strong className="text-blue-700">
                        {availabilityStats.DAYS.find(d => d.key === availabilityStats.mostAvailableDay)?.label}
                      </strong></p>
                      <p>• Khung giờ ưa thích: <strong className="text-blue-700">{availabilityStats.mostAvailableTime}</strong></p>
                      <p>• Tổng cộng đã đăng ký <strong className="text-blue-700">{availabilityStats.totalSlots} slots</strong> trong {availabilityStats.totalRegistrations} lần đăng ký</p>
                      <p>• Trung bình: <strong className="text-blue-700">{availabilityStats.totalRegistrations > 0 ? (availabilityStats.totalSlots / availabilityStats.totalRegistrations).toFixed(1) : '0'} slots/lần</strong></p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Modal - Chi tiết bài test */}
        {modalOpen && modalMonth && modalType && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full sm:max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`${modalType === "expertise" ? "bg-linear-to-r from-blue-600 to-blue-800" : "bg-linear-to-r from-purple-600 to-purple-800"} text-white px-3 sm:px-6 py-3 sm:py-5 flex items-center justify-between gap-2`}>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-xl font-bold truncate">
                    Test T{modalMonth}
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 sm:mt-2">
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold w-fit ${modalType === "expertise" ? "bg-blue-500" : "bg-purple-500"
                      }`}>
                      {modalType === "expertise" ? "Chuyên môn" : "Kỹ năng"}
                    </span>
                    <p className={`text-xs sm:text-sm ${modalType === "expertise" ? "text-blue-100" : "text-purple-100"}`}>
                      <span className="font-semibold">{modalRecords.length}</span> bài •
                      <span className="font-semibold"> {modalRecords.filter(r => r.isCountedInAverage).length}</span> tính điểm
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1.5 sm:p-2 transition-all shrink-0"
                  title="Đóng"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(95vh-150px)] sm:max-h-[calc(90vh-220px)] bg-gray-50 overflow-x-auto">
                <table className="w-full text-xs sm:text-sm bg-white min-w-150">
                  <thead className="bg-linear-to-b from-gray-100 to-gray-50 border-b-2 border-gray-300 sticky top-0 z-10">
                    <tr>
                      <th className="text-left py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700 w-10 sm:w-16">STT</th>
                      <th className="text-left py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700">{modalType === "expertise" ? "Bộ môn" : "Khối"}</th>
                      {modalType === "expertise" && <th className="text-left py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700">Đề</th>}
                      <th className="text-center py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700 w-16 sm:w-24">Cđ</th>
                      <th className="text-center py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700 w-16 sm:w-24">Điểm</th>
                      <th className="text-left py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700">Email</th>
                      <th className="text-center py-2 sm:py-4 px-2 sm:px-4 font-bold text-gray-700 w-20 sm:w-32">Tính</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalRecords.map((record, index) => (
                      <tr key={index} className={`border-b border-gray-200 transition-colors ${!record.isCountedInAverage ? "bg-red-50" : "hover:bg-blue-50"
                        }`}>
                        <td className="py-2 sm:py-4 px-2 sm:px-4 text-gray-500 font-medium text-center">{index + 1}</td>
                        <td className="py-2 sm:py-4 px-2 sm:px-4 font-semibold text-gray-900">{modalType === "expertise" ? record.subject : record.teachingLevel}</td>
                        {modalType === "expertise" && <td className="py-2 sm:py-4 px-2 sm:px-4 text-gray-600">{record.exam}</td>}
                        <td className="text-center py-2 sm:py-4 px-2 sm:px-4 font-medium text-gray-700">{record.correct}</td>
                        <td className="text-center py-2 sm:py-4 px-2 sm:px-4">
                          <span className={`inline-block px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold text-xs sm:text-base whitespace-nowrap ${parseFloat(record.score.replace(",", ".")) >= 4
                              ? "bg-green-100 text-green-700"
                              : parseFloat(record.score.replace(",", ".")) >= 3
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                            {record.score}
                          </span>
                        </td>
                        <td className="py-2 sm:py-4 px-2 sm:px-4">
                          {record.emailExplanation ? (
                            <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-orange-50 text-orange-700 rounded-md text-[10px] sm:text-xs font-medium truncate max-w-37.5 sm:max-w-full">
                              <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                              </svg>
                              <span className="truncate">{record.emailExplanation}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs sm:text-sm">-</span>
                          )}
                        </td>
                        <td className="text-center py-2 sm:py-4 px-2 sm:px-4">
                          {record.isCountedInAverage ? (
                            <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-3 py-1 sm:py-1.5 bg-green-100 text-green-800 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                              <svg className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span className="hidden sm:inline">Tính</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-3 py-1 sm:py-1.5 bg-red-100 text-red-800 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                              <svg className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              <span className="hidden sm:inline">Không</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-3 sm:px-6 py-3 sm:py-4 bg-linear-to-b from-gray-50 to-gray-100 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 text-[10px] sm:text-xs text-gray-600">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Tính:</strong> Đưa vào TB</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Không:</strong> Điểm 0 + email GT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
                    <span><strong>Nền đỏ:</strong> Bài test không được tính</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Registration Check Modal */}
        {registrationCheckModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
              <div className="bg-gray-900 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
                <h3 className="font-semibold">Đăng ký kiểm tra</h3>
                <button
                  onClick={() => setRegistrationCheckModalOpen(false)}
                  className="hover:bg-white/20 rounded p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-3">
                <div className="bg-gray-100 border-l-4 border-gray-800 p-3 text-sm">
                  <p className="font-medium text-gray-900">Tháng này chưa có điểm kiểm tra</p>
                </div>

                {/* Embedded Schedule */}
                <div className="border border-gray-300 rounded overflow-hidden">
                  <div className="bg-gray-100 px-3 py-2 border-b border-gray-300">
                    <h4 className="text-sm font-medium text-gray-900">Lịch kiểm tra</h4>
                  </div>
                  <div className="relative" style={{ height: '300px', overflow: 'auto' }}>
                    <iframe
                      src={process.env.NEXT_PUBLIC_TEST_SCHEDULE_URL}
                      className="w-full border-0"
                      style={{ height: '600px', transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%' }}
                      title="Lịch kiểm tra"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={process.env.NEXT_PUBLIC_TEST_REGISTER_FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-gray-900 hover:bg-black text-white rounded text-sm font-medium text-center"
                  >
                    Đăng ký chính thức
                  </a>

                  <a
                    href={process.env.NEXT_PUBLIC_TEST_REGISTER_ADDITIONAL_FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded text-sm font-medium text-center"
                  >
                    Đăng ký bổ sung
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Not Found Modal */}
        {notFoundModalOpen && (
          <div className="fixed inset-0 backdrop-blur-xs bg-white/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fadeIn">
              <div className="p-6">
                <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                  Không tìm thấy giáo viên
                </h3>
                <p className="text-sm text-gray-600 text-center mb-6">
                  Không tìm thấy giáo viên với mã <strong className="text-gray-900">{searchCode}</strong>. Vui lòng kiểm tra lại mã giáo viên.
                </p>
                <button
                  onClick={handleNotFoundConfirm}
                  className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Feedback Button */}
        {feedbackEnabled && (
          <div className="fixed bottom-6 right-6 z-40">
            <button
              onClick={() => {
                setFeedbackModalOpen(true);
                setIsFirstTimeFeedback(false); // Manual click is not mandatory
              }}
              disabled={feedbackModalOpen}
              className="w-14 h-14 bg-gray-900 hover:bg-gray-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
              title="Gửi phản hồi"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </button>

            {/* Small disable control */}
            <button
              onClick={(e) => { e.stopPropagation(); disableFeedback(); }}
              title="Tắt nút phản hồi"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center shadow"
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* If feedback is disabled, show small pill to re-enable it */}
        {!feedbackEnabled && (
          <div className="fixed bottom-6 right-6 z-40">
            <button
              onClick={() => enableFeedback()}
              className="px-3 py-2 rounded-full bg-gray-100 text-gray-700 shadow flex items-center gap-2"
              title="Bật lại nút phản hồi"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4l3-7 4 18 3-7h4" />
              </svg>
              <span className="text-xs">Bật phản hồi</span>
            </button>
          </div>
        )}

        {/* Feedback Modal */}
        {feedbackModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              // Allow closing modal by clicking outside
              if (e.target === e.currentTarget) {
                setFeedbackModalOpen(false);
                setFeedbackRating(0);
                setFeedbackComment("");
                setFeedbackFeature("");
              }
            }}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="bg-gray-900 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
                <h3 className="font-semibold">{isFirstTimeFeedback ? 'Góp ý để cải thiện hệ thống' : 'Gửi phản hồi'}</h3>
                <button
                  onClick={() => {
                    setFeedbackModalOpen(false);
                    setFeedbackRating(0);
                    setFeedbackComment("");
                    setFeedbackFeature("");
                  }}
                  className="hover:bg-white/20 rounded p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Đánh giá hệ thống <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className="transition-all hover:scale-110"
                      >
                        <svg
                          className={`w-10 h-10 ${star <= feedbackRating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                            }`}
                          fill={star <= feedbackRating ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth={1.5}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                          />
                        </svg>
                      </button>
                    ))}
                    {feedbackRating > 0 && (
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        ({feedbackRating} {feedbackRating === 1 ? 'sao' : 'sao'})
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nhận xét về hệ thống
                  </label>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Chia sẻ trải nghiệm của bạn khi sử dụng hệ thống..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none text-sm"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Đề xuất tính năng mới
                  </label>
                  <textarea
                    value={feedbackFeature}
                    onChange={(e) => setFeedbackFeature(e.target.value)}
                    placeholder="Bạn muốn hệ thống có thêm tính năng gì?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none text-sm"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  {!isFirstTimeFeedback && (
                    <button
                      onClick={() => {
                        setFeedbackModalOpen(false);
                        setFeedbackRating(0);
                        setFeedbackComment("");
                        setFeedbackFeature("");
                      }}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Hủy
                    </button>
                  )}
                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={feedbackSubmitting || feedbackRating === 0}
                    className={`px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium ${isFirstTimeFeedback ? 'w-full' : 'flex-1'
                      }`}
                  >
                    {feedbackSubmitting ? 'Đang gửi...' : 'Gửi phản hồi'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Success Modal */}
        {feedbackSuccessModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fadeIn">
              <div className="p-6 text-center">
                <div className="flex items-center justify-center w-20 h-20 mx-auto bg-green-100 rounded-full mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Cảm ơn bạn!
                </h3>
                <p className="text-gray-600 mb-6">
                  Phản hồi của bạn đã được ghi nhận. Chúng tôi sẽ sử dụng ý kiến này để cải thiện hệ thống.
                </p>
                <button
                  onClick={() => setFeedbackSuccessModalOpen(false)}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg text-base font-medium hover:bg-green-700 transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
