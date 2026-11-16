import React from 'react';
import Tooltip from '../Tooltip';

export interface StatusToggleProps {
  checked: boolean;
  onChange: (nextChecked: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
  tooltip?: string;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
  label?: string;
  labelClassName?: string;
  ariaLabel?: string;
  stopPropagation?: boolean;
}

export const StatusToggle: React.FC<StatusToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  isLoading = false,
  tooltip,
  tooltipSide = 'top',
  label,
  labelClassName,
  ariaLabel,
  stopPropagation = false,
}) => {
  const isBlocked = disabled || isLoading;
  const resolvedTooltip =
    tooltip !== undefined
      ? tooltip
      : checked
      ? 'Aktif — klik untuk nonaktifkan'
      : 'Nonaktif — klik untuk aktifkan';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    if (isBlocked) return;
    onChange(!checked);
  };

  const control = (
    <span className="inline-flex items-center gap-2 shrink-0">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label || (checked ? 'Aktif' : 'Nonaktif')}
        disabled={isBlocked}
        onClick={handleClick}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
          isBlocked ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'
        } ${checked ? 'bg-emerald-500' : 'bg-zinc-300'}`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      {label && (
        <span
          className={
            labelClassName ??
            `text-xs font-semibold select-none ${
              checked ? 'text-emerald-700' : 'text-zinc-500'
            }`
          }
        >
          {label}
        </span>
      )}
    </span>
  );

  if (!resolvedTooltip) {
    return control;
  }

  return (
    <Tooltip content={resolvedTooltip} side={tooltipSide}>
      {control}
    </Tooltip>
  );
};

export default StatusToggle;
