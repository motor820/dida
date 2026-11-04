import { Calendar, CalendarDays, Sun, Sunrise } from 'lucide-react';
import Tooltip from './Tooltip';

const shortcuts = [
  { label: '今天', icon: Sun, days: 0 },
  { label: '明天', icon: Sunrise, days: 1 },
  { label: '下周', icon: CalendarDays, days: 7 },
  { label: '自定义', icon: Calendar, days: undefined },
];

/** Shared by task context menus and every date picker entry point. */
export default function DateShortcuts({ onSelect }: { onSelect: (days: number | undefined) => void }) {
  return <div role="group" aria-label="日期快捷选项" className="flex items-center justify-between px-1 py-1">
    {shortcuts.map(option => <Tooltip key={option.label} label={option.label}>
      <button type="button" aria-label={option.label} onClick={() => onSelect(option.days)}
        className="p-1.5 hover:bg-[var(--dida-bg-hover)] rounded-md text-[var(--dida-text-secondary)]">
        <option.icon className="w-4 h-4" />
      </button>
    </Tooltip>)}
  </div>;
}
