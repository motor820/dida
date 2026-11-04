import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ label, children, placement = 'bottom' }: { label: string; children: ReactNode; placement?: 'bottom' | 'right' }) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  return <span className="inline-flex" onMouseEnter={event => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition(placement === 'right' ? { left: rect.right + 8, top: rect.top + rect.height / 2 } : { left: Math.max(40, Math.min(innerWidth - 40, rect.left + rect.width / 2)), top: rect.bottom + 34 < innerHeight ? rect.bottom + 6 : rect.top - 30 });
  }} onMouseLeave={() => setPosition(null)} onFocus={event => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition(placement === 'right' ? { left: rect.right + 8, top: rect.top + rect.height / 2 } : { left: Math.max(40, Math.min(innerWidth - 40, rect.left + rect.width / 2)), top: rect.bottom + 34 < innerHeight ? rect.bottom + 6 : rect.top - 30 });
  }} onBlur={() => setPosition(null)}>
    {children}
    {position && createPortal(<span role="tooltip" className={`pointer-events-none fixed z-[11000] rounded bg-gray-800 px-2 py-1 text-xs text-white ${placement === 'right' ? '-translate-y-1/2 max-w-[calc(100vw-84px)] whitespace-normal break-words' : '-translate-x-1/2 whitespace-nowrap'}`} style={position}>{label}</span>, document.body)}
  </span>;
}
