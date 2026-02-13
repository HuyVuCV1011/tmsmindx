import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const dynamic = 'force-dynamic'

const TEACHER_PROFILE_CSV_URL = process.env.NEXT_PUBLIC_TEACHER_PROFILE_CSV_URL || ""

interface Birthday {
    id: number
    name: string
    date: string
    month: number
    day: number
    teachingLevel: string // Khối giảng dạy
    email?: string
}

interface Teacher {
    name: string
    code: string
    emailMindx: string
    programCurrent: string
    birthday?: string // Format: DD/MM hoặc DD/MM/YYYY
}

// Kết nối database (optional)
const databaseUrl = process.env.DATABASE_URL
const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      })
    : null

// Fetch teachers từ Google Sheets
async function fetchTeachersFromSheet(): Promise<Teacher[]> {
    try {
        const response = await fetch(TEACHER_PROFILE_CSV_URL, { 
            cache: 'no-store'
        })
        
        if (!response.ok) {
            throw new Error("Cannot fetch sheet data")
        }

        const csvText = await response.text()
        const lines = csvText.split("\n")
        
        // Skip first 2 rows (title + header)
        const dataLines = lines.slice(2).filter(line => line.trim())
        
        const teachers: Teacher[] = dataLines.map(line => {
            const columns = line.split(",").map(col => col.trim().replace(/^"|"$/g, ""))
            
            return {
                name: columns[1] || "",
                code: columns[2] || "",
                emailMindx: columns[3] || "",
                programCurrent: columns[9] || "", // Khối giảng dạy hiện tại
                birthday: columns[15] || "" // Giả sử cột 15 là birthday (DD/MM)
            }
        })

        return teachers.filter(t => t.code && t.birthday)
    } catch (error) {
        console.error("Error fetching teachers from sheet:", error)
        return []
    }
}

export async function GET() {
    try {
        const currentMonth = new Date().getMonth() + 1
        const currentYear = new Date().getFullYear()

        // Fetch teachers từ Google Sheets
        const teachers = await fetchTeachersFromSheet()
        
        // Lấy privacy settings từ database (nếu có DATABASE_URL)
        let hiddenEmails = new Set<string>()
        if (pool) {
            const privacyResult = await pool.query(`
                SELECT teacher_email, show_birthday
                FROM teacher_privacy_settings
                WHERE show_birthday = false
            `)

            hiddenEmails = new Set(
                privacyResult.rows.map(row => row.teacher_email.toLowerCase())
            )
        }

        // Parse birthdays và filter theo tháng hiện tại + privacy
        const birthdays: Birthday[] = []
        let idCounter = 1

        for (const teacher of teachers) {
            // Check privacy setting
            if (hiddenEmails.has(teacher.emailMindx?.toLowerCase())) {
                continue
            }

            // Parse birthday (format: DD/MM hoặc DD/MM/YYYY)
            const birthdayParts = teacher.birthday?.split('/')
            if (!birthdayParts || birthdayParts.length < 2) continue

            const day = parseInt(birthdayParts[0])
            const month = parseInt(birthdayParts[1])

            // Filter theo tháng hiện tại
            if (month === currentMonth && day > 0 && day <= 31) {
                birthdays.push({
                    id: idCounter++,
                    name: teacher.name,
                    date: `${day} Tháng ${month}`,
                    month: month,
                    day: day,
                    teachingLevel: teacher.programCurrent || 'Chưa phân bổ',
                    email: teacher.emailMindx
                })
            }
        }

        // Sort by day
        birthdays.sort((a, b) => a.day - b.day)

        return NextResponse.json({
            success: true,
            data: birthdays,
            month: currentMonth,
            year: currentYear,
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
