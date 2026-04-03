"use client";

import { useAuth } from "@/lib/auth-context";
import { logger } from '@/lib/logger';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, updateUser } = useAuth();
  const [role, setRole] = useState<'teacher' | 'manager'>('teacher');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    // If already logged in, redirect to dashboard - wait for auth to finish loading
    if (!isLoading && !hasCheckedAuth.current) {
      hasCheckedAuth.current = true;
      if (user) {
        const redirectPath = user.role === 'teacher' ? '/user/truyenthong' : '/admin/dashboard';
        logger.info('User already logged in, redirecting based on role', {
          user: user.email,
          role: user.role,
          path: redirectPath
        });
        router.replace(redirectPath);
      }
    }
  }, [user, isLoading, router]);

  // Memoize role change handlers to prevent re-renders
  const handleRoleChange = useCallback((newRole: 'teacher' | 'manager') => {
    setRole(newRole);
    logger.debug('Role changed to', { role: newRole });
  }, []);

  const handleTogglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    // Basic client-side validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập Email hoặc Mã đăng nhập.');
      setIsSubmitting(false);
      return;
    }
    // Strict email check removed to allow username/code login
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      setIsSubmitting(false);
      return;
    }

    logger.info('Đang thực hiện login', { email: trimmedEmail, role });

    try {
      // ─── Step 1: Try app-internal login first ───
      logger.api('POST', '/api/app-auth/login', { email: trimmedEmail });

      const appAuthResponse = await fetch('/api/app-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const appAuthData = await appAuthResponse.json();

      if (appAuthData.appUser === true) {
        // ─── App user login successful ───
        logger.success('App user login successful', { email: appAuthData.email });

        const userData = {
          email: appAuthData.email,
          displayName: appAuthData.displayName,
          role: appAuthData.role,
          localId: appAuthData.localId,
          isAdmin: appAuthData.isAdmin,
          isAppUser: true,
          permissions: appAuthData.permissions || [],
        };

        updateUser(userData, appAuthData.idToken);

        const isAdminRole = appAuthData.isAdmin;
        const redirectPath = isAdminRole ? '/admin/dashboard' : '/user/truyenthong';

        if (appAuthData.role === 'super_admin') {
          toast.success(`Chào mừng Super Admin ${appAuthData.displayName}!`, { icon: '👑' });
        } else if (isAdminRole) {
          toast.success(`Chào mừng Admin ${appAuthData.displayName}!`, { icon: '👑' });
        } else {
          toast.success(`Chào mừng ${appAuthData.displayName}!`, { icon: '👋' });
        }

        logger.info('Redirecting app user to', { path: redirectPath });
        setTimeout(() => { router.replace(redirectPath); }, 500);
        return;
      }

      if (!appAuthResponse.ok && appAuthData.appUser !== false) {
        // App auth returned an actual error (wrong password for existing app user)
        throw new Error(appAuthData.error || 'Đăng nhập thất bại');
      }

      // ─── Step 2: appUser === false → Fallback to Firebase ───
      logger.info('Not an app user, trying Firebase login', { email: trimmedEmail });

      logger.api('POST', '/api/auth/login', { email, role });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password, role }),
      });

      const data = await response.json();
      logger.apiResponse('/api/auth/login', response.status, { email: data.email });

      if (!response.ok) {
        const errorMessage = data.error || 'Đăng nhập thất bại';
        logger.error('Login failed', { status: response.status, error: errorMessage });
        throw new Error(errorMessage);
      }

      // Cập nhật auth context với user và token mới
      const userData: {
        email: string;
        displayName: string;
        role: 'teacher' | 'manager' | 'super_admin' | 'admin';
        localId: string;
        isAdmin?: boolean;
        isAppUser?: boolean;
        permissions?: string[];
      } = {
        email: data.email,
        displayName: data.displayName,
        role: role,
        localId: data.localId,
        isAppUser: false,
      };

      logger.success('Firebase login successful', { email: userData.email, role: userData.role });

      // Store refresh token
      try {
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
      } catch (e) {
        logger.warn('Unable to persist refreshToken', { error: (e as Error).message });
      }

      // Nếu chọn Manager, kiểm tra xem có phải admin không
      let finalRedirectPath = '/user/truyenthong';

      if (role === 'manager') {
        logger.info('Checking admin permission for manager login', { email: userData.email });

        try {
          const adminCheckResponse = await fetch(`/api/check-admin?email=${encodeURIComponent(userData.email)}`);
          const adminData = await adminCheckResponse.json();

          logger.apiResponse('/api/check-admin', adminCheckResponse.status, adminData);

          userData.isAdmin = adminData.isAdmin;
          userData.permissions = adminData.permissions || [];

          if (adminData.isAdmin) {
            finalRedirectPath = '/admin/dashboard';
            logger.success('Admin verified', { email: userData.email });
            toast.success(`Chào mừng Admin ${userData.displayName}!`, { icon: '👑' });
          } else {
            logger.warn('Not an admin, redirecting to user area', { email: userData.email });
            toast.success(`Chào mừng ${userData.displayName}! Bạn không có quyền admin, chuyển đến trang user.`, {
              icon: '👋',
              duration: 4000,
            });
          }
        } catch (adminCheckError) {
          logger.error('Admin check failed, defaulting to user area', { error: adminCheckError });
          toast.error('Không thể kiểm tra quyền admin, chuyển đến trang user', { icon: '⚠️' });
        }
      } else {
        // Teacher role - go to user area
        userData.isAdmin = false;
        toast.success(`Chào mừng ${userData.displayName}!`, { icon: '👋' });
      }

      updateUser(userData, data.idToken);

      logger.info('Redirecting to', { path: finalRedirectPath, isAdmin: userData.isAdmin });

      setTimeout(() => {
        router.replace(finalRedirectPath);
      }, 500);
    } catch (err: any) {
      const errorMessage = err.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(errorMessage);

      logger.error('Login error', { error: err.message, stack: err.stack });

      if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('mật khẩu')) {
        toast.error('Mật khẩu không chính xác!', { icon: '🔒' });
      } else if (errorMessage.toLowerCase().includes('email') || errorMessage.toLowerCase().includes('tài khoản')) {
        toast.error('Tài khoản không tồn tại!', { icon: '❓' });
      } else {
        toast.error(errorMessage, { icon: '❌' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, role, updateUser, router]);

  // Memoize button classes to prevent recalculation
  const getRoleButtonClass = useCallback((buttonRole: 'teacher' | 'manager') => {
    const isActive = role === buttonRole;
    return `px-6 py-2 rounded-full border text-sm font-medium transition-all duration-300 transform hover:scale-105 active:scale-95 ${isActive
        ? 'bg-[#800000] text-white border-[#a1001f] shadow-md'
        : 'bg-white text-[#800000] border-[#a1001f] hover:border-[#c1122f] hover:shadow-sm'
      }`;
  }, [role]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl flex w-[768px] h-[540px] overflow-hidden transform transition-all duration-500 hover:shadow-3xl animate-fade-in-up">
        {/* Left side: Banner */}
        <div className="hidden md:flex flex-col justify-between items-start bg-gradient-to-br from-[#800000] to-[#E31F26] w-1/3 h-full p-8 text-white">
          <div>
            <img src="/logo_white.svg" alt="logo" className="h-20 mb-8 animate-fade-in" />
            <h2 className="text-2xl font-bold mb-4 leading-tight animate-slide-up">Learning<br />Management System(LMS)</h2>
            <p className="text-sm opacity-90 mb-8 animate-slide-up animation-delay-200">Hệ thống quản lý thông tin giáo viên, theo dõi tiến độ đào tạo,xử lý yêu cầu,tra cứu thông tin nội bộ.</p>
          </div>
          <div className="flex items-center gap-2 text-xs opacity-80">
            <span>Teaching Team</span>
          </div>
        </div>

        {/* Right side: Login form */}
        <div className="flex-1 flex flex-col justify-center px-12 py-6 animate-fade-in animation-delay-200">
          <div className="flex flex-col gap-4 mb-2">
            <h2 className="text-xl font-bold text-center text-[#800000] animate-slide-up">MindX Technology School</h2>
            <div className="text-lg font-semibold text-gray-900 text-center mt-2 mb-1 animate-slide-up animation-delay-200">Welcome to Portal</div>
            <div className="text-sm text-gray-500 text-center mb-2 animate-fade-in animation-delay-300">Please select your role and login to continue.</div>
            <div className="text-sm text-gray-500 text-center mb-3 animate-fade-in animation-delay-400">Đăng nhập bằng tài khoản <a href="https://lms.mindx.edu.vn/" target="_blank" rel="noreferrer" className="text-[#a1001f] font-medium hover:underline transition-colors">https://lms.mindx.edu.vn/</a></div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3 animate-shake">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-3 mb-4">
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
              <div className="text-right mt-1">
                <a href="#" className="text-xs text-[#800000] hover:underline transition-all duration-200 hover:text-[#c1122f]">Forgot Password?</a>
              </div>
            </div>
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

          <div className="text-xs text-center text-gray-500 mt-4 animate-fade-in animation-delay-400">
            Having trouble logging in? <a href="#" className="text-[#800000] hover:underline font-medium transition-all duration-200 hover:text-[#c1122f]">Get Help</a>
          </div>
        </div>
      </div>
    </div>
  );
}
