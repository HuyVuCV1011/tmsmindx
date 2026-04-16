'use client'

import { useAuth } from '@/lib/auth-context'
import { useSidebar } from '@/lib/sidebar-context'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useRef } from 'react'

type MascotAction = 'walk' | 'jump'

type TourStep = {
  id: string
  title: string
  description: string
  target: string
  route?: string
  mascotAction: MascotAction
}

type OnboardingStateResponse = {
  success?: boolean
  state?: {
    completed?: boolean
    tour_version?: number
  }
}

const TOUR_VERSION = 1
const MASCOT_SIZE = 200
const HOLE_PADDING = 8
const OVERLAY_Z = 120
const LS_KEY_PREFIX = 'tps_onboarding_done_v'

// Dev/test override: force onboarding for specific accounts (by email prefix).
// Keep this list small and remove after testing.
const FORCE_ONBOARDING_EMAIL_PREFIXES = new Set<string>([])

function findStepIndexById(id: string) {
  const idx = TOUR_STEPS.findIndex((s) => s.id === id)
  return idx >= 0 ? idx : 0
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'sidebar',
    title: 'Đây là khu vực Sidebar',
    description:
      'Sidebar là nơi điều hướng chính. Bạn có thể truy cập nhanh mọi module mà không cần quay lại trang chủ.',
    target: 'tour-sidebar',
    mascotAction: 'walk',
  },
  {
    id: 'content',
    title: 'Đây là khu vực nội dung',
    description:
      'Phần bên phải hiển thị toàn bộ nội dung công việc theo module bạn chọn ở sidebar.',
    target: 'tour-content',
    mascotAction: 'walk',
  },
  {
    id: 'truyenthong',
    title: 'Truyền thông nội bộ',
    description:
      'Xem các thông báo, bài viết và cập nhật vận hành nội bộ. Đây là nơi bạn nên theo dõi thường xuyên.',
    target: 'tour-nav-truyenthong',
    route: '/user/truyenthong',
    mascotAction: 'walk',
  },
  {
    id: 'thongtin',
    title: 'Thông tin của tôi',
    description:
      'Kiểm tra hồ sơ, dữ liệu cá nhân và các thông tin liên quan đến công việc/đào tạo của bạn.',
    target: 'tour-nav-thongtin',
    route: '/user/thongtingv',
    mascotAction: 'walk',
  },
  {
    id: 'hoatdong',
    title: 'Hoạt động hàng tháng',
    description:
      'Xem lịch hoạt động theo tháng và các mốc quan trọng (sự kiện/khảo thí) theo timeline.',
    target: 'tour-nav-hoatdong',
    route: '/user/hoat-dong-hang-thang',
    mascotAction: 'walk',
  },
  {
    id: 'xinnghi',
    title: 'Tạo yêu cầu xin nghỉ',
    description:
      'Tạo yêu cầu xin nghỉ theo nhu cầu và theo dõi trạng thái xử lý.',
    target: 'tour-nav-xinnghi',
    route: '/user/xin-nghi-mot-buoi',
    mascotAction: 'walk',
  },
  {
    id: 'nhanlop',
    title: 'Danh sách nhận lớp dạy thay',
    description: 'Xem và nhận các lớp 1 buổi theo nhu cầu (khi được mở).',
    target: 'tour-nav-nhanlop',
    route: '/user/nhan-lop-1-buoi',
    mascotAction: 'walk',
  },
  {
    id: 'training',
    title: 'Đào tạo nâng cao',
    description: 'Xem nội dung đào tạo nâng cao và lộ trình học tập được giao.',
    target: 'tour-nav-training',
    route: '/user/training',
    mascotAction: 'walk',
  },
  {
    id: 'assignments',
    title: 'Quản lý kiểm tra',
    description:
      'Theo dõi các bài kiểm tra/assignment của bạn và truy cập khi đến thời điểm làm bài.',
    target: 'tour-nav-assignments',
    route: '/user/assignments',
    mascotAction: 'walk',
  },
  {
    id: 'giaitrinh',
    title: 'Giải trình điểm kiểm tra',
    description:
      'Gửi và theo dõi các yêu cầu giải trình về điểm kiểm tra khi cần.',
    target: 'tour-nav-giaitrinh',
    route: '/user/giaitrinh',
    mascotAction: 'walk',
  },
  {
    id: 'quytrinh',
    title: 'Quy trình & Quy định',
    description:
      'Tra cứu nhanh các quy trình/quy định để làm việc đúng chuẩn và nhất quán.',
    target: 'tour-nav-quytrinh',
    route: '/user/page2',
    mascotAction: 'walk',
  },
]

function getMascotFrames(action: MascotAction) {
  const folder = action === 'jump' ? 'jump' : 'walk'
  return [1, 2, 3, 4, 5].map((index) => `/mascot/${folder}/frame-${index}.png`)
}

export default function UserFirstLoginOnboarding() {
  const { user, isLoading } = useAuth()
  const { isOpen, setIsOpen } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()

  const [tourEnabled, setTourEnabled] = useState(false)
  const [sessionDismissed, setSessionDismissed] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [frameIndex, setFrameIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [viewport, setViewport] = useState({ width: 1280, height: 720 })
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  const step = TOUR_STEPS[stepIndex]
  const frames = useMemo(
    () => getMascotFrames(step.mascotAction),
    [step.mascotAction],
  )
  const mascotFacing = useMemo<'left' | 'right'>(() => {
    // Quy tắc theo flow hiện tại:
    // - Các step nói về sidebar / nav item: linh vật quay về bên trái
    // - Step nói về content (bên phải): linh vật quay về bên phải
    if (step.target === 'tour-content') return 'right'
    return 'left'
  }, [step.target])

  useEffect(() => {
    if (!tourEnabled) return
    document.documentElement.dataset.onboarding = '1'
    return () => {
      delete document.documentElement.dataset.onboarding
    }
  }, [tourEnabled])

  useEffect(() => {
    // Preload all frames to tránh "ghosting/overlap" khi Next/Image đổi src liên tục.
    frames.forEach((src) => {
      const img = new window.Image()
      img.src = src
    })
  }, [frames])

  useEffect(() => {
    const timer = window.setInterval(
      () => {
        setFrameIndex((prev) => (prev + 1) % frames.length)
      },
      step.mascotAction === 'jump' ? 120 : 140,
    )
    return () => window.clearInterval(timer)
  }, [frames.length, step.mascotAction])

  useEffect(() => {
    const updateViewport = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  // Điều hướng nội dung bên phải theo step (để user thấy đúng trang đang được giới thiệu)
  useEffect(() => {
    if (!tourEnabled) return
    if (!step.route) return
    if (pathname === step.route || pathname.startsWith(`${step.route}/`)) return
    router.push(step.route)
  }, [pathname, router, step.route, tourEnabled])

  useEffect(() => {
    if (!tourEnabled) return
    const element = document.querySelector(
      `[data-tour="${step.target}"]`,
    ) as HTMLElement | null
    if (!element) {
      setTargetRect(null)
      return
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const updateRect = () => {
      const rect = element.getBoundingClientRect()
      setTargetRect(rect)
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [step.target, tourEnabled, pathname])

  useEffect(() => {
    // tooltipRef is reserved for future positioning needs.
    // (Mascot is now anchored inside the tooltip.)
    return
  }, [tourEnabled, stepIndex, viewport.width, viewport.height])

  useEffect(() => {
    if (!tourEnabled) return
    if (!pathname.startsWith('/user')) {
      setTourEnabled(false)
    }
  }, [pathname, tourEnabled])

  useEffect(() => {
    if (!tourEnabled) return
    if (!isOpen) setIsOpen(true)
  }, [isOpen, setIsOpen, tourEnabled])

  useEffect(() => {
    const bootstrap = async () => {
      if (isLoading || !user?.email) return
      if (!pathname.startsWith('/user')) return
      if (sessionDismissed) return
      // Prevent re-bootstrap loops when route changes during onboarding.
      if (tourEnabled) return

      // Fast local check — if user already completed this version, skip entirely.
      try {
        if (
          localStorage.getItem(
            `${LS_KEY_PREFIX}${TOUR_VERSION}_${user.email}`,
          ) === '1'
        )
          return
      } catch {}

      const emailPrefix = user.email.split('@')[0]?.toLowerCase() || ''
      const forceOnboarding = FORCE_ONBOARDING_EMAIL_PREFIXES.has(emailPrefix)

      if (forceOnboarding) {
        setStepIndex(findStepIndexById('sidebar'))
        setTourEnabled(true)
        return
      }

      try {
        const response = await fetch(
          `/api/onboarding/state?email=${encodeURIComponent(user.email)}`,
          { cache: 'no-store' },
        )
        const data = (await response.json()) as OnboardingStateResponse
        const completed = Boolean(data?.state?.completed)
        const tourVersion = Number(data?.state?.tour_version || 1)
        if (completed && tourVersion >= TOUR_VERSION) {
          try {
            localStorage.setItem(
              `${LS_KEY_PREFIX}${TOUR_VERSION}_${user.email}`,
              '1',
            )
          } catch {}
          return
        }
        setStepIndex(findStepIndexById('sidebar'))
        setTourEnabled(true)
      } catch {
        // Keep the app usable even when onboarding API is unavailable.
      }
    }

    bootstrap()
  }, [isLoading, pathname, sessionDismissed, tourEnabled, user?.email])

  const persistState = async (completed: boolean, lastSeenStep: string) => {
    if (!user?.email) return
    if (completed) {
      try {
        localStorage.setItem(
          `${LS_KEY_PREFIX}${TOUR_VERSION}_${user.email}`,
          '1',
        )
      } catch {}
    }
    const emailPrefix = user.email.split('@')[0]?.toLowerCase() || ''
    const forceOnboarding = FORCE_ONBOARDING_EMAIL_PREFIXES.has(emailPrefix)
    if (forceOnboarding) return
    try {
      await fetch('/api/onboarding/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          completed,
          last_seen_step: lastSeenStep,
          tour_version: TOUR_VERSION,
        }),
      })
    } catch {
      // Non-blocking; localStorage fallback already saved above.
    }
  }

  const closeTour = async () => {
    await persistState(true, step.id)
    setTourEnabled(false)
    setSessionDismissed(true)
  }

  const nextStep = async () => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      await closeTour()
      return
    }
    const next = stepIndex + 1
    setStepIndex(next)
    await persistState(false, TOUR_STEPS[next].id)
  }

  const previousStep = () => {
    if (stepIndex === 0) return
    setStepIndex((prev) => prev - 1)
  }

  const tooltipX = targetRect
    ? Math.min(targetRect.left, viewport.width - 440)
    : 24
  const tooltipY = targetRect
    ? Math.min(targetRect.bottom + 16, viewport.height - 260)
    : Math.max(80, viewport.height / 2 - 120)

  const hole = useMemo(() => {
    if (!targetRect) return null
    const left = Math.max(0, targetRect.left - HOLE_PADDING)
    const top = Math.max(0, targetRect.top - HOLE_PADDING)
    const right = Math.min(viewport.width, targetRect.right + HOLE_PADDING)
    const bottom = Math.min(viewport.height, targetRect.bottom + HOLE_PADDING)
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    }
  }, [targetRect, viewport.height, viewport.width])

  const placement = useMemo(() => {
    if (!hole)
      return {
        x: 24,
        y: Math.max(80, viewport.height / 2 - 120),
        side: 'free' as const,
      }

    const gap = 14
    const cardW = Math.min(360, Math.floor(viewport.width * 0.92))
    const cardH = 210

    const canRight = hole.right + gap + cardW <= viewport.width - 12
    const canLeft = hole.left - gap - cardW >= 12
    const canBottom = hole.bottom + gap + cardH <= viewport.height - 12
    const canTop = hole.top - gap - cardH >= 70

    if (canRight) {
      return {
        x: hole.right + gap,
        y: Math.min(Math.max(hole.top, 80), viewport.height - cardH - 12),
        side: 'right' as const,
        cardW,
      }
    }
    if (canLeft) {
      return {
        x: hole.left - gap - cardW,
        y: Math.min(Math.max(hole.top, 80), viewport.height - cardH - 12),
        side: 'left' as const,
        cardW,
      }
    }
    if (canBottom) {
      return {
        x: Math.min(Math.max(hole.left, 12), viewport.width - cardW - 12),
        y: hole.bottom + gap,
        side: 'bottom' as const,
        cardW,
      }
    }
    if (canTop) {
      return {
        x: Math.min(Math.max(hole.left, 12), viewport.width - cardW - 12),
        y: hole.top - gap - cardH,
        side: 'top' as const,
        cardW,
      }
    }
    return {
      x: 24,
      y: Math.max(80, viewport.height / 2 - 120),
      side: 'free' as const,
      cardW,
    }
  }, [hole, viewport.height, viewport.width])

  const tooltipLeft = placement.x
  const tooltipTop = placement.y
  const tooltipWidth =
    placement.cardW || Math.min(360, Math.floor(viewport.width * 0.92))

  if (!tourEnabled) return null

  return (
    <AnimatePresence mode="sync">
      <motion.div
        key="overlay"
        className="fixed inset-0"
        style={{ zIndex: OVERLAY_Z, pointerEvents: 'none' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {hole && (
          <>
            {/* 4 overlay panels around the focus hole (focus area stays clear) */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: hole.top,
                background: 'rgba(0,0,0,0.55)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: hole.top,
                width: hole.left,
                height: hole.height,
                background: 'rgba(0,0,0,0.55)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: hole.right,
                top: hole.top,
                width: Math.max(0, viewport.width - hole.right),
                height: hole.height,
                background: 'rgba(0,0,0,0.55)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: hole.bottom,
                width: '100%',
                height: Math.max(0, viewport.height - hole.bottom),
                background: 'rgba(0,0,0,0.55)',
              }}
            />
          </>
        )}
      </motion.div>

      {hole && (
        <motion.div
          key="focus"
          className="fixed rounded-xl border-2 border-white/90 shadow-lg pointer-events-none"
          style={{ zIndex: OVERLAY_Z + 1 }}
          initial={false}
          animate={{
            left: hole.left,
            top: hole.top,
            width: hole.width,
            height: hole.height,
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        />
      )}

      <motion.div
        key="tooltip"
        className="fixed rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl"
        style={{
          zIndex: OVERLAY_Z + 3,
          left: tooltipLeft,
          top: tooltipTop,
          width: tooltipWidth,
        }}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        ref={tooltipRef}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1 rounded-full bg-[#a1001f]/10 px-2 py-0.5 text-[11px] font-semibold text-[#a1001f]">
              <Sparkles className="h-3 w-3" />
              Onboarding
            </p>
            <h3 className="mt-2 text-sm font-bold text-gray-900">
              {step.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeTour}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Đóng hướng dẫn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-6 text-gray-700">{step.description}</p>

        <div className="relative mt-4 h-[132px]">
          <div className="absolute bottom-0 right-0 flex items-center gap-2">
            <button
              type="button"
              onClick={previousStep}
              disabled={stepIndex === 0}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Quay lại
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center gap-1 rounded-md bg-[#a1001f] px-3 py-2 text-xs font-semibold text-white hover:bg-[#8a001a]"
            >
              {stepIndex >= TOUR_STEPS.length - 1 ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Hoàn tất
                </>
              ) : (
                <>
                  Tiếp theo
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          <div className="h-full pr-[168px]">
            <div className="flex h-full flex-col">
              <p className="text-xs font-medium text-gray-500">
                Bước {stepIndex + 1}/{TOUR_STEPS.length}
              </p>

              {/* Mascot anchored directly under the step label, without affecting tooltip height */}
              <div className="pointer-events-none relative mt-0 flex-1">
                <div className="absolute left-0 top-0 h-full w-[200px] max-w-full">
                  <Image
                    key={frames[frameIndex]}
                    src={frames[frameIndex]}
                    alt="Linh vật hướng dẫn"
                    fill
                    sizes="200px"
                    priority
                    unoptimized
                    className="object-contain"
                    style={{
                      transform:
                        mascotFacing === 'left' ? 'scaleX(-1)' : 'scaleX(1)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
