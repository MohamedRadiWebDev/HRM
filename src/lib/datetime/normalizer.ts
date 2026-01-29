import { formatDate, formatTime, normalizeArabicDigits, parseFlexibleDateTime } from '../utils';

export const normalizeExcelDate = (value: string) => {
  const parsed = parseFlexibleDateTime(value);
  return parsed ? formatDate(parsed) : '';
};

export const normalizeExcelTime = (value: string) => {
  const parsed = parseFlexibleDateTime(value);
  return parsed ? formatTime(parsed) : '';
};

export const normalizeDatetime = (value: string) => {
  const parsed = parseFlexibleDateTime(value);
  return parsed ? { date: formatDate(parsed), time: formatTime(parsed) } : null;
};

export const normalizeDigits = normalizeArabicDigits;
