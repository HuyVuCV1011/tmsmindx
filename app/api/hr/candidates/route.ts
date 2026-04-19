import { requireBearerSession } from '@/lib/datasource-api-auth';
import { withApiProtection } from '@/lib/api-protection';
import pool from '@/lib/db';
import { buildCandidateFingerprint, buildCandidateKey, getHrCandidateSheetData } from '@/lib/hr-candidate-sheet';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

console.log('--- REBUILDING API ROUTE FOR HR CANDIDATES ---');

const HR_PERMISSION_ROUTE = '/admin/hr-candidates';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
const SOUTH_REGION_CODES: Array<'1' | '3'> = ['1', '3'];
const NORTH_REGION_CODES: Array<'2' | '4' | '5'> = ['2', '4', '5'];

const REGION_LABEL_MAP: Record<'1' | '2' | '3' | '4' | '5', string> = {
  '1': 'Hồ Chí Minh',
  '2': 'Hà Nội',
  '3': 'Tỉnh Nam',
  '4': 'Tỉnh Bắc',
  '5': 'Tỉnh Trung',
};

type HrListStatus = 'all' | 'assigned' | 'unassigned' | 'missing-sheet-gen' | 'manual-assigned';

interface HrAssignmentRow {
  id: number;
  candidate_key: string;
  assigned_gen: string;
  note: string | null;
  assigned_by_email: string;
  assigned_at: string;
  updated_at: string;
}

function normalizeValue(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim();
}

function normalizeEmail(input: unknown): string {
  return normalizeValue(input).toLowerCase();
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeRegionCode(value: string): '1' | '2' | '3' | '4' | '5' | null {
  const normalized = normalizeValue(value);
  if (['1', '2', '3', '4', '5'].includes(normalized)) {
    return normalized as '1' | '2' | '3' | '4' | '5';
  }
  return null;
}

function resolveRegionCodes(regionFilter: string): Array<'1' | '2' | '3' | '4' | '5'> | null {
  const normalized = normalizeValue(regionFilter).toLowerCase();
  if (!normalized || normalized === 'all') return null;
  if (normalized === 'south') return SOUTH_REGION_CODES;
  if (normalized === 'north') return NORTH_REGION_CODES;

  const single = normalizeRegionCode(normalized);
  if (single) return [single];

  return null;
}

function isTeacher4PlusByWorkBlock(workBlock: string): boolean {
  const normalized = normalizeValue(workBlock).toLowerCase();
  if (!normalized) return false;

  const numericPart = normalized.match(/\d+/)?.[0] || '';
  if (!numericPart) return false;
  return Number(numericPart) === 4;
}

function parsePageParam(input: string | null, fallback: number) {
  if (!input) return fallback;
  const parsed = Number(input);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

async function validateHrAccess(requestEmail: string): Promise<{ ok: boolean; status: number; message?: string }> {
  const userResult = await pool.query(
    `SELECT id, role, is_active
     FROM app_users
     WHERE email = $1
     LIMIT 1`,
    [requestEmail]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    return { ok: false, status: 403, message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.' };
  }

  const user = userResult.rows[0] as { id: number; role: string };
  if (user.role === 'super_admin') {
    return { ok: true, status: 200 };
  }

  const permissionResult = await pool.query(
    `SELECT route_path FROM app_permissions WHERE user_id = $1 AND can_access = true
     UNION
     SELECT rp.route_path
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_code = ur.role_code
     WHERE ur.user_id = $1`,
    [user.id]
  );

  const permissions = permissionResult.rows.map((row: { route_path: string }) => row.route_path);
  const hasAccess = permissions.some(
    (routePath) => routePath === HR_PERMISSION_ROUTE || HR_PERMISSION_ROUTE.startsWith(`${routePath}/`)
  );

  if (!hasAccess) {
    return { ok: false, status: 403, message: 'Bạn không có quyền truy cập module HR.' };
  }

  return { ok: true, status: 200 };
}

const handleGet = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const access = await validateHrAccess(auth.sessionEmail);
    if (!access.ok) {
      return NextResponse.json({ error: access.message || 'Không có quyền truy cập.' }, { status: access.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = (normalizeValue(searchParams.get('status')) || 'all') as HrListStatus;
    const search = normalizeValue(searchParams.get('search'));
    const genFilter = normalizeValue(searchParams.get('gen'));
    const genRegionFilter = normalizeValue(searchParams.get('genRegion'));
    const regionFilter = normalizeValue(searchParams.get('region'));
    const forceRefresh = searchParams.get('refresh') === '1';
    const selectedRegionCodes = resolveRegionCodes(regionFilter);
    const normalizedGenRegionFilter = normalizeRegionCode(genRegionFilter);

    const page = parsePageParam(searchParams.get('page'), 1);
    const pageSize = Math.min(parsePageParam(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    const [sheetData, assignmentResult, catalogResult] = await Promise.all([
      getHrCandidateSheetData(forceRefresh),
      pool.query(
        `SELECT id, candidate_key, assigned_gen, note, assigned_by_email, assigned_at, updated_at
         FROM hr_candidate_gen_assignments`
      ),
      pool.query(
        `SELECT gen_name
         FROM hr_gen_catalog
         WHERE is_active = true`
      ),
    ]);

    const assignmentsByKey = new Map<string, HrAssignmentRow>();
    for (const row of assignmentResult.rows as HrAssignmentRow[]) {
      assignmentsByKey.set(row.candidate_key, row);
    }

    const mergedRows = sheetData.candidates.map((candidate) => {
      const assignment = assignmentsByKey.get(candidate.candidateKey);
      const manualGen = normalizeValue(assignment?.assigned_gen);
      const sheetGen = normalizeValue(candidate.sheetGen);
      const effectiveGen = manualGen || sheetGen;

      return {
        rowNumber: candidate.rowNumber,
        candidateKey: candidate.candidateKey,
        candidateFingerprint: candidate.candidateFingerprint,
        candidateCode: candidate.candidateCode,
        regionCode: candidate.regionCode,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        status: candidate.status,
        desiredCampus: candidate.desiredCampus,
        workBlock: candidate.workBlock,
        desiredProgram: candidate.desiredProgram,
        sheetGen,
        effectiveGen,
        isSheetGenMissing: !sheetGen,
        isUnassigned: !effectiveGen,
        hasManualAssignment: Boolean(manualGen),
        assignedByEmail: assignment?.assigned_by_email || null,
        assignedAt: assignment?.assigned_at || null,
        updatedAt: assignment?.updated_at || null,
        note: assignment?.note || null,
        raw: candidate.raw,
      };
    });

    const normalizedSearch = normalizeSearchText(search);
    const normalizedGenFilter = normalizeSearchText(genFilter);

    const matchesBaseFilters = (row: (typeof mergedRows)[number]) => {
      if (statusFilter === 'assigned' && row.isUnassigned) return false;
      if (statusFilter === 'unassigned' && !row.isUnassigned) return false;
      if (statusFilter === 'missing-sheet-gen' && !row.isSheetGenMissing) return false;
      if (statusFilter === 'manual-assigned' && !row.hasManualAssignment) return false;

      if (normalizedGenFilter && normalizedGenFilter !== 'all') {
        if (normalizedGenFilter === '__unassigned__' && !row.isUnassigned) return false;
        if (normalizedGenFilter !== '__unassigned__') {
          const rowGen = normalizeSearchText(row.effectiveGen);
          if (rowGen !== normalizedGenFilter) return false;
        }

        if (normalizedGenRegionFilter) {
          const rowRegionCode = normalizeRegionCode(row.regionCode);
          if (rowRegionCode !== normalizedGenRegionFilter) return false;
        }
      }

      if (!normalizedSearch) return true;

      const searchableValues = [
        row.candidateCode,
        row.name,
        row.email,
        row.phone,
        row.status,
        row.regionCode,
        row.desiredCampus,
        row.workBlock,
        row.desiredProgram,
        row.sheetGen,
        row.effectiveGen,
        row.note || '',
      ]
        .map((value) => normalizeSearchText(value))
        .join(' ');

      return searchableValues.includes(normalizedSearch);
    };

    const rowsForRegionSummary = mergedRows.filter(matchesBaseFilters);

    const summary = {
      total: mergedRows.length,
      assigned: mergedRows.filter((item) => !item.isUnassigned).length,
      unassigned: mergedRows.filter((item) => item.isUnassigned).length,
      missingSheetGen: mergedRows.filter((item) => item.isSheetGenMissing).length,
      manualAssigned: mergedRows.filter((item) => item.hasManualAssignment).length,
      byGen: mergedRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.effectiveGen || 'Chưa xếp GEN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      byRegion: rowsForRegionSummary.reduce<Record<'1' | '2' | '3' | '4' | '5', number>>(
        (acc, row) => {
          const regionCode = normalizeRegionCode(row.regionCode);
          if (regionCode) {
            acc[regionCode] += 1;
          }
          return acc;
        },
        { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
      ),
    };

    const filteredRows = mergedRows
      .filter((row) => {
        if (!matchesBaseFilters(row)) return false;

        if (selectedRegionCodes) {
          const rowRegionCode = normalizeRegionCode(row.regionCode);
          if (!rowRegionCode || !selectedRegionCodes.includes(rowRegionCode)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? -1 : 1;
        if (a.hasManualAssignment !== b.hasManualAssignment) return a.hasManualAssignment ? -1 : 1;
        return a.name.localeCompare(b.name, 'vi');
      });

    const regionScopedRows = mergedRows.filter((row) => {
      if (selectedRegionCodes) {
        const rowRegionCode = normalizeRegionCode(row.regionCode);
        return Boolean(rowRegionCode && selectedRegionCodes.includes(rowRegionCode));
      }
      return true;
    });

    const regionTotal = regionScopedRows.length;

    const regionScopedByGen = regionScopedRows.reduce<Record<string, number>>((acc, row) => {
      const gen = normalizeValue(row.effectiveGen);
      if (!gen) return acc;
      acc[gen] = (acc[gen] || 0) + 1;
      return acc;
    }, {});

    const regionScopedGenEntryMap = regionScopedRows.reduce<
      Record<string, { key: string; genCode: string; count: number; regionCode: string; regionLabel: string; isTeacher4Plus: boolean; note: string }>
    >((acc, row) => {
      const gen = normalizeValue(row.effectiveGen);
      const rowRegionCode = normalizeRegionCode(row.regionCode);
      if (!gen || !rowRegionCode) return acc;

      const key = `${rowRegionCode}::${gen}`;
      if (!acc[key]) {
        acc[key] = {
          key,
          genCode: gen,
          count: 0,
          regionCode: rowRegionCode,
          regionLabel: REGION_LABEL_MAP[rowRegionCode],
          isTeacher4Plus: false,
          note: '',
        };
      }

      acc[key].count += 1;
      if (isTeacher4PlusByWorkBlock(row.workBlock || '')) {
        acc[key].isTeacher4Plus = true;
        acc[key].note = 'Teacher 4+ (mã khối = 4)';
      }

      return acc;
    }, {});

    const regionScopedGenEntries = Object.values(regionScopedGenEntryMap).sort((a, b) => {
      const genSort = a.genCode.localeCompare(b.genCode, 'vi', { numeric: true });
      if (genSort !== 0) return genSort;
      return a.regionCode.localeCompare(b.regionCode, 'vi');
    });

    const regionScopedGens = Object.keys(regionScopedByGen).sort((a, b) => a.localeCompare(b, 'vi'));

    const filteredSummary = {
      total: filteredRows.length,
      assigned: filteredRows.filter((item) => !item.isUnassigned).length,
      unassigned: filteredRows.filter((item) => item.isUnassigned).length,
      byGen: filteredRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.effectiveGen || 'Chưa xếp GEN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    };

    const totalFiltered = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const rows = filteredRows.slice(start, start + pageSize);

    const availableGenSet = new Set<string>(sheetData.availableGens);
    for (const row of assignmentResult.rows as HrAssignmentRow[]) {
      const normalized = normalizeValue(row.assigned_gen);
      if (normalized) availableGenSet.add(normalized);
    }
    for (const row of catalogResult.rows as Array<{ gen_name: string }>) {
      const normalized = normalizeValue(row.gen_name);
      if (normalized) availableGenSet.add(normalized);
    }

    const availableGens = Array.from(availableGenSet).sort((a, b) => a.localeCompare(b, 'vi'));

    return NextResponse.json({
      success: true,
      rows,
      pagination: {
        page: safePage,
        pageSize,
        total: totalFiltered,
        totalPages,
      },
      summary,
      filteredSummary,
      availableGens,
      genScope: {
        byGen: regionScopedByGen,
        entries: regionScopedGenEntries,
        availableGens: regionScopedGens,
        region: regionFilter || 'all',
        regionTotal,
      },
      headers: sheetData.headers,
      source: {
        sheetId: sheetData.source.sheetId,
        gid: sheetData.source.gid,
        fetchedAt: sheetData.fetchedAt,
      },
    });
  } catch (error) {
    console.error('HR candidates GET error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

const handlePost = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();

    const requestEmail = auth.sessionEmail;

    const access = await validateHrAccess(requestEmail);
    if (!access.ok) {
      return NextResponse.json({ error: access.message || 'Không có quyền truy cập.' }, { status: access.status });
    }

    const candidateName = normalizeValue(body.candidateName);
    const candidateEmail = normalizeEmail(body.candidateEmail);
    const candidatePhone = normalizeValue(body.candidatePhone);
    const assignedGen = normalizeValue(body.assignedGen);
    const note = normalizeValue(body.note);

    if (!assignedGen) {
      return NextResponse.json({ error: 'assignedGen là bắt buộc.' }, { status: 400 });
    }

    const candidateFingerprint =
      normalizeValue(body.candidateFingerprint) ||
      buildCandidateFingerprint({
        name: candidateName,
        email: candidateEmail,
        phone: candidatePhone,
        rowNumber: Number(body.sourceRowNumber) || 0,
      });

    const candidateKey = normalizeValue(body.candidateKey) || buildCandidateKey(candidateFingerprint);

    const sourceSheetId = normalizeValue(body.sourceSheetId);
    const sourceGid = normalizeValue(body.sourceGid);
    const sourceRowNumber = Number(body.sourceRowNumber) || null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        `SELECT id, assigned_gen, note
         FROM hr_candidate_gen_assignments
         WHERE candidate_key = $1
         LIMIT 1`,
        [candidateKey]
      );

      const previous = existingResult.rows[0] as { id: number; assigned_gen: string; note: string | null } | undefined;

      const upsertResult = await client.query(
        `INSERT INTO hr_candidate_gen_assignments (
           candidate_key,
           candidate_fingerprint,
           candidate_name,
           candidate_email,
           candidate_phone,
           source_sheet_id,
           source_gid,
           assigned_gen,
           note,
           assigned_by_email,
           assigned_at,
           metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''), $10, CURRENT_TIMESTAMP, $11::jsonb)
         ON CONFLICT (candidate_key)
         DO UPDATE SET
           candidate_fingerprint = EXCLUDED.candidate_fingerprint,
           candidate_name = EXCLUDED.candidate_name,
           candidate_email = EXCLUDED.candidate_email,
           candidate_phone = EXCLUDED.candidate_phone,
           source_sheet_id = COALESCE(EXCLUDED.source_sheet_id, hr_candidate_gen_assignments.source_sheet_id),
           source_gid = COALESCE(EXCLUDED.source_gid, hr_candidate_gen_assignments.source_gid),
           assigned_gen = EXCLUDED.assigned_gen,
           note = EXCLUDED.note,
           assigned_by_email = EXCLUDED.assigned_by_email,
           assigned_at = CURRENT_TIMESTAMP,
           metadata = hr_candidate_gen_assignments.metadata || EXCLUDED.metadata,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          candidateKey,
          candidateFingerprint,
          candidateName || null,
          candidateEmail || null,
          candidatePhone || null,
          sourceSheetId || null,
          sourceGid || null,
          assignedGen,
          note,
          requestEmail,
          JSON.stringify({
            source: 'admin-hr-candidates',
            sourceRowNumber,
          }),
        ]
      );

      const updated = upsertResult.rows[0] as HrAssignmentRow;

      await client.query(
        `INSERT INTO hr_gen_catalog (gen_name, source, created_by_email, is_active)
         VALUES ($1, 'manual', $2, true)
         ON CONFLICT (gen_name)
         DO UPDATE SET
           is_active = true,
           updated_at = CURRENT_TIMESTAMP`,
        [assignedGen, requestEmail]
      );

      const previousGen = previous?.assigned_gen || null;
      const previousNote = previous?.note || null;

      if (previousGen !== updated.assigned_gen || (previousNote || '') !== (updated.note || '')) {
        await client.query(
          `INSERT INTO hr_candidate_gen_assignment_history (
             assignment_id,
             candidate_key,
             previous_gen,
             new_gen,
             changed_by_email,
             change_note
           ) VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''))`,
          [updated.id, candidateKey, previousGen, updated.assigned_gen, requestEmail, note]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        assignment: updated,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('HR candidates POST error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

const handleDelete = async (request: NextRequest) => {
  try {
    const auth = await requireBearerSession(request);
    if (!auth.ok) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const requestEmail = auth.sessionEmail;
    const candidateKey = normalizeValue(searchParams.get('candidateKey'));

    if (!candidateKey) {
      return NextResponse.json({ error: 'candidateKey là bắt buộc.' }, { status: 400 });
    }

    const access = await validateHrAccess(requestEmail);
    if (!access.ok) {
      return NextResponse.json({ error: access.message || 'Không có quyền truy cập.' }, { status: access.status });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        `SELECT id, assigned_gen
         FROM hr_candidate_gen_assignments
         WHERE candidate_key = $1
         LIMIT 1`,
        [candidateKey]
      );

      if (existingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: true, message: 'Không có gán GEN thủ công để xóa.' });
      }

      const existing = existingResult.rows[0] as { id: number; assigned_gen: string };

      await client.query('DELETE FROM hr_candidate_gen_assignments WHERE candidate_key = $1', [candidateKey]);

      await client.query(
        `INSERT INTO hr_candidate_gen_assignment_history (
           assignment_id,
           candidate_key,
           previous_gen,
           new_gen,
           changed_by_email,
           change_note
         ) VALUES ($1, $2, $3, NULL, $4, 'Xóa gán GEN thủ công')`,
        [existing.id, candidateKey, existing.assigned_gen, requestEmail]
      );

      await client.query('COMMIT');

      return NextResponse.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('HR candidates DELETE error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

export const GET = withApiProtection(handleGet);
export const POST = withApiProtection(handlePost);
export const DELETE = withApiProtection(handleDelete);
