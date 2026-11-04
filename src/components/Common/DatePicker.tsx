import { useEffect, useRef, useState } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isToday, addMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Bell, RefreshCw, X, Circle } from 'lucide-react';
import type { RepeatRule } from '../../types/task';
import { RepeatType } from '../../types/task';
import { REMINDER_OPTIONS } from '../../constants/reminders';
import { normalizeRepeat, repeatLabel, localTimeZone } from '../../utils/recurrence';
import DateShortcuts from './DateShortcuts';

interface DatePickerProps {
  selectedDate?: number;
  reminder?: string;
  repeat_rule?: RepeatRule | null;
  onSelect: (timestamp: number | undefined, reminder?: string, repeat_rule?: RepeatRule | null) => void;
  onCancel?: () => void;
}
const repeatTypes = [RepeatType.None, RepeatType.Daily, RepeatType.Weekly, RepeatType.Monthly, RepeatType.Quarterly, RepeatType.Yearly, RepeatType.Weekday, RepeatType.Custom];
const dateOnly = (timestamp?: number) => timestamp ? new Date(timestamp * 1000) : new Date();
const timeOnly = (timestamp?: number) => timestamp && format(new Date(timestamp * 1000), 'HH:mm') !== '00:00' ? format(new Date(timestamp * 1000), 'HH:mm') : '';

export default function DatePicker({ selectedDate, reminder: initialReminder, repeat_rule: initialRepeat, onSelect, onCancel }: DatePickerProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(() => dateOnly(selectedDate));
  const [month, setMonth] = useState(() => dateOnly(selectedDate));
  const [time, setTime] = useState(() => timeOnly(selectedDate));
  const [reminder, setReminder] = useState(initialReminder || 'none');
  const [repeat, setRepeat] = useState<RepeatRule | null>(initialRepeat || null);
  const [expanded, setExpanded] = useState<'time' | 'reminder' | 'repeat' | null>(null);
  const [custom, setCustom] = useState(false);
  const [frequency, setFrequency] = useState<NonNullable<RepeatRule['frequency']>>(initialRepeat?.frequency || 'daily');
  const [interval, setIntervalValue] = useState(initialRepeat?.interval || 1);
  const [weekdays, setWeekdays] = useState<number[]>(initialRepeat?.daysOfWeek || [dateOnly(selectedDate).getDay()]);
  const [error, setError] = useState('');

  useEffect(() => {
    setDate(dateOnly(selectedDate)); setMonth(dateOnly(selectedDate)); setTime(timeOnly(selectedDate));
    setReminder(initialReminder || 'none'); setRepeat(initialRepeat || null);
    setFrequency(initialRepeat?.frequency || 'daily'); setIntervalValue(initialRepeat?.interval || 1);
    setWeekdays(initialRepeat?.daysOfWeek || [dateOnly(selectedDate).getDay()]); setError('');
  }, [selectedDate, initialReminder, initialRepeat]);

  const timestamp = () => {
    const result = new Date(date);
    const [hours, minutes] = (time || '00:00').split(':').map(Number);
    result.setHours(hours, minutes, 0, 0);
    return Math.floor(result.getTime() / 1000);
  };
  const selectDay = (next: Date) => {
    setDate(next); setError('');
    if (repeat) setRepeat({ ...repeat, dayOfMonth: next.getDate(), monthOfYear: next.getMonth() + 1,
      daysOfWeek: repeat.type === RepeatType.Custom && repeat.frequency === 'weekly' ? repeat.daysOfWeek : [next.getDay()] });
  };
  const toggle = (section: typeof expanded) => { setCustom(false); setExpanded(expanded === section ? null : section); setError(''); };
  const preset = (type: RepeatType) => {
    if (type === RepeatType.Custom) {
      const currentFrequency = repeat?.type === RepeatType.Custom ? repeat.frequency : repeat?.type;
      setFrequency(currentFrequency && ['daily', 'weekly', 'monthly', 'yearly'].includes(currentFrequency) ? currentFrequency as typeof frequency : 'daily');
      setIntervalValue(repeat?.interval || 1); setWeekdays(repeat?.daysOfWeek || [date.getDay()]);
      setCustom(true); setExpanded(null); setError(''); return;
    }
    setRepeat(type === RepeatType.None ? null : { type: type === RepeatType.Quarterly ? RepeatType.Monthly : type, interval: type === RepeatType.Quarterly ? 3 : 1, daysOfWeek: [date.getDay()], dayOfMonth: date.getDate(), monthOfYear: date.getMonth() + 1, timezone: localTimeZone() });
    setExpanded(null); setError('');
  };
  const applyCustom = () => {
    try {
      const rule = normalizeRepeat({ type: RepeatType.Custom, frequency, interval, daysOfWeek: frequency === 'weekly' ? weekdays : [date.getDay()],
        dayOfMonth: date.getDate(), monthOfYear: date.getMonth() + 1, timezone: localTimeZone() }, timestamp());
      setRepeat(rule); setCustom(false); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const confirm = () => {
    try {
      const due = timestamp();
      if (!Number.isFinite(due)) throw new Error('请选择有效日期和时间');
      onSelect(due, reminder, repeat ? normalizeRepeat({ ...repeat, timeOfDay: `${time || '00:00'}:00`, timezone: localTimeZone() }, due) : null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) });
  const rowClass = 'w-full flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-gray-600 hover:bg-gray-50 rounded-lg';
  return <div role="dialog" aria-label="日期设置" className="date-picker-container w-[280px] max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-y-auto bg-white rounded-xl border border-gray-100 shadow-xl p-2"
    onKeyDown={event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (custom) setCustom(false); else if (expanded) setExpanded(null); else onCancel?.();
      }
    }}>
    <div className="rounded-lg bg-gray-50 p-1 text-center text-xs text-gray-600 mb-2">日期</div>
    <DateShortcuts onSelect={days => {
      if (days === undefined) {
        setMonth(date); setExpanded(null); setCustom(false); setError('');
        requestAnimationFrame(() => {
          const selected = calendarRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
          selected?.focus(); selected?.scrollIntoView({ block: 'nearest' });
        });
      } else {
        const next = new Date(); next.setDate(next.getDate() + days); selectDay(next); setMonth(next);
      }
    }} />
    <div className="flex items-center justify-between px-2 py-2 text-[13px]">
      <span className="font-medium">{format(month, 'yyyy年M月')}</span>
      <div className="flex items-center gap-1 text-gray-500">
        <button type="button" aria-label="上个月" className="p-1" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="w-3.5 h-3.5" /></button>
        <button type="button" aria-label="回到今天" className="p-1" onClick={() => setMonth(new Date())}><Circle className="w-2 h-2" /></button>
        <button type="button" aria-label="下一个月" className="p-1" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    </div>
    <div className="grid grid-cols-7 text-center text-xs text-gray-400 pb-1">{'日一二三四五六'.split('').map(day => <span key={day}>{day}</span>)}</div>
    <div ref={calendarRef} role="group" aria-label="选择日期" className="grid grid-cols-7 gap-y-1 pb-3">
      {days.map(day => <button type="button" key={day.toISOString()} data-date={format(day, 'yyyy-MM-dd')} aria-pressed={isSameDay(day, date)} onClick={() => selectDay(day)}
        className={`h-8 w-8 mx-auto rounded-full text-xs ${isSameDay(day, date) ? 'bg-[var(--dida-primary)] text-white' : day.getMonth() !== month.getMonth() ? 'text-gray-300' : isToday(day) ? 'text-[var(--dida-primary)] bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}>
        {day.getDate()}
      </button>)}
    </div>
    <button type="button" className={rowClass} aria-expanded={expanded === 'time'} onClick={() => toggle('time')}><span className="flex items-center gap-3"><Clock className="w-4 h-4 text-gray-400" />时间</span><span>{time || '未设置'}</span></button>
    {expanded === 'time' && <div className="flex items-center justify-between px-3 py-2 gap-2"><input aria-label="具体时间" type="time" value={time} onChange={event => setTime(event.target.value)} className="min-w-0 border border-gray-200 rounded px-2 py-1 text-sm" /><button type="button" aria-label="清除时间" onClick={() => setTime('')}><X className="w-4 h-4 text-gray-400" /></button></div>}
    <button type="button" className={rowClass} aria-expanded={expanded === 'reminder'} onClick={() => toggle('reminder')}><span className="flex items-center gap-3"><Bell className="w-4 h-4 text-gray-400" />提醒</span><span>{REMINDER_OPTIONS.find(option => option.value === reminder)?.label || '不提醒'}</span></button>
    {expanded === 'reminder' && <div className="rounded-lg border border-gray-100 py-1">{REMINDER_OPTIONS.map(option => <button type="button" key={option.value} className={`${rowClass} ${reminder === option.value ? 'text-blue-500' : ''}`} onClick={() => {
      setReminder(option.value); if (option.value !== 'none' && !time) setTime('21:00'); setExpanded(null);
    }}>{option.label}</button>)}</div>}
    <button type="button" className={rowClass} aria-expanded={expanded === 'repeat' || custom} onClick={() => toggle('repeat')}><span className="flex items-center gap-3"><RefreshCw className="w-4 h-4 text-gray-400" />重复</span><span className="text-right">{repeatLabel(repeat, timestamp())}</span></button>
    {expanded === 'repeat' && <div className="rounded-lg border border-gray-100 bg-white shadow-sm py-1">
      {repeatTypes.map(type => <button type="button" key={type} className={rowClass} onClick={() => preset(type)}>{type === RepeatType.Custom ? '自定义重复' : repeatLabel(type === RepeatType.None ? null : { type, daysOfWeek: [date.getDay()], dayOfMonth: date.getDate(), monthOfYear: date.getMonth() + 1 }, timestamp())}</button>)}
    </div>}
    {custom && <div className="rounded-lg border border-gray-100 p-3 space-y-3 text-[13px]">
      <label className="flex justify-between items-center gap-2">重复频率<select aria-label="重复频率" className="border rounded p-1" value={frequency} onChange={event => setFrequency(event.target.value as typeof frequency)}><option value="daily">按天</option><option value="weekly">按周</option><option value="monthly">按月</option><option value="yearly">按年</option></select></label>
      <label className="flex justify-between items-center gap-2">间隔<input aria-label="重复间隔" type="number" min={1} max={999} value={interval} onChange={event => setIntervalValue(Number(event.target.value))} className="w-20 border rounded p-1" /></label>
      {frequency === 'weekly' && <div><div className="mb-2 text-gray-500">每周重复日期</div><div className="flex justify-between">{'日一二三四五六'.split('').map((day, index) => <button type="button" aria-label={`星期${day}`} aria-pressed={weekdays.includes(index)} key={index} className={`w-7 h-7 rounded-full ${weekdays.includes(index) ? 'bg-blue-500 text-white' : 'bg-gray-50'}`} onClick={() => setWeekdays(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])}>{day}</button>)}</div></div>}
      <div className="flex justify-end gap-3"><button type="button" onClick={() => { setCustom(false); setError(''); }}>取消重复修改</button><button type="button" className="text-blue-500" onClick={applyCustom}>应用重复规则</button></div>
    </div>}
    {error && <p role="alert" className="text-xs text-red-500 px-2 py-1">{error}</p>}
    <div className="flex items-center justify-between gap-2 pt-3 px-1 border-t border-gray-50 mt-2">
      <button type="button" className="px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 rounded" onClick={() => onSelect(undefined, 'none', null)}>清除</button>
      <button type="button" className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded" onClick={onCancel}>取消</button>
      <button type="button" disabled={custom} className="flex-1 bg-[var(--dida-primary)] disabled:opacity-40 text-white rounded py-1.5 text-xs" onClick={confirm}>确定</button>
    </div>
  </div>;
}
