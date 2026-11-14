import React from 'react';
import { GoogleIcon } from './GoogleIcon';

export type SortDirection = 'asc' | 'desc';

interface SortableThProps {
  label: string;
  sortKey: string;
  currentSortBy: string;
  currentSortDir: SortDirection;
  onSort: (sortKey: string) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const SortableTh: React.FC<SortableThProps> = ({
  label,
  sortKey,
  currentSortBy,
  currentSortDir,
  onSort,
  align = 'left',
  className = '',
}) => {
  const isActive = currentSortBy === sortKey;

  const justifyClass =
    align === 'right'
      ? 'justify-end'
      : align === 'center'
      ? 'justify-center'
      : 'justify-start';

  return (
    <th className={className} aria-sort={isActive ? (currentSortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group w-full inline-flex items-center gap-1.5 ${justifyClass} uppercase font-semibold tracking-wider text-xs cursor-pointer transition-colors select-none ${
          isActive ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-800'
        }`}
        title={`Urutkan berdasarkan ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          currentSortDir === 'asc' ? (
            <GoogleIcon name="arrow_upward" size={13} className="text-zinc-950 shrink-0" />
          ) : (
            <GoogleIcon name="arrow_downward" size={13} className="text-zinc-950 shrink-0" />
          )
        ) : (
          <GoogleIcon name="swap_vert" size={13} className="text-zinc-300 group-hover:text-zinc-500 shrink-0 transition-colors" />
        )}
      </button>
    </th>
  );
};

export function getNextColumnSort(
  clickedKey: string,
  currentSortBy: string,
  currentSortDir: SortDirection,
  defaultDir: SortDirection = 'desc'
): { sortBy: string; sortDir: SortDirection } {
  if (currentSortBy === clickedKey) {
    return {
      sortBy: clickedKey,
      sortDir: currentSortDir === 'asc' ? 'desc' : 'asc',
    };
  }
  return {
    sortBy: clickedKey,
    sortDir: defaultDir,
  };
}
