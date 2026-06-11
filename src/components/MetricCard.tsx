import React from 'react';
import { type LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  description?: string;
  colorClass?: string; // Tailwind color classes for the icon container
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  description,
  colorClass = 'bg-blue-50 text-blue-600',
}) => {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col justify-between transition-all hover:border-neutral-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">{title}</p>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl font-bold text-neutral-900 tracking-tight">
              {value}
            </span>
            {unit && (
              <span className="ml-1 text-sm font-semibold text-neutral-500">
                {unit}
              </span>
            )}
          </div>
        </div>
        <div className={`p-3 rounded-lg ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {description && (
        <div className="mt-4 pt-4 border-t border-neutral-100">
          <p className="text-xs text-neutral-500 font-medium">{description}</p>
        </div>
      )}
    </div>
  );
};