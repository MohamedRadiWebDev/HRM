import { normalizeEmployeeCode, normalizeName } from './normalizer';

export const buildSearchIndex = (values: Array<string | undefined>) =>
  values
    .filter(Boolean)
    .map((value) => normalizeName(normalizeEmployeeCode(String(value))))
    .join(' ');

export const filterByQuery = <T extends { searchIndex: string }>(rows: T[], query: string) => {
  if (!query.trim()) return rows;
  const normalized = normalizeName(normalizeEmployeeCode(query));
  return rows.filter((row) => row.searchIndex.includes(normalized));
};
