import React from 'react';
import { Info } from 'lucide-react';
import Tooltip from '../Tooltip';

export type KpiAccent =
  | 'orange'
  | 'amber'
  | 'emerald'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'rose';

interface KpiCardProps {
  title: string;
  accent?: KpiAccent;
  icon: React.ReactNode;
  value: React.ReactNode;
  footer?: React.ReactNode;
  tooltip?: string;
  compactMobile?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  icon,
  value,
  footer,
  tooltip,
  compactMobile = false,
}) => {
  return (
    <div
      className={`group relative bg-white ${
        compactMobile ? 'p-3.5 sm:p-5' : 'p-4 sm:p-5'
      } rounded-xl border border-zinc-200 hover:border-zinc-300 flex flex-col justify-between transition-colors duration-150 min-w-0`}
    >
      {/* Header Row */}
      <div
        className={`flex items-center justify-between ${
          compactMobile ? 'gap-1.5 sm:gap-3' : 'gap-3'
        }`}
      >
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs sm:text-sm text-zinc-500 font-medium truncate">
            {title}
          </span>
          {tooltip && (
            <Tooltip content={tooltip} side="top">
              <button
                type="button"
                className="text-zinc-400 hover:text-zinc-700 cursor-help inline-flex items-center p-0.5 rounded transition-colors shrink-0"
                aria-label={`Info ${title}`}
              >
                <Info size={13} />
              </button>
            </Tooltip>
          )}
        </div>
        <span
          className={`${
            compactMobile ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-8 h-8'
          } rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white group-hover:border-zinc-900 flex items-center justify-center shrink-0 transition-colors duration-150`}
        >
          {icon}
        </span>
      </div>

      {/* Value & Footer */}
      <div className={`${compactMobile ? 'mt-2.5 sm:mt-3' : 'mt-3'} min-w-0`}>
        {value}
        {footer}
      </div>
    </div>
  );
};
