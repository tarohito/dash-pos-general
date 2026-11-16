import React, { useEffect, useId, useRef } from 'react';
import { GoogleIcon } from './GoogleIcon';
import Tooltip from '../Tooltip';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export const MODAL_FOOTER_END_CLASS =
  'flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2';

export const MODAL_BTN_SECONDARY_CLASS =
  'h-9 px-4 text-sm font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 hover:text-zinc-950 rounded-full border border-zinc-200/90 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';

export const MODAL_BTN_PRIMARY_CLASS =
  'h-9 px-4 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-full transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.08)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
  '2xl': 'max-w-3xl',
  '3xl': 'max-w-5xl',
};

// Track stacked open modals so Escape only closes the topmost modal.
const openModalStack: symbol[] = [];

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  disableEscapeClose?: boolean;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  headerActions,
  footer,
  size = 'lg',
  disableEscapeClose = false,
  bodyClassName = 'p-4 sm:p-5 overflow-y-auto flex-1',
  children,
}) => {
  const titleId = useId();
  const modalTokenRef = useRef<symbol | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const token = Symbol('modal');
    modalTokenRef.current = token;
    openModalStack.push(token);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (disableEscapeClose) return;
      if (openModalStack[openModalStack.length - 1] !== token) return;
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      const idx = openModalStack.lastIndexOf(token);
      if (idx >= 0) {
        openModalStack.splice(idx, 1);
      }
      modalTokenRef.current = null;
    };
  }, [isOpen, disableEscapeClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`bg-white rounded-2xl border border-zinc-200 shadow-xl w-full ${SIZE_CLASSES[size]} overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150`}
      >
        {/* Unified Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between gap-3 bg-zinc-50 shrink-0">
          <div className="min-w-0 flex-1">
            <h3
              id={titleId}
              className="text-base font-bold text-zinc-950 leading-tight"
            >
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {headerActions}
            <Tooltip content="Tutup (Esc)" side="left">
              <button
                type="button"
                onClick={onClose}
                disabled={disableEscapeClose}
                aria-label="Tutup modal"
                className="w-8 h-8 aspect-square inline-flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/70 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <GoogleIcon name="close" size={18} />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Modal Body */}
        <div className={bodyClassName}>{children}</div>

        {/* Unified Modal Footer */}
        {footer && (
          <div className="px-4 sm:px-5 py-3.5 bg-zinc-100/70 border-t border-zinc-200 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
