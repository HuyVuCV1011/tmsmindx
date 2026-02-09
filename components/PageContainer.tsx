"use client";

interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
}

export function PageContainer({
  children,
  title,
  description,
  maxWidth = "full",
  className = "",
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-5xl",
    xl: "max-w-6xl",
    "2xl": "max-w-7xl",
    full: "max-w-full",
  };

  return (
    <div className={`w-full ${className}`}>
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
