import { buildExportRows, exportToExcel, exportSpecialRulesTemplate } from '../excel';
import type { TemplateDefinition } from '../templates/schema';

export const exportAttendanceAndSummary = (
  attendanceRows: Record<string, unknown>[],
  summaryRows: Record<string, unknown>[],
  templates: { attendance?: TemplateDefinition | null; summary?: TemplateDefinition | null }
) => {
  const attendanceHeaders = templates.attendance?.columns.map((column) => column.headerArabic) ?? [];
  const summaryHeaders = templates.summary?.columns.map((column) => column.headerArabic) ?? [];
  exportToExcel(buildExportRows(attendanceHeaders, attendanceRows), buildExportRows(summaryHeaders, summaryRows), {
    attendanceHeaders,
    summaryHeaders,
  });
};

export { exportSpecialRulesTemplate };
