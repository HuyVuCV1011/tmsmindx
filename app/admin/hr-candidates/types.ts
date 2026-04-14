export interface HrCandidateRow {
  rowNumber: number;
  candidateKey: string;
  candidateFingerprint: string;
  candidateCode: string;
  regionCode: '1' | '2' | '3' | '4' | '5' | '';
  name: string;
  email: string;
  phone: string;
  status: string;
  desiredCampus: string;
  workBlock: string;
  desiredProgram: string;
  sheetGen: string;
  effectiveGen: string;
  isSheetGenMissing: boolean;
  isUnassigned: boolean;
  hasManualAssignment: boolean;
  assignedByEmail: string | null;
  assignedAt: string | null;
  updatedAt: string | null;
  note: string | null;
  raw: Record<string, string>;
}

export interface HrSummary {
  total: number;
  assigned: number;
  unassigned: number;
  missingSheetGen: number;
  manualAssigned: number;
  byGen: Record<string, number>;
  byRegion: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface HrPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface HrSource {
  sheetId: string;
  gid: string;
  fetchedAt: string;
}

export interface DraftAssignment {
  gen: string;
  note: string;
}
export interface GenEntry {
  key: string;
  genCode: string;
  count: number;
  regionCode: string;
  regionLabel: string;
  isTeacher4Plus: boolean;
  note: string;
}
