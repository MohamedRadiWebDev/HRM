import * as XLSX from 'xlsx';
import type {
  Employee,
  Leave,
  ParsedInputs,
  Punch,
  SpecialRule,
  TemplateSchema,
  TimeRange,
} from './types';
import { formatDate, formatTime, normalizeEmployeeCode, parseFlexibleDateTime } from './utils';

export const parsePunches = (data: ArrayBuffer) => {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  const punches: Punch[] = [];
  const invalidRows: string[] = [];

  rows.forEach((row, index) => {
    const employeeCode = normalizeEmployeeCode(String(row.employee_code || row.employeeCode || row['كود الموظف'] || ''));
    const rawDateTime = String(row.punch_datetime || row.punchDateTime || row['تاريخ البصمة'] || '');
    const dateTime = parseFlexibleDateTime(rawDateTime);
    if (!employeeCode || !dateTime) {
      invalidRows.push(`صف ${index + 2}`);
      return;
    }
    punches.push({
      employeeCode,
      punchDate: formatDate(dateTime),
      punchTime: formatTime(dateTime),
      rawDateTime,
    });
  });

  return { punches, invalidRows };
};

export const parseEmployees = (data: ArrayBuffer) => {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  const employees: Employee[] = rows.map((row) => ({
    employeeCode: normalizeEmployeeCode(String(row.employee_code || row.employeeCode || row['كود الموظف'] || '')),
    name: String(row.name || row['اسم الموظف'] || ''),
    department: String(row.department || row['الاداره'] || ''),
    section: String(row.section || row['القسم'] || ''),
    job: String(row.job || row['الوظيفه'] || ''),
    branch: String(row.branch || row['الفرع'] || ''),
    hireDate: String(row.hire_date || row['تاريخ التعيين'] || ''),
    terminationDate: String(row.termination_date || row['تاريخ انتهاء الخدمه'] || ''),
    shiftStart: String(row.shift_start || row['بداية الدوام'] || ''),
  }));

  return employees.filter((employee) => employee.employeeCode);
};

export const parseTimeRanges = (data: ArrayBuffer, mapping: Record<string, string>) => {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  const ranges: TimeRange[] = [];
  rows.forEach((row) => {
    const employeeCode = normalizeEmployeeCode(String(row[mapping.employeeCode] || ''));
    const date = String(row[mapping.date] || '');
    const startTime = String(row[mapping.startTime] || '');
    const endTime = String(row[mapping.endTime] || '');
    if (!employeeCode || !date || !startTime || !endTime) return;
    ranges.push({ employeeCode, date, startTime, endTime });
  });
  return ranges;
};

export const parseLeaves = (data: ArrayBuffer, mapping: Record<string, string>) => {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  const leaves: Leave[] = [];
  rows.forEach((row) => {
    const employeeCode = normalizeEmployeeCode(String(row[mapping.employeeCode] || ''));
    const date = String(row[mapping.date] || '');
    const leaveType = String(row[mapping.leaveType] || '');
    if (!employeeCode || !date || !leaveType) return;
    leaves.push({ employeeCode, date, leaveType });
  });
  return leaves;
};

export const parseSpecialRules = (data: ArrayBuffer) => {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets['rules'] ?? workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  const rules: SpecialRule[] = [];
  const invalidRows: string[] = [];
  rows.forEach((row, index) => {
    try {
      const paramsRaw = String(row.params_json || row.params || '{}');
      const params = paramsRaw ? JSON.parse(paramsRaw) : {};
      const scopeValues = String(row.scopeValues || row.scope_values || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const daysOfWeek = String(row.daysOfWeek || row.days_of_week || '')
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => !Number.isNaN(value));
      const rule: SpecialRule = {
        id: String(row.id || ''),
        name: String(row.name || ''),
        enabled: String(row.enabled || 'true').toLowerCase() !== 'false',
        priority: Number(row.priority || 0),
        scopeType: (String(row.scopeType || row.scope_type || 'all') as SpecialRule['scopeType']) || 'all',
        scopeValues,
        dateFrom: String(row.dateFrom || row.date_from || ''),
        dateTo: String(row.dateTo || row.date_to || ''),
        daysOfWeek: daysOfWeek.length ? daysOfWeek : undefined,
        ruleType: String(row.ruleType || row.rule_type || '') as SpecialRule['ruleType'],
        params,
        notes: String(row.notes || ''),
      };
      if (!rule.ruleType) throw new Error('Missing rule type');
      rules.push(rule);
    } catch (error) {
      invalidRows.push(`صف ${index + 2}`);
    }
  });

  return { rules, invalidRows };
};

export const parseTemplateSchema = (data: ArrayBuffer): TemplateSchema => {
  const workbook = XLSX.read(data, { type: 'array' });
  const attendanceSheet = workbook.Sheets[workbook.SheetNames[0]];
  const summarySheet = workbook.Sheets[workbook.SheetNames[1] ?? ''];
  const attendanceHeaderRow = XLSX.utils.sheet_to_json<string[]>(attendanceSheet, { header: 1 })[0] ?? [];
  const summaryHeaderRow = summarySheet
    ? XLSX.utils.sheet_to_json<string[]>(summarySheet, { header: 1 })[0] ?? []
    : [];
  return { attendanceHeaders: attendanceHeaderRow, summaryHeaders: summaryHeaderRow };
};

export const exportToExcel = (
  attendanceRows: Record<string, unknown>[],
  summaryRows: Record<string, unknown>[],
  template: TemplateSchema
) => {
  const workbook = XLSX.utils.book_new();
  const attendanceSheet = XLSX.utils.json_to_sheet(attendanceRows, { header: template.attendanceHeaders });
  XLSX.utils.book_append_sheet(workbook, attendanceSheet, 'Attendance');
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, { header: template.summaryHeaders });
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  XLSX.writeFile(workbook, 'attendance_export.xlsx');
};

export const exportSpecialRulesTemplate = () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      'id',
      'name',
      'enabled',
      'priority',
      'scopeType',
      'scopeValues',
      'dateFrom',
      'dateTo',
      'daysOfWeek',
      'ruleType',
      'params_json',
      'notes',
    ],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'rules');
  XLSX.writeFile(workbook, 'special_rules.xlsx');
};

export const buildExportRows = (headers: string[], rows: Record<string, unknown>[]) => {
  if (!headers.length) return rows;
  return rows.map((row) => {
    const result: Record<string, unknown> = {};
    for (const header of headers) {
      result[header] = row[header] ?? '';
    }
    return result;
  });
};

export const emptyInputs = (): ParsedInputs => ({
  employees: [],
  punches: [],
  missions: [],
  permissions: [],
  leaves: [],
  specialRules: [],
});
