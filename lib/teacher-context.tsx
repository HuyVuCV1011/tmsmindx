"use client";

import { Teacher } from '@/types/teacher';
import { parseLegacyTeacherFromInfoJson } from '@/lib/teacher-db-mapper';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth-context';
import { logger } from './logger';


interface TeacherContextType {
  teacherProfile: Teacher | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  // Các helper method có thể thêm vào đây
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

export function TeacherProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [teacherProfile, setTeacherProfile] = useState<Teacher | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Chỉ fetch dữ liệu nếu user đã đăng nhập
  const refreshProfile = async () => {
    if (!user?.email) {
      setTeacherProfile(null);
      return;
    }

    try {
      setIsLoading(true);
      logger.info('Fetching teacher profile...', { email: user.email });
      
      const res = await fetch(`/api/teachers/info?email=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      const parsed = parseLegacyTeacherFromInfoJson(data);
      const profile: Teacher | null = parsed?.teacher ?? null;

      if (profile) {
          logger.success('Teacher profile loaded', { code: profile.code, branch: profile.branchCurrent });
          setTeacherProfile(profile);

      } else {
          logger.warn('Teacher profile not found for email', { email: user.email });
          setTeacherProfile(null);
      }
    } catch (error) {
      logger.error('Error fetching teacher profile', { error });
      // Không clear profile cũ nếu lỗi mạng, trừ khi logout (đã handle ở useEffect)
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email) {
      refreshProfile();
    } else {
      setTeacherProfile(null);
      setIsLoading(false);
    }
  }, [user?.email]);

  const value = useMemo(() => ({
    teacherProfile,
    isLoading,
    refreshProfile,
    currentBranch: teacherProfile?.branchCurrent || null,
    currentCode: teacherProfile?.code || null,
  }), [teacherProfile, isLoading]);

  return (
    <TeacherContext.Provider value={value}>
      {children}
    </TeacherContext.Provider>
  );
}
