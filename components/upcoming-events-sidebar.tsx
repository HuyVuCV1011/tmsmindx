'use client'

import { Calendar, Clock, ArrowRight, Users, Lock } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'

import { useAuth } from '@/lib/auth-context'

interface Post {
    id: string | number
    slug: string
    title: string
    description: string
    post_type: string
    published_at: string
    created_at: string
}

interface Birthday {
    id: number
    name: string
    date: string
    month: number
    day: number
    teachingLevel: string
    masked?: boolean
}

interface BirthdaysResponse {
    success: boolean
    data: Birthday[]
    month: number
    week: number
    weekRange: { start: number; end: number }
    userArea: string | null
    resolvedUsernameLms?: string | null
    usernameUsed?: string | null
    fromCache?: boolean
    count: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())
const BIRTHDAY_PRIVACY_SYNC_KEY = 'birthday-privacy-updated-at'

function getCurrentWeek(day: number): number {
    if (day <= 7) return 1
    if (day <= 14) return 2
    if (day <= 21) return 3
    return 4
}

export function UpcomingEventsSidebar() {
    const { user } = useAuth()
    const [privacySyncToken, setPrivacySyncToken] = useState<string | null>(null)

    // Fallback username từ email nếu backend không resolve được từ emailCongViec
    const fallbackUsernameLms = useMemo(() => {
        if (!user?.email) return null
        const atIdx = user.email.indexOf('@')
        return atIdx > 0 ? user.email.slice(0, atIdx) : null
    }, [user?.email])

    const birthdaysApiUrl = useMemo(() => {
        const params = new URLSearchParams()

        if (user?.email) {
            params.set('email', user.email)
        }

        if (fallbackUsernameLms) {
            params.set('username', fallbackUsernameLms)
        }

        if (privacySyncToken) {
            params.set('refresh', privacySyncToken)
        }

        const queryString = params.toString()
        return queryString ? `/api/birthdays?${queryString}` : '/api/birthdays'
    }, [user?.email, fallbackUsernameLms, privacySyncToken])

    // Debounce URL để tránh refetch liên tục khi auth state thay đổi trong thời gian ngắn.
    const [debouncedBirthdaysApiUrl, setDebouncedBirthdaysApiUrl] = useState(birthdaysApiUrl)

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedBirthdaysApiUrl(birthdaysApiUrl)
        }, 300)

        return () => window.clearTimeout(timer)
    }, [birthdaysApiUrl])

    const { data: posts = [] } = useSWR<Post[]>('/api/truyenthong/posts?status=published', fetcher)
    const {
        data: birthdaysResponse,
        mutate: mutateBirthdays,
        isLoading: isBirthdaysLoading,
        isValidating: isBirthdaysValidating
    } = useSWR<BirthdaysResponse>(debouncedBirthdaysApiUrl, fetcher, {
        keepPreviousData: true,
        dedupingInterval: 10_000,
        revalidateOnFocus: false,
    })

    // Listen cho privacy setting changes và revalidate birthdays cache
    useEffect(() => {
        const syncBirthdayPrivacyChanges = () => {
            const updatedAt = window.localStorage.getItem(BIRTHDAY_PRIVACY_SYNC_KEY)
            if (!updatedAt) return

            console.log('[Birthday Sidebar] Detected persisted privacy change, scheduling fresh fetch...')
            setPrivacySyncToken(updatedAt)
        }

        const handlePrivacyChange = () => {
            console.log('[Birthday Sidebar] Privacy setting changed event received, revalidating...')
            mutateBirthdays()
        }

        const handleWindowFocus = () => {
            syncBirthdayPrivacyChanges()
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncBirthdayPrivacyChanges()
            }
        }

        window.addEventListener('privacy-setting-changed', handlePrivacyChange)
        window.addEventListener('focus', handleWindowFocus)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        syncBirthdayPrivacyChanges()
        console.log('[Birthday Sidebar] Event listener registered')
        
        return () => {
            window.removeEventListener('privacy-setting-changed', handlePrivacyChange)
            window.removeEventListener('focus', handleWindowFocus)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            console.log('[Birthday Sidebar] Event listener removed')
        }
    }, [mutateBirthdays])

    useEffect(() => {
        if (!privacySyncToken || !birthdaysResponse) return

        window.localStorage.removeItem(BIRTHDAY_PRIVACY_SYNC_KEY)
        setPrivacySyncToken(null)
    }, [privacySyncToken, birthdaysResponse])

    // Filter events and get upcoming ones
    const upcomingEvents = useMemo(() => {
        const now = new Date()
        const events = posts
            .filter(post => {
                if (post.post_type !== 'sự-kiện') return false
                const eventDate = new Date(post.published_at)
                return eventDate >= now // Chỉ lấy sự kiện trong tương lai hoặc đang diễn ra
            })
            .sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime())
        
        return events.slice(0, 3) // Get next 3 events
    }, [posts])

    // Get birthdays from API
    const upcomingBirthdays = useMemo(() => {
        return birthdaysResponse?.data || []
    }, [birthdaysResponse])

    const showBirthdaysLoading = (isBirthdaysLoading || isBirthdaysValidating) && upcomingBirthdays.length === 0

    const currentWeek = birthdaysResponse?.week ?? getCurrentWeek(new Date().getDate())
    const currentMonth = birthdaysResponse?.month ?? (new Date().getMonth() + 1)
    const userArea = birthdaysResponse?.userArea

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const day = date.getDate()
        const month = date.getMonth() + 1
        return { day, month }
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }

    const getMonthName = (month: number) => {
        const months = ['', 'THÁNG 1', 'THÁNG 2', 'THÁNG 3', 'THÁNG 4', 'THÁNG 5', 'THÁNG 6',
            'THÁNG 7', 'THÁNG 8', 'THÁNG 9', 'THÁNG 10', 'THÁNG 11', 'THÁNG 12']
        return months[month]
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-700">
            {/* Upcoming Events Section */}
            <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-shadow duration-300">
                <div className="p-5 border-b border-gray-100 bg-linear-to-r from-gray-50 to-white">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-600" />
                        <span>Sự kiện sắp tới</span>
                    </h3>
                </div>
                
                <div className="p-5 space-y-3">
                    {upcomingEvents.length > 0 ? (
                        <>
                            {upcomingEvents.map(event => {
                                const { day, month } = formatDate(event.published_at)
                                return (
                                    <Link
                                        key={event.id}
                                        href={`/user/truyenthong/${event.slug}`}
                                        className="flex gap-4 group hover:bg-linear-to-r hover:from-red-50 hover:to-orange-50 -mx-3 px-3 py-3 rounded-xl transition-all duration-200 border border-transparent hover:border-red-100 hover:shadow-md"
                                    >
                                        <div className="shrink-0">
                                            <div className="w-14 h-16 bg-linear-to-br from-red-600 to-red-700 rounded-xl flex flex-col items-center justify-center text-white shadow-lg shadow-red-200 group-hover:shadow-xl group-hover:shadow-red-300 group-hover:scale-105 transition-all duration-200">
                                                <div className="text-[10px] font-bold uppercase tracking-wide opacity-90">
                                                    Th {month}
                                                </div>
                                                <div className="text-2xl font-black leading-none mt-0.5">
                                                    {day}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-red-700 transition-colors leading-snug mb-1.5">
                                                {event.title}
                                            </h4>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500 group-hover:text-red-600 transition-colors">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span className="font-medium">{formatTime(event.published_at)}</span>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                            
                            <Link
                                href="/user/truyenthong?filter=sự-kiện"
                                className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold py-3 hover:bg-linear-to-r hover:from-blue-50 hover:to-indigo-50 rounded-xl transition-all duration-200 mt-4 border border-transparent hover:border-blue-200 hover:shadow-md group"
                            >
                                <span>Xem toàn bộ lịch</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </>
                    ) : (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Calendar className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="text-sm font-medium text-gray-500">Chưa có sự kiện sắp tới</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Upcoming Birthdays Section */}
            <div className="bg-linear-to-br from-red-800 via-red-900 to-rose-900 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(153,27,27,0.45)] hover:shadow-[0_12px_40px_rgba(153,27,27,0.55)] transition-all duration-300 hover:scale-[1.02]">
                <div className="p-4 border-b border-white/10 bg-linear-to-r from-red-700/50 to-transparent backdrop-blur-sm">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2.5">
                        <span className="text-xl">🎂</span>
                        <span>
                            Sinh nhật tuần {currentWeek} - Tháng {currentMonth}
                        </span>
                    </h3>
                    {userArea && <span className="text-white text-sm ml-1 font-normal normal-case opacity-80">Khu vực: {userArea}</span>}
                    {showBirthdaysLoading && (
                        <div className="text-white/75 text-xs mt-1 animate-pulse">Đang chuẩn bị bánh sinh nhật...</div>
                    )}
                </div>
                
                <div className="p-4 space-y-2">
                    {showBirthdaysLoading ? (
                        <>
                            {[1, 2, 3].map((item) => (
                                <div
                                    key={`birthday-skeleton-${item}`}
                                    className="flex items-center gap-3 -mx-2 px-2.5 py-2.5 rounded-xl bg-white/10 border border-white/10 animate-pulse"
                                >
                                    <div className="w-10 h-10 rounded-full bg-white/20 shrink-0" />
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="h-3.5 w-2/3 rounded bg-white/25" />
                                        <div className="h-3 w-1/2 rounded bg-white/20" />
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : upcomingBirthdays.length > 0 ? upcomingBirthdays.map((person: Birthday) => (
                        <div 
                            key={person.id} 
                            className={`flex items-center gap-3 text-white -mx-2 px-2.5 py-2.5 rounded-xl transition-all duration-200 border backdrop-blur-sm group ${
                                person.masked
                                    ? 'bg-white/5 border-white/5 opacity-60 cursor-default'
                                    : 'bg-white/5 hover:bg-white/15 border-white/10 hover:border-white/25'
                            }`}
                        >
                            <div className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-200">
                                {person.masked
                                    ? <Lock className="w-4 h-4 text-white/70" />
                                    : <Users className="w-4.5 h-4.5 text-white" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`font-bold text-sm tracking-wide ${
                                    person.masked ? 'italic text-white/70' : ''
                                }`}>{person.name}</div>
                                <div className="text-xs text-white/80 font-medium mt-0.5">
                                    {person.date} • {person.masked ? 'Đã ẩn thông tin' : person.teachingLevel}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-6">
                            <div className="text-3xl mb-2">🎉</div>
                            <p className="text-sm text-white/70 font-medium">Không có sinh nhật tuần này</p>
                        </div>
                    )}
                </div>

                <div className="px-4 pb-4">
                    <button className="w-full py-3 bg-white/15 hover:bg-white text-white hover:text-red-700 text-sm font-bold rounded-xl transition-all duration-200 border border-white/30 hover:border-white shadow-lg hover:shadow-xl backdrop-blur-sm group">
                        <span className="flex items-center justify-center gap-2">
                            <span>Gửi lời chúc ngay</span>
                            <span className="group-hover:scale-125 transition-transform">💌</span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}
