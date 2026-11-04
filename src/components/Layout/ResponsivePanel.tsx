import { useEffect, useRef, type ReactNode } from 'react';

interface ResponsivePanelProps {
  children: ReactNode;
  drawer: boolean;
  open: boolean;
  label: string;
  side?: 'left' | 'right';
  onClose: () => void;
  className?: string;
}

export default function ResponsivePanel({ children, drawer, open, label, side = 'right', onClose, className = '' }: ResponsivePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!drawer || !open) return;
    const previous = document.activeElement;
    const previousRow = previous instanceof HTMLElement ? previous.closest<HTMLElement>('[data-task-row]') : null;
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
      else if (previousRow?.isConnected) previousRow.focus();
    };
  }, [drawer, open]);

  return <>
    {drawer && open && <button type="button" tabIndex={-1} aria-label={`收起${label}`}
      className="dida-panel-backdrop" onClick={onClose} />}
    <div ref={panelRef} tabIndex={drawer ? -1 : undefined}
      role={drawer ? 'dialog' : undefined} aria-modal={drawer && open ? true : undefined}
      aria-label={label} inert={drawer && !open}
      className={`${drawer ? `dida-drawer dida-drawer-${side} ${open ? 'is-open' : ''}` : 'dida-inline-panel'} ${className}`}
      onKeyDown={event => {
        if (!drawer || !open) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (event.key === 'Tab' && panelRef.current?.contains(event.target as Node)) {
          const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'))
            .filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'));
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) {
            event.preventDefault(); first.focus();
          }
        }
      }}>
      {children}
    </div>
  </>;
}
