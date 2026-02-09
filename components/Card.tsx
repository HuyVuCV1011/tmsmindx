"use client";

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
