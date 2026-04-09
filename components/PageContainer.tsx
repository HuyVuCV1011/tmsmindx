"use client";

import { PageHeader } from "@/components/PageHeader";

interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  headerActions?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export function PageContainer({
  children,
  title,
  description,
  headerActions,
  maxWidth = "full",
  className = "",
  padding = "md",
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-5xl",
    xl: "max-w-6xl",
    "2xl": "max-w-7xl",
    full: "w-full",
  };

  const paddingClasses = {
    none: "p-4",
    sm: "p-4",
    md: "p-4",
    lg: "p-4",
  };

  return (
    <div className={`${paddingClasses[padding]} ${className}`}>
      {/* Page Header */}
      {(title || description) && (
        <PageHeader title={title || ""} description={description} actions={headerActions} />
      )}

      {/* Page Content */}
      <div className={`w-full ${maxWidthClasses[maxWidth]} mx-auto`}>
        {children}
      </div>
    </div>
  );
}
