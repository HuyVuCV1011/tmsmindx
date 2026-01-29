"use client";

import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: "red" | "blue" | "green" | "purple" | "orange";
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  color = "red",
  onClick,
}: StatCardProps) {
  const colorClasses = {
    red: "from-[#a1001f] to-[#c41230]",
    blue: "from-blue-600 to-blue-700",
    green: "from-green-600 to-green-700",
    purple: "from-purple-600 to-purple-700",
    orange: "from-orange-600 to-orange-700",
  };

  const bgColorClasses = {
    red: "bg-gradient-to-br from-[#a1001f]/10 to-[#c41230]/5",
    blue: "bg-gradient-to-br from-blue-50 to-blue-100/50",
    green: "bg-gradient-to-br from-green-50 to-green-100/50",
    purple: "bg-gradient-to-br from-purple-50 to-purple-100/50",
    orange: "bg-gradient-to-br from-orange-50 to-orange-100/50",
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 lg:p-5
        shadow-sm hover:shadow-md transition-shadow duration-200
        ${onClick ? "cursor-pointer" : ""}
      `}
      onClick={onClick}
    >
      {/* Background Pattern */}
      <div className={`absolute top-0 right-0 w-24 h-24 ${bgColorClasses[color]} rounded-bl-full opacity-30`}></div>
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs lg:text-sm font-medium text-gray-600 mb-1">
            {title}
          </p>
          <p className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
            {value}
          </p>
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-xs font-semibold ${
                  trend.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend.isPositive ? "↑" : "↓"} {trend.value}
              </span>
            </div>
          )}
        </div>
        
        <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]} shadow-lg`}>
          <Icon className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
        </div>
      </div>
    </div>
  );
}
