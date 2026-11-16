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
  { iconColor: string; cardHover: string }
> = {
  primary: {
    iconColor: 'text-primary',
    cardHover: 'hover:border-primary-border',
  },
  secondary: {
    iconColor: 'text-secondary',
    cardHover: 'hover:border-secondary-border',
  },
  accent: {
    iconColor: 'text-accent',
    cardHover: 'hover:border-accent-border',
  },
  emerald: {
    iconColor: 'text-emerald-600',
    cardHover: 'hover:border-emerald-200',
  },
  teal: {
    iconColor: 'text-teal-600',
    cardHover: 'hover:border-teal-200',
  },
  blue: {
    iconColor: 'text-blue-600',
    cardHover: 'hover:border-blue-200',
  },
  amber: {
    iconColor: 'text-amber-600',
    cardHover: 'hover:border-amber-200',
  },
  orange: {
    iconColor: 'text-orange-600',
    cardHover: 'hover:border-orange-200',
  },
  purple: {
    iconColor: 'text-violet-600',
    cardHover: 'hover:border-violet-200',
  },
  rose: {
    iconColor: 'text-rose-600',
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

  const renderedIcon = React.isValidElement(icon)
    ? React.cloneElement(
        icon as React.ReactElement<{ size?: number | string; strokeWidth?: number; className?: string }>,
        {
          size: compactMobile ? 24 : 26,
          strokeWidth: 1.85,
          className: `${(icon as React.ReactElement<{ className?: string }>).props?.className ?? ''} ${
            compactMobile ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-6 h-6 sm:w-7 sm:h-7'
          }`.trim(),
        }
      )
    : icon;

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
          className={`${accentStyle.iconColor} inline-flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105`}
        >
          {renderedIcon}
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
