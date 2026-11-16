import React from 'react';

interface NewBadgeProps {
  className?: string;
}

export const NewBadge: React.FC<NewBadgeProps> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide bg-amber-500 text-white shadow-2xs shrink-0 ${className}`.trim()}
  >
    BARU
  </span>
);

export default NewBadge;
