import type { AuditEntry } from './types';

const arabicDigitsMap: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

export const normalizeArabicDigits = (value: string) =>
  value.replace(/[٠-٩]/g, (digit) => arabicDigitsMap[digit] ?? digit);

const tashkeelRegex = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export const normalizeArabicName = (value: string) =>
  normalizeArabicDigits(value)
    .replace(tashkeelRegex, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();

export const normalizeEmployeeCode = (value: string) =>
  normalizeArabicDigits(value).trim();

export const formatDate = (date: Date) =>
  date.toISOString().slice(0, 10);

export const formatTime = (date: Date) =>
  date.toTimeString().slice(0, 8);

export const parseFlexibleDateTime = (value: string): Date | null => {
  if (!value) return null;
  const normalized = normalizeArabicDigits(value.trim());
  const excelDate = Number(normalized);
  if (!Number.isNaN(excelDate) && excelDate > 20000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + excelDate * 86400000);
  }
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  const parts = normalized.split(/\s+/);
  if (parts.length >= 2) {
    const [datePart, timePart, meridiem] = parts;
    const [day, month, year] = datePart.split(/[/-]/).map(Number);
    if (day && month && year) {
      const [hoursRaw, minutesRaw = '0'] = timePart.split(':');
      let hours = Number(hoursRaw);
      const minutes = Number(minutesRaw);
      if (meridiem?.toLowerCase().includes('pm') && hours < 12) {
        hours += 12;
      }
      if (meridiem?.toLowerCase().includes('am') && hours === 12) {
        hours = 0;
      }
      const dt = new Date(year, month - 1, day, hours, minutes, 0);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }
  return null;
};

export const diffMinutes = (start: string, end: string) => {
  const startDate = new Date(`1970-01-01T${start}`);
  const endDate = new Date(`1970-01-01T${end}`);
  return (endDate.getTime() - startDate.getTime()) / 60000;
};

export const addHours = (time: string, hours: number) => {
  const date = new Date(`1970-01-01T${time}`);
  date.setHours(date.getHours() + hours);
  return formatTime(date);
};

export const addAudit = (audit: AuditEntry[], title: string, detail: string, status: AuditEntry['status'] = 'ok') => {
  audit.push({ title, detail, status });
};

export const buildSearchIndex = (values: Array<string | undefined>) => {
  const normalized = values
    .filter(Boolean)
    .map((value) => normalizeArabicName(normalizeEmployeeCode(String(value))));
  return normalized.join(' ');
};

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

