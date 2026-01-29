import { normalizeArabicDigits, normalizeArabicName } from '../utils';

export const normalizeEmployeeCode = (value: string) => normalizeArabicDigits(value).trim();

export const normalizeName = (value: string) => normalizeArabicName(value);
