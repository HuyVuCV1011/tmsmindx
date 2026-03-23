"use client";

interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export function PageContainer({
  children,
  title,
  description,
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
    none: "",
    sm: "p-0 sm:p-0 lg:p-1",
    md: "p-0 sm:p-1 lg:p-1",
    lg: "p-1 sm:p-1 lg:p-2",
  };

  return (
    <div className={`${paddingClasses[padding]} ${className}`}>
      {/* Page Header */}
      {(title || description) && (
        <div className="mb-6">
          {title && (
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-sm lg:text-base text-gray-600">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Page Content */}
      <div className={`w-full ${maxWidthClasses[maxWidth]} mx-auto`}>
        {children}
      </div>
    </div>
  );
}
