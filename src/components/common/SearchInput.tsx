import React from 'react';
import { GoogleIcon } from './GoogleIcon';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  className?: string;
  ariaLabel?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Cari...',
  onKeyDown,
  className = '',
  ariaLabel,
}) => {
  return (
    <div className={`relative flex-1 min-w-0 w-full ${className}`}>
      <GoogleIcon name="search" size={15}
       
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        className={`w-full h-9 pl-9 ${
          value ? 'pr-8' : 'pr-3'
        } text-xs sm:text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition-colors leading-normal`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
          aria-label="Hapus kata kunci"
        >
          <GoogleIcon name="close" size={14} />
        </button>
      )}
    </div>
  );
};
