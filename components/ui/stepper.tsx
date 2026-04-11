import React from 'react';
import { Check, X } from 'lucide-react';

export interface StepItem {
  id: string | number;
  label: string;
  description?: string;
  status: 'completed' | 'current' | 'upcoming' | 'error' | 'success';
}

export function Stepper({ steps, compact = false }: { steps: StepItem[], compact?: boolean }) {
  const circleSize = compact ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  const titleSize = compact ? 'text-xs' : 'text-sm';
  const descSize = compact ? 'text-[10px]' : 'text-xs';
  
  return (
    <div className="w-full">
      <div className="flex">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isCompleted = step.status === 'completed';
          const isSuccess = step.status === 'success';
          const isCurrent = step.status === 'current';
          const isError = step.status === 'error';
          
          return (
            <div key={step.id} className={`flex flex-col ${isLast ? 'items-center' : 'flex-1'}`}>
              <div className="flex items-center w-full">
                <div
                  className={`flex-shrink-0 ${circleSize} rounded-full flex items-center justify-center font-semibold ${titleSize} transition-all duration-300 shadow-md
                    ${(isCompleted && !isError && !isSuccess) ? 'bg-[#1152D4] text-white shadow-[#1152D4]/30' : ''}
                    ${isSuccess ? 'bg-green-500 text-white shadow-green-500/30' : ''}
                    ${isCurrent ? 'bg-[#1152D4] text-white ring-4 ring-[#1152D4]/20' : ''}
                    ${isError ? 'bg-red-500 text-white shadow-red-500/30' : ''}
                    ${(!isCompleted && !isCurrent && !isError && !isSuccess) ? 'bg-slate-100 text-slate-400 border-2 border-slate-200' : ''}
                  `}
                >
                  {((isCompleted || isSuccess) && !isError) ? (
                    <Check className={iconSize} />
                  ) : isError ? (
                    <X className={iconSize} />
                  ) : (
                    index + 1
                  )}
                </div>
                {!isLast && (
                  <div className={`flex-1 h-0.5 mx-1.5 rounded-full transition-all duration-500 ${(isCompleted || isError || isSuccess) ? 'bg-[#1152D4]' : 'bg-slate-200'}`}></div>
                )}
              </div>
              <div className={`${compact ? 'mt-1.5' : 'mt-3'} ${isLast ? 'text-center w-20 -ml-5' : 'text-left pr-2'}`}>
                <p className={`${titleSize} font-semibold whitespace-nowrap transition-colors ${
                  (isCompleted || isSuccess) && !isError ? 'text-slate-900' :
                  isCurrent ? 'text-[#1152D4]' :
                  isError ? 'text-red-500' : 'text-slate-400'
                }`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className={`${descSize} mt-0.5 whitespace-pre-line ${
                    isCurrent ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
