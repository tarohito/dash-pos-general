import React from 'react';
import { GoogleIcon } from './GoogleIcon';

export interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  ariaLabel?: string;
  className?: string;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  id,
  name,
  ariaLabel,
  className = '',
}) => {
  return (
    <span className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-900 ${
          disabled
            ? checked
              ? 'bg-zinc-400 border-zinc-400 text-white cursor-not-allowed'
              : 'bg-zinc-100 border-zinc-200 text-transparent cursor-not-allowed'
            : checked
            ? 'bg-zinc-900 border-zinc-900 text-white cursor-pointer'
            : 'bg-white border-zinc-300 hover:border-zinc-500 text-transparent cursor-pointer'
        }`}
      >
        <GoogleIcon name="check" size={12} bold className={checked ? 'opacity-100' : 'opacity-0'} />
      </span>
    </span>
  );
};

export default CustomCheckbox;
