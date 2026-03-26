"use client";

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from './auth-context';
import { Teacher } from '@/types/teacher';
import { logger } from './logger';
import { findMatchingCampus } from './campus-data';

const STORAGE_KEY = 'teacher_auto_fill_data';

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
  const [isLoading, setIsLoading] = useState(false);

  // Chỉ fetch dữ liệu nếu user đã đăng nhập
  const refreshProfile = async () => {
    if (!user?.email) {
      setTeacherProfile(null);
      return;
    }

    try {
      setIsLoading(true);
      logger.info('Fetching teacher profile...', { email: user.email });
      
      const res = await fetch(`/api/teachers?email=${encodeURIComponent(user.email)}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch teacher profile: ${res.status}`);
      }

      const data = await res.json();
      
      let profile: Teacher | null = null;

      if (Array.isArray(data)) {
        profile = data.find((t: Teacher) => 
          t.emailMindx?.toLowerCase() === user.email?.toLowerCase() || 
          t.emailPersonal?.toLowerCase() === user.email?.toLowerCase()
        ) || data[0] || null;
      } else if (data.teacher) {
        profile = data.teacher;
      }

      if (profile) {
          logger.success('Teacher profile loaded', { code: profile.code, branch: profile.branchCurrent });
          setTeacherProfile(profile);

          // Auto-save to localStorage for global access
          try {
            const teacherBranch = profile.branchIn || profile.branchCurrent || '';
            const matchedCampus = findMatchingCampus(teacherBranch);
            
            const autoFillData = {
              teacher_name: profile.name || '',
              lms_code: profile.code || '',
              email: profile.emailMindx || profile.emailPersonal || user.email || '',
              campus: matchedCampus || ''
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(autoFillData));
            logger.info('Auto-fill data saved to localStorage', autoFillData);
          } catch (e) {
            logger.error('Failed to save auto-fill data', e);
          }

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
