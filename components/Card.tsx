"use client";

/**
 * @deprecated This component is deprecated. Please use `components/ui/card.tsx` instead.
 * 
 * Migration guide:
 * ```tsx
 * // Old (this component)
 * import { Card } from '@/components/Card'
 * <Card title="Title" hover padding="lg">
 *   Content
 * </Card>
 * 
 * // New (recommended - composition pattern)
 * import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
 * <Card padding="lg">
 *   <CardHeader>
 *     <CardTitle>Title</CardTitle>
 *   </CardHeader>
 *   <CardContent>Content</CardContent>
 * </Card>
 * 
 * // Or use backward compatible API
 * import { Card } from '@/components/ui/card'
 * <Card title="Title" hover padding="lg">
 *   Content
 * </Card>
 * ```
 */

import { useEffect } from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
}

export function Card({
  children,
  title,
  className = "",
  hover = false,
  padding = "md",
}: CardProps) {
  // Log deprecation warning in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[DEPRECATED] components/Card.tsx is deprecated. Please migrate to components/ui/card.tsx. See JSDoc for migration guide.'
      )
    }
  }, [])
  const paddingClasses = {
    sm: "p-3 lg:p-4",
    md: "p-4 lg:p-6",
    lg: "p-6 lg:p-8",
  };

  return (
    <div
      className={`
        bg-white rounded-lg border border-gray-200 shadow-sm
        ${hover ? "hover:shadow-md hover:border-gray-300" : ""}
        transition-shadow duration-200
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {title && (
        <h3 className="text-lg lg:text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
