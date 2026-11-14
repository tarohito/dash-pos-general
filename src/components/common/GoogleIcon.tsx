import React from 'react';
import type { MaterialSymbol } from 'material-symbols';

export type GoogleIconName = MaterialSymbol;

const SIZE_CLASS_MAP: Record<number, string> = {
  11: '!text-[11px] w-[11px] h-[11px]',
  12: '!text-[12px] w-3 h-3',
  13: '!text-[13px] w-[13px] h-[13px]',
  14: '!text-[14px] w-3.5 h-3.5',
  15: '!text-[15px] w-[15px] h-[15px]',
  16: '!text-[16px] w-4 h-4',
  17: '!text-[17px] w-[17px] h-[17px]',
  18: '!text-[18px] w-[18px] h-[18px]',
  20: '!text-[20px] w-5 h-5',
  22: '!text-[22px] w-[22px] h-[22px]',
  24: '!text-[24px] w-6 h-6',
  28: '!text-[28px] w-7 h-7',
  32: '!text-[32px] w-8 h-8',
  36: '!text-[36px] w-9 h-9',
  48: '!text-[48px] w-12 h-12',
};

export interface GoogleIconProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  name: GoogleIconName;
  size?: number;
  filled?: boolean;
  bold?: boolean;
}

export const GoogleIcon: React.FC<GoogleIconProps> = ({
  name,
  size = 18,
  filled = false,
  bold = false,
  className = '',
  ...rest
}) => {
  const sizeClass = SIZE_CLASS_MAP[size] || SIZE_CLASS_MAP[18];

  return (
    <span
      aria-hidden="true"
      className={`material-symbols-rounded select-none inline-flex items-center justify-center leading-none shrink-0 ${
        filled ? 'icon-filled' : ''
      } ${bold ? 'icon-bold' : ''} ${sizeClass} ${className}`}
      {...rest}
    >
      {name}
    </span>
  );
};
