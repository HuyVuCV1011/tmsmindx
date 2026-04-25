"use client";

import { toast } from '@/lib/app-toast';
import { useAuth } from "@/lib/auth-context";
import { logger } from '@/lib/logger';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const SAVED_LOGIN_KEY = 'tps_saved_login_account';
type LandingRole = 'teacher' | 'manager';
type AppRole = LandingRole | 'super_admin' | 'admin' | 'hr';

const ADMIN_LANDING_ROLES = new Set<AppRole>(['super_admin', 'admin', 'hr']);

function resolveTeacherLanding(teacherSync?: { foundInDatabase?: boolean }): string {
  return teacherSync?.foundInDatabase ? '/user/truyenthong' : '/checkdatasource'
}

function resolvePostLoginPath(options: {
  accountRole?: AppRole;
  selectedRole: LandingRole;
  isAdmin: boolean;
  teacherSync?: { foundInDatabase?: boolean };
}): { redirectPath: string; isAdminLanding: boolean } {
  const { accountRole, selectedRole, isAdmin, teacherSync } = options;
  const isAdminLanding =
    Boolean(accountRole && ADMIN_LANDING_ROLES.has(accountRole)) ||
    (selectedRole === 'manager' && isAdmin);

  return {
    redirectPath: isAdminLanding
      ? '/admin/dashboard'
      : resolveTeacherLanding(teacherSync),
    isAdminLanding,
  };
}

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, updateUser } = useAuth();
  const [role, setRole] = useState<LandingRole>('teacher');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loginPreferenceReady, setLoginPreferenceReady] = useState(false);
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_LOGIN_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as { email?: string; role?: 'teacher' | 'manager' };
      if (parsed.email) {
        setEmail(parsed.email);
        setRememberAccount(true);
      }
      if (parsed.role === 'teacher' || parsed.role === 'manager') {
        setRole(parsed.role);
      }
    } catch (e) {
      logger.warn('Unable to load saved login account', { error: (e as Error).message });
    } finally {
      setLoginPreferenceReady(true);
    }
  }, []);

  const persistRememberedAccount = useCallback((accountEmail: string, accountRole: LandingRole) => {
    try {
      if (!rememberAccount) {
        localStorage.removeItem(SAVED_LOGIN_KEY);
        return;
      }
      localStorage.setItem(
        SAVED_LOGIN_KEY,
        JSON.stringify({ email: accountEmail.trim(), role: accountRole })
      );
    } catch (e) {
      logger.warn('Unable to persist saved login account', { error: (e as Error).message });
    }
  }, [rememberAccount]);

  useEffect(() => {
    if (!isLoading && loginPreferenceReady && !hasCheckedAuth.current) {
      hasCheckedAuth.current = true;
      if (user) {
        const { redirectPath } = resolvePostLoginPath({
          accountRole: user.role as AppRole | undefined,
          selectedRole: role,
          isAdmin: Boolean(user.isAdmin),
        });
        logger.info('User already logged in, redirecting', { email: user.email, role: user.role, path: redirectPath });
        router.replace(redirectPath);
      }
    }
  }, [user, isLoading, loginPreferenceReady, role, router]);

  const handleRoleChange = useCallback((newRole: 'teacher' | 'manager') => {
    setRole(newRole);
  }, []);

  const handleTogglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  /** Determine teacher redirect based on teacherSync from API response. */
  function resolveTeacherRedirect(teacherSync?: { foundInDatabase?: boolean }, teacherEmail?: string): string {
    if (teacherSync?.foundInDatabase) {
      if (teacherEmail) {
        try { localStorage.setItem('tps_profile_check_done_email', teacherEmail.toLowerCase()); } catch { /* */ }
      }
      return '/user/truyenthong';
    }
    return '/checkdatasource';
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập Email hoặc Mã đăng nhập.');
      setIsSubmitting(false);
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      setIsSubmitting(false);
      return;
    }

    logger.info('Đang thực hiện login', { email: trimmedEmail, role });

    try {
      // ─── Step 1: Try app-internal login ───
      const appAuthResponse = await fetch('/api/app-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      let appAuthData: {
        appUser?: boolean;
        error?: string;
        dbUnavailable?: boolean;
        idToken?: string;
        accessToken?: string;
        email?: string;
        displayName?: string;
        role?: string;
        localId?: string;
        isAdmin?: boolean;
        permissions?: string[];
        teacherSync?: { foundInDatabase?: boolean };
      } = {};
      try {
        appAuthData = await appAuthResponse.json();
      } catch {
        logger.warn('App auth response was not valid JSON');
      }

      if (appAuthData.appUser === true) {
        if (!appAuthData.idToken || !appAuthData.localId) {
          throw new Error('Phản hồi đăng nhập app không đầy đủ. Vui lòng thử lại.');
        }

        const emailResolved = appAuthData.email ?? trimmedEmail;
        const userData = {
          email: emailResolved,
          displayName: appAuthData.displayName ?? emailResolved.split('@')[0] ?? emailResolved,
          role: (appAuthData.role ?? 'teacher') as 'teacher' | 'manager' | 'super_admin' | 'admin' | 'hr',
          localId: appAuthData.localId,
          isAdmin: Boolean(appAuthData.isAdmin),
          isAppUser: true as const,
          permissions: appAuthData.permissions ?? [],
        };

        // Ưu tiên dùng accessToken (JWT nội bộ) làm Bearer; fallback idToken Firebase
        updateUser(userData, appAuthData.accessToken || appAuthData.idToken);

        const landing = resolvePostLoginPath({
          accountRole: appAuthData.role as AppRole | undefined,
          selectedRole: role,
          isAdmin: Boolean(appAuthData.isAdmin),
          teacherSync: appAuthData.teacherSync,
        });

        if (appAuthData.role === 'super_admin') {
          toast.success(`Chào mừng Super Admin ${appAuthData.displayName}!`);
        } else if (landing.isAdminLanding) {
          toast.success(`Chào mừng Admin ${appAuthData.displayName}!`);
        } else {
          toast.success(`Chào mừng ${appAuthData.displayName}!`);
        }

        persistRememberedAccount(appAuthData.email || trimmedEmail, role);
        logger.info('Redirecting app user', { path: landing.redirectPath, role: userData.role });
        setTimeout(() => { router.replace(landing.redirectPath); }, 500);
        return;
      }

      // ─── Fallback to Firebase ───
      const allowFirebaseFallback =
        (appAuthResponse.ok && appAuthData.appUser === false) ||
        appAuthResponse.status >= 500 ||
        appAuthData.dbUnavailable === true;

      if (!allowFirebaseFallback) {
        throw new Error(appAuthData.error || 'Đăng nhập thất bại');
      }

      // ─── Step 2: Firebase login (role / isAdmin do server tính từ DB, không tin body) ───
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đăng nhập thất bại');
      }

      const serverRole = String(data.role ?? 'teacher') as
        AppRole;

      const userData: {
        email: string;
        displayName: string;
        role: AppRole;
        localId: string;
        isAdmin?: boolean;
        isAppUser?: boolean;
        permissions?: string[];
        userRoles?: string[];
      } = {
        email: data.email,
        displayName: data.displayName,
        role: serverRole,
        localId: data.localId,
        isAppUser: Boolean(data.isAppUser),
        isAdmin: Boolean(data.isAdmin),
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        userRoles: Array.isArray(data.userRoles) ? data.userRoles : [],
      };

      logger.success('Firebase login successful', { email: userData.email, role: userData.role });

      const landing = resolvePostLoginPath({
        accountRole: serverRole,
        selectedRole: role,
        isAdmin: Boolean(userData.isAdmin),
        teacherSync: data?.teacherSync,
      });

      let finalRedirectPath = landing.redirectPath;

      if (landing.isAdminLanding) {
        toast.success(`Chào mừng Admin ${userData.displayName}!`);
      } else if (serverRole === 'teacher') {
        finalRedirectPath = resolveTeacherRedirect(data?.teacherSync, userData.email);

        if (!data?.teacherSync?.foundInDatabase) {
          toast.info('Chưa tìm thấy thông tin giáo viên trong database.', {
            message: 'Vui lòng kiểm tra ở bước tiếp theo.',
            duration: 4500,
          });
        }
        toast.success(`Chào mừng ${userData.displayName}!`);
      } else {
        toast.success(`Chào mừng ${userData.displayName}!`, { duration: 4000 });
      }

      persistRememberedAccount(trimmedEmail, role);
      // Ưu tiên dùng accessToken (JWT nội bộ HS256) làm Bearer; fallback idToken Firebase
      updateUser(userData, data.accessToken || data.idToken);

      logger.info('Redirecting to', { path: finalRedirectPath });
      setTimeout(() => { router.replace(finalRedirectPath); }, 500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(errorMessage);
      logger.error('Login error', { error: errorMessage });

      if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('mật khẩu')) {
        toast.error('Mật khẩu không chính xác!');
      } else if (errorMessage.toLowerCase().includes('email') || errorMessage.toLowerCase().includes('tài khoản')) {
        toast.error('Tài khoản không tồn tại!');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, role, updateUser, router, persistRememberedAccount]);

  const getRoleButtonClass = useCallback((buttonRole: 'teacher' | 'manager') => {
    const isActive = role === buttonRole;
    return `px-6 py-2 rounded-full border text-sm font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 ${isActive
        ? 'bg-[#800000] text-white border-[#a1001f] shadow-md'
        : 'bg-white text-[#800000] border-[#a1001f] hover:border-[#c1122f] hover:shadow-sm'
      }`;
  }, [role]);

  return (
    <div className="box-border h-dvh w-full overflow-hidden bg-white p-0 sm:min-h-screen sm:p-4 flex items-stretch sm:items-center sm:justify-center animate-fade-in">
      <div className="bg-white flex h-full w-full overflow-hidden sm:max-w-4xl sm:rounded-xl sm:shadow-2xl md:h-135 transform transition-all duration-500 sm:hover:shadow-3xl animate-fade-in-up">
        {/* Left side: Banner */}
        <div className="hidden md:flex flex-col justify-between items-start bg-linear-to-br from-[#800000] to-[#E31F26] w-1/3 h-full p-8 text-white">
          <div>
            { }
            <img src="/logo_white.svg" alt="logo" className="h-20 mb-8 animate-fade-in" />
            <h2 className="text-2xl font-bold mb-4 leading-tight animate-slide-up"> Teaching<br />Portal System (TPS)</h2>
            <p className="text-sm opacity-90 mb-8 animate-slide-up animation-delay-200">Hệ thống quản lý thông tin giáo viên, theo dõi tiến độ đào tạo, xử lý yêu cầu tra cứu thông tin nội bộ.</p>
          </div>
          <div className="flex items-center gap-2 text-xs opacity-80">
            <span>Teaching Team</span>
          </div>
        </div>

        {/* Right side: Login form */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 md:px-12 py-4 sm:py-6 animate-fade-in animation-delay-200">
          <div className="flex flex-col gap-4 mb-2">
            <div className="flex justify-center md:hidden">
              { }
              <img src="/logo.svg" alt="MindX logo" className="h-14 w-auto" />
            </div>
            <h2 className="hidden md:block text-xl font-bold text-center text-[#800000] animate-slide-up">MindX Technology School</h2>
            <div className="text-lg font-semibold text-gray-900 text-center mt-2 mb-1 animate-slide-up animation-delay-200">Chào mừng bạn đến với TPS</div>
            <div className="text-sm text-gray-500 text-center mb-2 animate-fade-in animation-delay-300">Lựa chọn vai trò của bạn để tiếp tục</div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3 animate-shake">
              {error}
            </div>
          )}
  <div>
          <div className="flex justify-center gap-3 mb-4 flex-wrap">
            <button
              className={getRoleButtonClass('teacher')}
              onClick={() => handleRoleChange('teacher')}
              type="button"
              disabled={isSubmitting}
            >
              Giáo viên
            </button>
            <button
              className={getRoleButtonClass('manager')}
              onClick={() => handleRoleChange('manager')}
              type="button"
              disabled={isSubmitting}
            >
              Quản lý
            </button>
            
          </div>
            <div className="text-sm text-gray-500 text-center mb-3 animate-fade-in animation-delay-400">Đăng nhập bằng tài khoản <a href="https://lms.mindx.edu.vn/" target="_blank" rel="noreferrer" className="text-[#a1001f] font-medium hover:underline transition-colors">https://lms.mindx.edu.vn/</a></div>
</div>
          <form className="flex flex-col gap-3 animate-fade-in animation-delay-300" onSubmit={handleSubmit} noValidate>
            <div className="relative group">
              <label className="block text-xs font-semibold mb-1 text-gray-700 transition-colors group-focus-within:text-[#800000]">Email / Mã đăng nhập</label>
              <input
                type="text"
                name="username"
                autoComplete="username"
                placeholder="Email hoặc Mã đăng nhập..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 transition-all duration-300 hover:border-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="relative group">
              <label className="block text-xs font-semibold mb-1 text-gray-700 transition-colors group-focus-within:text-[#800000]">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="**********"
                  className="w-full border border-gray-300 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 transition-all duration-300 hover:border-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={handleTogglePassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50"
                  disabled={isSubmitting}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 select-none">
              <input
                type="checkbox"
                checked={rememberAccount}
                onChange={(e) => setRememberAccount(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#800000] focus:ring-[#800000]/30"
                disabled={isSubmitting}
              />
              Lưu tài khoản
            </label>
            <button
              type="submit"
              className="w-full bg-[#800000] text-white rounded py-2 font-semibold text-base mt-2 hover:bg-[#c1122f] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang đăng nhập...
                </span>
              ) : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
