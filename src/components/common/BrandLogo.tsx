import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  inverted?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
  inverted = false,
}) => {
  const textClass =
    size === 'sm'
      ? 'text-base'
      : size === 'lg'
      ? 'text-xl'
      : 'text-lg sm:text-[19px]';

  return (
    <span className={`inline-flex items-center select-none ${className}`}>
      <span
        className={`${textClass} font-bold tracking-tight leading-none whitespace-nowrap ${
          inverted ? 'text-white' : 'text-zinc-950'
        }`}
      >
        Logic<span className={`font-semibold ${inverted ? 'text-indigo-200' : 'text-zinc-500'}`}>POS</span>
      </span>
    </span>
  );
};
