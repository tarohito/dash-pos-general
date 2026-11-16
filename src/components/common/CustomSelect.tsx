import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GoogleIcon } from './GoogleIcon';

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (CustomSelectOption | string)[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  id?: string;
  name?: string;
  size?: 'sm' | 'md';
  columns?: 1 | 2;
  ariaLabel?: string;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  ready: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi...',
  className = '',
  disabled = false,
  icon,
  id,
  name,
  size = 'md',
  columns = 1,
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<MenuPosition>({
    top: -9999,
    left: -9999,
    width: 180,
    maxHeight: 240,
    ready: false,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Normalize options to CustomSelectOption[]
  const normalizedOptions: CustomSelectOption[] = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  const computePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    const menuEl = menuRef.current;
    if (!triggerEl || !menuEl) return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const VIEWPORT_MARGIN = 8;
    const GAP = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width =
      columns === 2
        ? Math.max(triggerRect.width, Math.min(400, vw - VIEWPORT_MARGIN * 2))
        : Math.max(triggerRect.width, size === 'sm' ? 116 : 160);
    const naturalHeight = Math.min(menuEl.scrollHeight || 200, columns === 2 ? 280 : 240);

    const spaceBelow = vh - triggerRect.bottom - VIEWPORT_MARGIN - GAP;
    const spaceAbove = triggerRect.top - VIEWPORT_MARGIN - GAP;

    let top: number;
    let maxHeight = 240;

    if (spaceBelow >= naturalHeight || spaceBelow >= spaceAbove) {
      maxHeight = Math.max(120, Math.min(240, spaceBelow));
      top = triggerRect.bottom + GAP;
    } else {
      maxHeight = Math.max(120, Math.min(240, spaceAbove));
      const renderedHeight = Math.min(naturalHeight, maxHeight);
      top = Math.max(VIEWPORT_MARGIN, triggerRect.top - renderedHeight - GAP);
    }

    let left = triggerRect.left;
    if (left + width > vw - VIEWPORT_MARGIN) {
      left = Math.max(VIEWPORT_MARGIN, triggerRect.right - width);
    }
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - width - VIEWPORT_MARGIN));

    setPos({
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(width),
      maxHeight: Math.floor(maxHeight),
      ready: true,
    });
  }, [size, columns]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    computePosition();
  }, [isOpen, normalizedOptions.length, computePosition]);

  useEffect(() => {
    if (!isOpen) {
      setPos(prev => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleReposition = () => {
      computePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, computePosition]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const triggerSizeClass =
    size === 'sm'
      ? 'h-8 px-2.5 text-xs border-zinc-200 hover:border-zinc-300 rounded-lg'
      : 'h-10 px-3.5 text-sm border-zinc-200 hover:border-zinc-300 rounded-xl';

  return (
    <div ref={containerRef} className="relative w-full text-left" id={id}>
      {/* Hidden input for form submission if name is provided */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setIsOpen(prev => !prev);
        }}
        className={`w-full bg-white border flex items-center justify-between transition-colors cursor-pointer focus:outline-none focus-visible:border-primary ${triggerSizeClass} ${
          disabled ? 'opacity-50 cursor-not-allowed bg-zinc-100' : ''
        } ${isOpen ? '!border-primary bg-primary-soft/30 ring-1 ring-primary/20' : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {icon && <span className="text-zinc-400 shrink-0">{icon}</span>}
          {selectedOption ? (
            <span className="font-semibold text-zinc-900 truncate">
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-zinc-400 truncate">{placeholder}</span>
          )}
        </div>

        <GoogleIcon name="keyboard_arrow_down" size={size === 'sm' ? 14 : 16}
         
          className={`text-zinc-400 transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? 'rotate-180 text-zinc-900' : ''
          }`}
        />
      </button>

      {/* Portal Floating Dropdown Menu */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              zIndex: 2147483647,
              opacity: pos.ready ? 1 : 0,
            }}
            className={`bg-white shadow-lg border border-zinc-200 rounded-xl p-1.5 overflow-y-auto transition-opacity duration-75 ${
              columns === 2 ? 'grid grid-cols-2 gap-1' : 'space-y-0.5'
            }`}
          >
            {normalizedOptions.map(opt => {
              const isSelected = opt.value === value;

              return (
                <button
                  type="button"
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full rounded-lg text-left flex items-center justify-between gap-2 transition-colors cursor-pointer text-sm ${
                    size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-2'
                  } ${
                    isSelected
                      ? 'bg-primary-soft text-primary-text font-semibold'
                      : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 font-medium'
                  }`}
                >
                  <div className="flex flex-col truncate pr-1">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-zinc-400 font-normal mt-0.5 truncate">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <GoogleIcon name="check" size={14} className="text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};

export default CustomSelect;
