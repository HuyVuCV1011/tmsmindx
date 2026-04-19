"use client";

import { Teacher } from '@/types/teacher';
import { parseLegacyTeacherFromInfoJson } from '@/lib/teacher-db-mapper';
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { logger } from './logger';
import useSWR from 'swr';

interface TeacherContextType {
  teacherProfile: Teacher | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  currentBranch: string | null;
  currentCode: string | null;
}

const TeacherContext = createContext<TeacherContextType>({
  teacherProfile: null,
  isLoading: true,
  refreshProfile: async () => {},
  currentBranch: null,
  currentCode: null,
});

export const useTeacher = () => useContext(TeacherContext);

async function teacherInfoFetcher([url, token]: readonly [string, string | null]) {
  const res = await fetch(url, { headers: authHeaders(token) });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error('Teacher info request failed') as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

export function TeacherProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();

  const swrKey = user?.email
    ? ([
        `/api/teachers/info?email=${encodeURIComponent(user.email)}`,
        token,
      ] as const)
    : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, teacherInfoFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 120_000,
    shouldRetryOnError: false,
  });

  const teacherProfile = useMemo((): Teacher | null => {
    if (!data) return null;
    try {
      const parsed = parseLegacyTeacherFromInfoJson(data);
      return parsed?.teacher ?? null;
    } catch {
      return null;
    }
  }, [data]);

  if (error) {
    logger.warn('Teacher profile fetch error', { error });
  }

  const value = useMemo(
    () => ({
      teacherProfile,
      isLoading: Boolean(user?.email) && isLoading,
      refreshProfile: async () => {
        await mutate();
      },
      currentBranch: teacherProfile?.branchCurrent || null,
      currentCode: teacherProfile?.code || null,
    }),
    [teacherProfile, user?.email, isLoading, data, mutate],
  );

  return (
    <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>
  );
}
