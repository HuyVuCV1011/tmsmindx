import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { withApiProtection } from '@/lib/api-protection'

export const dynamic = 'force-dynamic'

// GET: Lấy privacy settings của giáo viên
async function handleGet(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams
        const teacherEmail = searchParams.get('email')

        if (!teacherEmail) {
            return NextResponse.json(
                { success: false, error: 'Teacher email is required' },
                { status: 400 }
            )
        }

        // Get or create privacy settings
        let result = await pool.query(
            `SELECT * FROM teacher_privacy_settings WHERE teacher_email = $1`,
            [teacherEmail]
        )

        // If no settings exist, create default settings
        if (result.rows.length === 0) {
            result = await pool.query(
                `INSERT INTO teacher_privacy_settings 
                 (teacher_email, show_birthday, show_on_public_list, show_phone, show_personal_email)
                 VALUES ($1, true, true, false, false)
                 RETURNING *`,
                [teacherEmail]
            )
        }

        return NextResponse.json({
            success: true,
            data: result.rows[0],
        })
    } catch (error) {
        console.error('Error fetching privacy settings:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { success: false, error: 'Failed to fetch privacy settings', details: errorMessage },
            { status: 500 }
        )
    }
}

// PUT: Cập nhật privacy settings
async function handlePut(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            teacher_email,
            show_birthday,
            show_on_public_list,
            show_phone,
            show_personal_email,
        } = body

        if (!teacher_email) {
            return NextResponse.json(
                { success: false, error: 'Teacher email is required' },
                { status: 400 }
            )
        }

        // Upsert privacy settings
        const result = await pool.query(
            `INSERT INTO teacher_privacy_settings 
             (teacher_email, show_birthday, show_on_public_list, show_phone, show_personal_email, updated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (teacher_email) 
             DO UPDATE SET 
                show_birthday = EXCLUDED.show_birthday,
                show_on_public_list = EXCLUDED.show_on_public_list,
                show_phone = EXCLUDED.show_phone,
                show_personal_email = EXCLUDED.show_personal_email,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                teacher_email,
                show_birthday ?? true,
                show_on_public_list ?? true,
                show_phone ?? false,
                show_personal_email ?? false,
            ]
        )

        return NextResponse.json({
            success: true,
            message: 'Privacy settings updated successfully',
            data: result.rows[0],
        })
    } catch (error) {
        console.error('Error updating privacy settings:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { success: false, error: 'Failed to update privacy settings', details: errorMessage },
            { status: 500 }
        )
    }
}

export const GET = withApiProtection(handleGet)
export const PUT = withApiProtection(handlePut)
