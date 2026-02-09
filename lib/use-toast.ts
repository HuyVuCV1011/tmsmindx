"use client";

import toast from 'react-hot-toast';

/**
 * Custom hook để sử dụng toast notification thống nhất trong toàn bộ ứng dụng
 * Sử dụng react-hot-toast với các cấu hình và style đồng bộ
 */

export const useToast = () => {
  return {
    success: (message: string) => toast.success(message, {
      duration: 4000,
      icon: '✅',
    }),
    
    error: (message: string) => toast.error(message, {
      duration: 5000,
      icon: '❌',
    }),
    
    warning: (message: string) => toast(message, {
      duration: 4000,
      icon: '⚠️',
      style: {
        background: '#f59e0b',
        color: '#fff',
      },
    }),
    
    info: (message: string) => toast(message, {
      duration: 4000,
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: '#fff',
      },
    }),
    
    loading: (message: string) => toast.loading(message),
    
    promise: <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string;
        error: string;
      }
    ) => toast.promise(promise, messages),
    
    // Dismiss all toasts
    dismiss: () => toast.dismiss(),
  };
};

// Export các function trực tiếp để dùng mà không cần hook
export const showToast = {
  success: (message: string) => toast.success(message, {
    duration: 4000,
    icon: '✅',
  }),
  
  error: (message: string) => toast.error(message, {
    duration: 5000,
    icon: '❌',
  }),
  
  warning: (message: string) => toast(message, {
    duration: 4000,
    icon: '⚠️',
    style: {
      background: '#f59e0b',
      color: '#fff',
    },
  }),
  
  info: (message: string) => toast(message, {
    duration: 4000,
    icon: 'ℹ️',
    style: {
      background: '#3b82f6',
      color: '#fff',
    },
  }),
};
