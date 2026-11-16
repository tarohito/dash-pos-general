import React from 'react';

interface NewBadgeProps {
  className?: string;
}

export const NewBadge: React.FC<NewBadgeProps> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] leading-none font-bold uppercase tracking-wider bg-blue-600 text-white border border-blue-700/20 shadow-xs shrink-0 select-none ${className}`.trim()}
  >
    BARU
  </span>
);

export default NewBadge;
