'use client'

import { ReactNode, useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  maxWidth?:
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | '3xl'
    | '4xl'
    | '5xl'
    | '6xl'
    | '7xl'
  footer?: ReactNode
  headerColor?: string
  overflowContent?: 'auto' | 'visible'
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = '2xl',
  footer,
  headerColor = 'bg-[#a1001f]',
  overflowContent = 'auto',
}: ModalProps) {
  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
  }

  const headerClassName =
    headerColor.includes('from-') || headerColor.includes('to-')
      ? `bg-linear-to-r ${headerColor}`
      : headerColor

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto p-2 pt-16 sm:items-center sm:p-4"
      style={{ zIndex: 1000 }}
    >
      {/* Backdrop with minimal opacity */}
      <div
        className="fixed inset-0 bg-opacity-60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`relative my-0.5 flex h-[calc(100dvh-64px)] w-full flex-col border border-gray-200 bg-white shadow-2xl sm:my-4 sm:h-auto sm:max-h-[95dvh] sm:rounded-xl ${maxWidthClasses[maxWidth]} animate-modal-in ${overflowContent === 'visible' ? 'overflow-visible' : 'overflow-hidden'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`sticky top-0 ${headerClassName} px-4 sm:px-6 py-4 z-10 sm:rounded-t-xl shrink-0`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs sm:text-sm text-white text-opacity-90 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 text-white hover:text-gray-200 transition-colors p-1"
              aria-label="Close modal"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          className={`px-4 sm:px-6 py-4 sm:py-6 ${overflowContent === 'visible' ? 'overflow-visible' : 'flex-1 overflow-y-auto'}`}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-in {
          animation: modal-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
