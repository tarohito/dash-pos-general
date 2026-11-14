import React from 'react';
import { GoogleIcon } from './GoogleIcon';
import Tooltip from '../Tooltip';

export type KpiAccent =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'orange'
  | 'amber'
  | 'emerald'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'rose';

const KPI_ACCENT_STYLES: Record<
  KpiAccent,
  { iconBox: string; cardHover: string }
> = {
  primary: {
    iconBox:
      'bg-primary-soft border-primary-border text-primary group-hover:bg-primary group-hover:text-white group-hover:border-primary',
    cardHover: 'hover:border-primary-border',
  },
  secondary: {
    iconBox:
      'bg-secondary-soft border-secondary-border text-secondary group-hover:bg-secondary group-hover:text-white group-hover:border-secondary',
    cardHover: 'hover:border-secondary-border',
  },
  accent: {
    iconBox:
      'bg-accent-soft border-accent-border text-accent group-hover:bg-accent group-hover:text-white group-hover:border-accent',
    cardHover: 'hover:border-accent-border',
  },
  emerald: {
    iconBox:
      'bg-emerald-50 border-emerald-200 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600',
    cardHover: 'hover:border-emerald-200',
  },
  teal: {
    iconBox:
      'bg-teal-50 border-teal-200 text-teal-600 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600',
    cardHover: 'hover:border-teal-200',
  },
  blue: {
    iconBox:
      'bg-blue-50 border-blue-200 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600',
    cardHover: 'hover:border-blue-200',
  },
  amber: {
    iconBox:
      'bg-amber-50 border-amber-200 text-amber-600 group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-600',
    cardHover: 'hover:border-amber-200',
  },
  orange: {
    iconBox:
      'bg-orange-50 border-orange-200 text-orange-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600',
    cardHover: 'hover:border-orange-200',
  },
  purple: {
    iconBox:
      'bg-violet-50 border-violet-200 text-violet-600 group-hover:bg-violet-600 group-hover:text-white group-hover:border-violet-600',
    cardHover: 'hover:border-violet-200',
  },
  rose: {
    iconBox:
      'bg-rose-50 border-rose-200 text-rose-600 group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600',
    cardHover: 'hover:border-rose-200',
  },
};

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
  accent = 'primary',
  icon,
  value,
  footer,
  tooltip,
  compactMobile = false,
}) => {
  const accentStyle = KPI_ACCENT_STYLES[accent] || KPI_ACCENT_STYLES.primary;

  return (
    <div
      className={`group relative bg-white ${
        compactMobile ? 'p-3.5 sm:p-5' : 'p-4 sm:p-5'
      } rounded-xl border border-zinc-200 ${accentStyle.cardHover} flex flex-col justify-between transition-colors duration-150 min-w-0`}
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
                <GoogleIcon name="info" size={13} />
              </button>
            </Tooltip>
          )}
        </div>
        <span
          className={`${
            compactMobile ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-8 h-8'
          } rounded-lg border ${accentStyle.iconBox} flex items-center justify-center shrink-0 transition-colors duration-150`}
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
