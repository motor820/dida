import type { RepeatRule } from '../types/task.ts';

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekday';
interface CivilDate { year: number; month: number; day: number; hour: number; minute: number; second: number }
const formatters = new Map<string, Intl.DateTimeFormat>();
export function localTimeZone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
export function civilDate(seconds: number, zone: string): CivilDate {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
    formatters.set(zone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(seconds * 1000)).map(part => [part.type, Number(part.value)]));
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second };
}
const asUTC = (date: CivilDate) => Date.UTC(date.year, date.month - 1, date.day, date.hour, date.minute, date.second);
export function civilTimestamp(date: CivilDate, zone: string): number {
  const target = asUTC(date);
  let guess = target;
  const guesses = [guess];
  for (let attempt = 0; attempt < 4; attempt++) {
    const next = target - (asUTC(civilDate(guess / 1000, zone)) - guess);
    if (next === guess) return guess / 1000;
    if (guesses.includes(next)) return Math.max(guess, next) / 1000; // A spring DST gap moves forward.
    guesses.push(next); guess = next;
  }
  return guess / 1000;
}
const serial = (date: CivilDate) => Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86400000);
const weekday = (day: number) => new Date(day * 86400000).getUTCDay();
const fromSerial = (day: number, time: CivilDate): CivilDate => {
  const date = new Date(day * 86400000);
  return { ...time, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
};
const monthLength = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
export function shiftOccurrenceDate(due: number, oldParentDue: number, newParentDue: number, zone: string): number {
  const original = civilDate(due, zone);
  const dayShift = serial(civilDate(newParentDue, zone)) - serial(civilDate(oldParentDue, zone));
  return civilTimestamp(fromSerial(serial(original) + dayShift, original), zone);
}
export function normalizeRepeat(rule: RepeatRule, due: number): RepeatRule {
  // Persist quarters using the existing monthly cadence for compatibility across clients.
  if (rule.type === 'quarterly') return normalizeRepeat({ ...rule, type: 'monthly' as RepeatRule['type'], interval: 3 }, due);
  const zone = rule.timezone || localTimeZone();
  const date = civilDate(due, zone);
  const timeOfDay = rule.timeOfDay ?? [date.hour, date.minute, date.second].map(value => String(value).padStart(2, '0')).join(':');
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(timeOfDay)) throw new Error('重复时间无效');
  const type = rule.type as string;
  if (!['none', 'daily', 'weekly', 'monthly', 'yearly', 'weekday', 'custom'].includes(type)) throw new Error('不支持的重复规则，请重新设置');
  const frequency = type === 'custom' ? rule.frequency : type;
  if (type === 'custom' && !['daily', 'weekly', 'monthly', 'yearly'].includes(frequency || '')) throw new Error('请重新设置旧自定义规则的重复频率');
  const interval = rule.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 999) throw new Error('重复间隔应为 1 至 999 的整数');
  const days = rule.daysOfWeek ?? [weekday(serial(date))];
  if (days.some(day => !Number.isInteger(day) || day < 0 || day > 6) || (frequency === 'weekly' && !days.length)) throw new Error('每周重复至少选择一个星期');
  const day = rule.dayOfMonth ?? date.day, month = rule.monthOfYear ?? date.month;
  if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error('重复日期无效');
  return { ...rule, interval, timezone: zone, timeOfDay, daysOfWeek: [...new Set(days)].sort(), dayOfMonth: day, monthOfYear: month };
}

/** Next scheduled occurrence after both the original due date and completion; no overdue backlog. */
export function nextOccurrence(due: number, input: RepeatRule, completedAt: number): { due: number; rule: RepeatRule } | null {
  const rule = normalizeRepeat(input, due);
  if (rule.type === 'none') return null;
  const frequency = (rule.type === 'custom' ? rule.frequency : rule.type) as Frequency;
  const zone = rule.timezone!;
  const anchor = civilDate(due, zone);
  [anchor.hour, anchor.minute, anchor.second] = rule.timeOfDay!.split(':').map(Number);
  const threshold = Math.max(due, completedAt), now = civilDate(threshold, zone);
  const originalDay = serial(anchor), currentDay = serial(now), interval = rule.interval!;
  let next: number | undefined;
  if (frequency === 'daily') {
    let index = Math.max(1, Math.floor((currentDay - originalDay) / interval));
    do { next = civilTimestamp(fromSerial(originalDay + index++ * interval, anchor), zone); } while (next <= threshold);
  } else if (frequency === 'weekday') {
    let day = Math.max(originalDay + 1, currentDay);
    while (next === undefined) {
      if (weekday(day) !== 0 && weekday(day) !== 6) {
        const candidate = civilTimestamp(fromSerial(day, anchor), zone);
        if (candidate > threshold) next = candidate;
      }
      day++;
    }
  } else if (frequency === 'weekly') {
    const monday = originalDay - (weekday(originalDay) + 6) % 7;
    let cycle = Math.floor(Math.max(0, currentDay - monday) / (7 * interval));
    const offsets = rule.daysOfWeek!.map(day => (day + 6) % 7).sort((a, b) => a - b);
    while (next === undefined) {
      for (const offset of offsets) {
        const candidate = civilTimestamp(fromSerial(monday + cycle * 7 * interval + offset, anchor), zone);
        if (candidate > threshold) { next = candidate; break; }
      }
      cycle++;
    }
  } else if (frequency === 'monthly') {
    const month = anchor.year * 12 + anchor.month - 1;
    let index = Math.max(1, Math.floor(((now.year - anchor.year) * 12 + now.month - anchor.month) / interval));
    do {
      const target = month + index++ * interval, year = Math.floor(target / 12), targetMonth = target % 12 + 1;
      next = civilTimestamp({ ...anchor, year, month: targetMonth, day: Math.min(rule.dayOfMonth!, monthLength(year, targetMonth)) }, zone);
    } while (next <= threshold);
  } else {
    let index = Math.max(1, Math.floor((now.year - anchor.year) / interval));
    do {
      const year = anchor.year + index++ * interval, month = rule.monthOfYear!;
      next = civilTimestamp({ ...anchor, year, month, day: Math.min(rule.dayOfMonth!, monthLength(year, month)) }, zone);
    } while (next <= threshold);
  }
  if (rule.endDate != null && next > rule.endDate) return null;
  return { due: next, rule };
}

export function repeatLabel(rule: RepeatRule | null | undefined, due?: number): string {
  if (!rule || rule.type === 'none') return '不重复';
  if (rule.type === 'custom' && !rule.frequency) return '请重新设置自定义重复';
  const date = due ? new Date(due * 1000) : new Date();
  const type = rule.type === 'custom' ? rule.frequency : rule.type;
  const interval = rule.interval || 1;
  const days = (rule.daysOfWeek || [date.getDay()]).map(day => '日一二三四五六'[day]).join('、');
  const quarterly = type === 'quarterly' || (type === 'monthly' && interval === 3);
  const suffix = type === 'weekly' ? `（${days}）` : type === 'monthly' || type === 'quarterly' ? `（${rule.dayOfMonth || date.getDate()}日）` : type === 'yearly' ? `（${rule.monthOfYear || date.getMonth() + 1}月${rule.dayOfMonth || date.getDate()}日）` : '';
  if (type === 'weekday') return '周一至周五';
  if (quarterly) return `每季度${suffix}`;
  const unit = { daily: '天', weekly: '周', monthly: '月', yearly: '年' }[type || 'daily'];
  return `${interval > 1 ? `每隔${interval}` : '每'}${unit}${suffix}`;
}
