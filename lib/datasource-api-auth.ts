import pool from '@/lib/db'
import { findTeacherRowByEmailOrCode } from '@/lib/teacher-profile-bundle'
import {
  TPS_SESSION_COOKIE,
  verifySessionCookieValue,
} from '@/lib/session-cookie'
import {
  teacherRowWorkEmail,
  userCanLookupAnyTeacher,
  verifyBearerGetSession,
} from '@/lib/verify-bearer-session'
import { NextRequest, NextResponse } from 'next/server'

export type DatasourceBearerOk = {
  ok: true
  sessionEmail: string
  privileged: boolean
}

export type DatasourceBearerResult =
  | DatasourceBearerOk
  | { ok: false; response: NextResponse }

export async function requireDatasourceBearer(
  request: NextRequest,
): Promise<DatasourceBearerResult> {
  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!bearer) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Yêu cầu đăng nhập (Authorization Bearer)' },
        { status: 401 },
      ),
    }
  }
  const session = await verifyBearerGetSession(bearer)
  if (!session?.email) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Token không hợp lệ hoặc đã hết hạn' },
        { status: 401 },
      ),
    }
  }
  const privileged = await userCanLookupAnyTeacher(session.email)
  return { ok: true, sessionEmail: session.email, privileged }
}

/** Bearer hoặc cookie phiên edge (cho trang public gọi API bằng fetch + cookie). */
export async function requireBearerOrSessionCookie(
  request: NextRequest,
): Promise<DatasourceBearerResult> {
  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (bearer) {
    return requireDatasourceBearer(request)
  }
  const raw = request.cookies.get(TPS_SESSION_COOKIE)?.value
  if (!raw) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Yêu cầu đăng nhập (Authorization Bearer hoặc cookie phiên)',
        },
        { status: 401 },
      ),
    }
  }
  const edge = await verifySessionCookieValue(raw)
  if (!edge?.email) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Phiên không hợp lệ hoặc đã hết hạn' },
        { status: 401 },
      ),
    }
  }
  const privileged = await userCanLookupAnyTeacher(edge.email)
  return { ok: true, sessionEmail: edge.email, privileged }
}

/** Chặn khi `email` trên URL/body khác email trong token (user thường). */
export function rejectIfEmailNotSelf(
  sessionEmail: string,
  privileged: boolean,
  targetEmail: string,
): NextResponse | null {
  if (privileged) return null
  const t = targetEmail.trim().toLowerCase()
  if (!t) return null
  if (t !== sessionEmail) {
    return NextResponse.json(
      { success: false, error: 'Không có quyền truy vấn dữ liệu cho email này' },
      { status: 403 },
    )
  }
  return null
}

/**
 * Trước khi load bundle: user thường chỉ được email của mình, hoặc `code` trỏ đúng bản ghi của mình
 * (dùng cùng logic tìm dòng như `findTeacherRowByEmailOrCode`).
 */
export async function rejectIfDatasourceLookupForbidden(
  sessionEmail: string,
  privileged: boolean,
  email: string,
  code: string,
): Promise<NextResponse | null> {
  if (privileged) return null
  const e = email.trim().toLowerCase()
  const c = code.trim()
  if (e) {
    return rejectIfEmailNotSelf(sessionEmail, false, e)
  }
  if (c) {
    const row = await findTeacherRowByEmailOrCode(pool, { code: c })
    if (!row) return null
    const rowEmail = teacherRowWorkEmail(row as Record<string, unknown>)
    if (!rowEmail || rowEmail !== sessionEmail) {
      return NextResponse.json(
        { success: false, error: 'Không có quyền truy vấn dữ liệu cho mã giáo viên này' },
        { status: 403 },
      )
    }
  }
  return null
}

/** Alias — dùng cho API không thuộc datasource. */
export const requireBearerSession = requireDatasourceBearer

/** `chuyen_sau_results`: chỉ chủ result (email) hoặc privileged. */
export async function rejectIfChuyenSauResultNotOwned(
  sessionEmail: string,
  privileged: boolean,
  resultId: string,
): Promise<NextResponse | null> {
  if (privileged || !resultId.trim()) return null
  const r = await pool.query(
    `SELECT LOWER(TRIM(COALESCE(dia_chi_email,''))) AS e FROM chuyen_sau_results WHERE id = $1 LIMIT 1`,
    [resultId.trim()],
  )
  if (r.rows.length === 0) return null
  const e = String(r.rows[0].e || '').toLowerCase()
  if (e && e !== sessionEmail) {
    return NextResponse.json(
      { success: false, error: 'Không có quyền xem kết quả này' },
      { status: 403 },
    )
  }
  return null
}

/** Mỗi mã GV trong danh sách phải là bản ghi của chính session (hoặc privileged). */
export async function rejectIfAnyTeacherCodeForbidden(
  sessionEmail: string,
  privileged: boolean,
  codes: string[],
): Promise<NextResponse | null> {
  if (privileged) return null
  const seen = new Set<string>()
  for (const raw of codes) {
    const c = raw.trim()
    if (!c || seen.has(c.toLowerCase())) continue
    seen.add(c.toLowerCase())
    const denied = await rejectIfDatasourceLookupForbidden(sessionEmail, false, '', c)
    if (denied) return denied
  }
  return null
}
