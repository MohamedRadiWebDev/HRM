import * as XLSX from 'xlsx';
import type { TemplateDefinition } from './schema';

const inferColumn = (header: string, index: number): TemplateDefinition['columns'][number] => ({
  excelColumn: XLSX.utils.encode_col(index),
  headerArabic: header,
  dataType: 'text',
});

export const loadTemplateFromWorkbook = (data: ArrayBuffer, sheetIndex = 0, type: TemplateDefinition['type']) => {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[sheetIndex];
  const sheet = workbook.Sheets[sheetName];
  const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? [];
  const columns = headerRow.map((header, index) => inferColumn(String(header), index));
  const template: TemplateDefinition = {
    id: `${type.toLowerCase()}-${Date.now()}`,
    name_ar: sheetName,
    columns,
    type,
  };
  return template;
};
