"use client";

import { useAuth } from "@/lib/auth-context";
import { logger } from '@/lib/logger';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
        const redirectPath = user.role === 'teacher' ? '/user/thongtingv' : '/admin/dashboard';
        logger.info('User already logged in, redirecting based on role', { 
          user: user.email, 
          role: user.role,
          path: redirectPath
        });
        router.replace(redirectPath);
      }
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    logger.info('Đang thực hiện login', { email, role });

    try {
      logger.api('POST', '/api/auth/login', { email, role });
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role }),
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
        role: 'teacher' | 'manager';
        localId: string;
        isAdmin?: boolean;
      } = {
        email: data.email,
        displayName: data.displayName,
        role: role,
        localId: data.localId,
      };
      
      logger.success('Login successful', { email: userData.email, role: userData.role });
      
      // Nếu chọn Manager, kiểm tra xem có phải admin không
      let finalRedirectPath = '/user/thongtingv'; // Default là user area
      
      if (role === 'manager') {
        logger.info('Checking admin permission for manager login', { email: userData.email });
        
        try {
          // Gọi API check admin
          const adminCheckResponse = await fetch(`/api/check-admin?email=${encodeURIComponent(userData.email)}`);
          const adminData = await adminCheckResponse.json();
          
          logger.apiResponse('/api/check-admin', adminCheckResponse.status, adminData);
          
          // Lưu admin status vào user data
          userData.isAdmin = adminData.isAdmin;
          
          if (adminData.isAdmin) {
            finalRedirectPath = '/admin/dashboard';
            logger.success('Admin verified', { email: userData.email });
            toast.success(`Chào mừng Admin ${userData.displayName}!`, {
              icon: '👑',
            });
          } else {
            logger.warn('Not an admin, redirecting to user area', { email: userData.email });
            toast.success(`Chào mừng ${userData.displayName}! Bạn không có quyền admin, chuyển đến trang user.`, {
              icon: '👋',
              duration: 4000,
            });
          }
        } catch (adminCheckError) {
          logger.error('Admin check failed, defaulting to user area', { error: adminCheckError });
          toast.error('Không thể kiểm tra quyền admin, chuyển đến trang user', {
            icon: '⚠️',
          });
        }
      } else {
        // Teacher role - go to user area
        userData.isAdmin = false;
        toast.success(`Chào mừng ${userData.displayName}!`, {
          icon: '👋',
        });
      }
      
      // Lưu user data với isAdmin flag vào localStorage
      updateUser(userData, data.idToken);
      
      logger.info('Redirecting to', { path: finalRedirectPath, isAdmin: userData.isAdmin });
      
      setTimeout(() => {
        router.replace(finalRedirectPath);
      }, 500); // Delay nhẹ để hiển toast
    } catch (err: any) {
      const errorMessage = err.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(errorMessage);
      
      logger.error('Login error', { error: err.message, stack: err.stack });
      
      // Hiển thị toast thông báo lỗi
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
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="bg-white rounded-xl shadow-2xl flex w-[768px] h-[540px] overflow-hidden transform transition-all duration-300 hover:shadow-3xl">
        {/* Left side: Banner */}
        <div className="hidden md:flex flex-col justify-between items-start bg-gradient-to-br from-[#a1001f] to-[#c1122f] w-1/2 h-full p-8 text-white">
          <div>
            <img src="/logo_white.svg" alt="logo" className="h-20 mb-8 animate-fade-in" />
            <h2 className="text-2xl font-bold mb-4 leading-tight animate-slide-up">Nuturing Global<br />Pioneer in tech</h2>
            <p className="text-sm opacity-90 mb-8 animate-slide-up animation-delay-200">Access your dashboard to manage classes, track student performance, and coordinate with the Teaching Management System.</p>
          </div>
          <div className="flex items-center gap-2 text-xs opacity-80">
            <span>MindX Teaching Team</span>
          </div>
        </div>

        {/* Right side: Login form */}
        <div className="flex-1 flex flex-col justify-center px-8 py-6">
          <div className="flex flex-col gap-2 mb-2">
            <h2 className="text-xl font-bold text-center text-[#a1001f]">MindX Technology School</h2>
            <div className="text-lg font-semibold text-gray-900 text-center mt-2 mb-1">Welcome to Portal</div>
            <div className="text-sm text-gray-500 text-center mb-2">Please select your role and login to continue.</div>
            <div className="text-sm text-gray-500 text-center mb-3">đăng nhập bằng tài khoản<a href="https://lms.mindx.edu.vn/" target="_blank" rel="noreferrer" className="text-[#a1001f] font-medium hover:underline">https://lms.mindx.edu.vn/</a></div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3 animate-shake">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-3 mb-4">
            <button
              className={`px-4 py-1 rounded-full border text-sm font-medium transition-all transform hover:scale-105 ${
                role === 'teacher' 
                  ? 'bg-[#a1001f] text-white border-[#a1001f] shadow-md' 
                  : 'bg-white text-[#a1001f] border-[#a1001f] hover:border-[#c1122f]'
              }`}
              onClick={() => {
                setRole('teacher');
                logger.debug('Role changed to teacher');
              }}
              type="button"
              disabled={isSubmitting}
            >
              Teacher
            </button>
            <button
              className={`px-4 py-1 rounded-full border text-sm font-medium transition-all transform hover:scale-105 ${
                role === 'manager' 
                  ? 'bg-[#a1001f] text-white border-[#a1001f] shadow-md' 
                  : 'bg-white text-[#a1001f] border-[#a1001f] hover:border-[#c1122f]'
              }`}
              onClick={() => {
                setRole('manager');
                logger.debug('Role changed to manager');
              }}
              type="button"
              disabled={isSubmitting}
            >
              Manager
            </button>
          </div>

          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="relative">
              <label className="block text-xs font-semibold mb-1 text-gray-700">Username or Email</label>
              <input
                type="email"
                placeholder="...@mindx.edu.vn"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="relative">
              <label className="block text-xs font-semibold mb-1 text-gray-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="w-full border border-gray-300 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="text-right mt-1">
                <a href="#" className="text-xs text-[#a1001f] hover:underline transition-colors">Forgot Password?</a>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-[#a1001f] text-white rounded py-2 font-semibold text-base mt-2 hover:bg-[#c1122f] transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang đăng nhập...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="text-xs text-center text-gray-500 mt-4">
            Having trouble logging in? <a href="#" className="text-[#a1001f] hover:underline font-medium transition-colors">Get Help</a>
          </div>
        </div>
      </div>
    </div>
  );
}
