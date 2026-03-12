import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getCacheKey, isCacheValid, setCacheEntry, getCacheEntry, type BirthdaysCacheEntry } from '@/lib/birthday-cache'

export const dynamic = 'force-dynamic'

const BIRTHDAY_GAS_URL = 'https://script.google.com/macros/s/AKfycbxgtpi2ZxtWxzcXwcfO-l0_Qy43sXgy97yIh7F1YX2TgxvH_5AdbxfjDM24l0CSQGDQhQ/exec'

interface Birthday {
    id: number
    name: string
    date: string
    month: number
    day: number
    teachingLevel: string
    email?: string
    username?: string
    area?: string
    masked?: boolean
}

interface TeacherListRecord {
    emailCongViec?: string
    usernameLms?: string
}

// Tuần trong tháng: tuần 1: 1-7, tuần 2: 8-14, tuần 3: 15-21, tuần 4: 22-hết tháng
function getCurrentWeek(day: number): number {
    if (day <= 7) return 1
    if (day <= 14) return 2
    if (day <= 21) return 3
    return 4
}

function getWeekRange(week: number, year: number, month: number): { start: number; end: number } {
    const daysInMonth = new Date(year, month, 0).getDate()
    if (week === 1) return { start: 1, end: 7 }
    if (week === 2) return { start: 8, end: 14 }
    if (week === 3) return { start: 15, end: 21 }
    return { start: 22, end: daysInMonth }
}

// Parse một record từ GAS response
// Actual GAS fields: hoVaTen, ngaySinh (DD/MM/YYYY), ngaySinhTrongThang, boPhan, emailCongViec
function parseBirthdayRecord(record: Record<string, unknown>, id: number, fallbackMonth: number): Birthday | null {
    const name = String(
        record.hoVaTen || record.name || record.Name || record.fullname ||
        record.teacher_name || record.HoTen || ''
    ).trim()
    if (!name) return null

    let day = 0
    let month = fallbackMonth

    // Ưu tiên ngaySinhTrongThang (đã là số ngày)
    if (record.ngaySinhTrongThang) {
        day = Number(record.ngaySinhTrongThang)
    }

    // Parse ngaySinh (DD/MM/YYYY) để lấy day và month chính xác
    if (record.ngaySinh) {
        const parts = String(record.ngaySinh).split('/')
        if (parts.length >= 2) {
            day = parseInt(parts[0])
            month = parseInt(parts[1])
        }
    } else if (record.birthday) {
        const parts = String(record.birthday).split('/')
        if (parts.length >= 2) {
            day = parseInt(parts[0])
            month = parseInt(parts[1])
        }
    } else if (record.date) {
        const dateStr = String(record.date)
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/')
            day = parseInt(parts[0])
            month = parseInt(parts[1])
        } else if (dateStr.includes('-')) {
            const parts = dateStr.split('-')
            month = parseInt(parts[1])
            day = parseInt(parts[2])
        }
    } else if (record.day && record.month) {
        day = Number(record.day)
        month = Number(record.month)
    }

    if (!day || day < 1 || day > 31 || month < 1 || month > 12) return null

    const teachingLevel = String(
        record.boPhan || record.teachingLevel || record.department ||
        record.programCurrent || record.KhoiGiangDay || 'Chưa phân bổ'
    )

    return {
        id,
        name,
        date: `${day} Tháng ${month}`,
        month,
        day,
        teachingLevel,
        email: String(record.emailCongViec || record.email || record.Email || ''),
        username: String(record.usernameLms || record.username || ''),
    }
}

// Fetch leader.area của một giáo viên qua username  
async function fetchTeacherArea(username: string): Promise<string | null> {
    if (!username) return null
    try {
        const res = await fetch(
            `${BIRTHDAY_GAS_URL}?username=${encodeURIComponent(username)}`,
            { cache: 'no-store' }
        )
        if (!res.ok) return null
        const json = await res.json()
        return json?.data?.leader?.area ||
               json?.data?.khuVucLamViec ||
               null
    } catch {
        return null
    }
}

// Mask tên: giữ từ đầu (họ), viết tắt các từ còn lại
// Ví dụ: "Nguyễn Thị Hương" → "Nguyễn T. H."
function maskName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length <= 1) return parts[0][0] + '.'
    const lastName = parts[0]
    const initials = parts.slice(1).map(w => w[0].toUpperCase() + '.').join(' ')
    return `${lastName} ${initials}`
}

// Lấy danh sách email đã tắt show_birthday từ DB
async function fetchHiddenBirthdayEmails(): Promise<Set<string>> {
    try {
        const result = await pool.query(
            `SELECT teacher_email FROM teacher_privacy_settings WHERE show_birthday = false`
        )
        return new Set(result.rows.map((r: { teacher_email: string }) => r.teacher_email.toLowerCase()))
    } catch {
        return new Set()
    }
}

// Resolve usernameLms từ email đăng nhập dựa trên action=list&status=Đang làm
async function resolveUsernameFromEmail(email: string): Promise<string | null> {
    if (!email) return null

    try {
        const normalizedEmail = email.trim().toLowerCase()
        const response = await fetch(
            `${BIRTHDAY_GAS_URL}?action=list&status=${encodeURIComponent('Đang làm')}`,
            { cache: 'no-store' }
        )

        if (!response.ok) return null

        const data = await response.json()
        const records: TeacherListRecord[] = Array.isArray(data?.data) ? data.data : []

        const matchedTeacher = records.find(record => {
            const workEmail = String(record.emailCongViec || '').trim().toLowerCase()
            return workEmail === normalizedEmail
        })

        const username = String(matchedTeacher?.usernameLms || '').trim()
        return username || null
    } catch {
        return null
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const loginEmail = (searchParams.get('email') || '').trim()
        const fallbackUsername = (searchParams.get('username') || '').trim()

        // Ưu tiên lấy usernameLms chính xác từ emailCongViec
        const resolvedUsername = loginEmail ? await resolveUsernameFromEmail(loginEmail) : null
        const username = resolvedUsername || fallbackUsername

        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()
        const currentDay = now.getDate()

        const currentWeek = getCurrentWeek(currentDay)
        const weekRange = getWeekRange(currentWeek, currentYear, currentMonth)

        // Fetch user's leader.area once (outside cache logic)
        const userArea = username ? await fetchTeacherArea(username) : null

        const cacheKey = getCacheKey(currentMonth, currentYear)
        const cachedEntry = getCacheEntry(cacheKey)
        const isCached = cachedEntry && isCacheValid(cachedEntry)

        console.log(`[Birthdays API] Cache check - key: ${cacheKey}, valid: ${isCached}`)

        // Fetch data: nếu cache valid thì dùng cache, nếu không thì fetch mới
        let birthdayRecords: Record<string, unknown>[]
        let hiddenEmails: Set<string>

        if (isCached) {
            // Use cached data
            console.log(`[Birthdays API] Using cached data`)
            birthdayRecords = cachedEntry!.birthdayData
            // Luôn lấy privacy mới nhất để tránh stale khi user vừa bật/tắt show_birthday.
            hiddenEmails = await fetchHiddenBirthdayEmails()
        } else {
            console.log(`[Birthdays API] Fetching fresh data from GAS + DB`)
            
            // Fetch birthday list và hidden emails song song (userArea đã fetch ở trên)
            const [gasResponse, fetchedHiddenEmails] = await Promise.all([
                fetch(`${BIRTHDAY_GAS_URL}?action=birthday&month=${7}`, { cache: 'no-store' }),
                fetchHiddenBirthdayEmails()
            ])

            if (!gasResponse.ok) {
                throw new Error(`GAS responded with status: ${gasResponse.status}`)
            }

            const gasData = await gasResponse.json()

            // Extract array từ response — GAS trả về: { status: "ok", month, total, data: [...] }
            birthdayRecords = []
            if (Array.isArray(gasData)) {
                birthdayRecords = gasData
            } else if (gasData?.data && Array.isArray(gasData.data)) {
                birthdayRecords = gasData.data
            } else if (gasData?.result && Array.isArray(gasData.result)) {
                birthdayRecords = gasData.result
            } else if (gasData?.teachers && Array.isArray(gasData.teachers)) {
                birthdayRecords = gasData.teachers
            }

            hiddenEmails = fetchedHiddenEmails

            // Update cache
            console.log(`[Birthdays API] Saved to cache - key: ${cacheKey}, records: ${birthdayRecords.length}, hidden: ${hiddenEmails.size}`)
            setCacheEntry(cacheKey, {
                timestamp: Date.now(),
                birthdayData: birthdayRecords
            })
        }

        // Parse và filter theo tuần hiện tại
        const weekBirthdays: Birthday[] = []
        let idCounter = 1

        for (const record of birthdayRecords) {
            const birthday = parseBirthdayRecord(record, idCounter, currentMonth)
            if (!birthday) continue
            if (birthday.day >= weekRange.start && birthday.day <= weekRange.end) {
                weekBirthdays.push(birthday)
                idCounter++
            }
        }

        weekBirthdays.sort((a, b) => a.day - b.day)

        // Áp dụng privacy: mask tên nếu show_birthday = false
        let maskedCount = 0
        for (const b of weekBirthdays) {
            if (b.email && hiddenEmails.has(b.email.toLowerCase())) {
                b.name = maskName(b.name)
                b.masked = true
                maskedCount++
            }
        }
        
        console.log(`[Birthdays API] Privacy applied - total: ${weekBirthdays.length}, masked: ${maskedCount}`)

        let birthdays = weekBirthdays

        // Nếu có username → filter theo leader.area
        if (userArea) {
            // Fetch area của từng giáo viên sinh nhật trong tuần song song
            const areasResult = await Promise.all(
                weekBirthdays.map(b => fetchTeacherArea(b.username || ''))
            )

            birthdays = weekBirthdays
                .map((b, i) => ({ ...b, area: areasResult[i] || '' }))
                .filter(b => b.area === userArea)
        }

        console.log(`[Birthdays API] Response - count: ${birthdays.length}, fromCache: ${isCached}`)

        return NextResponse.json({
            success: true,
            data: birthdays,
            month: currentMonth,
            year: currentYear,
            week: currentWeek,
            weekRange,
            userArea: userArea || null,
            resolvedUsernameLms: resolvedUsername,
            usernameUsed: username || null,
            fromCache: isCached,
            count: birthdays.length
        })
    } catch (error) {
        console.error('Error fetching birthdays:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch birthdays' },
            { status: 500 }
        )
    }
}
