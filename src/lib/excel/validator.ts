import type { Employee, Punch, TimeRange } from '../types';

export type ImportValidationResult = {
  errors: string[];
  warnings: string[];
};

const validateOverlap = (ranges: TimeRange[], label: string, result: ImportValidationResult) => {
  const grouped = new Map<string, TimeRange[]>();
  ranges.forEach((range) => {
    const key = `${range.employeeCode}-${range.date}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(range);
  });
  grouped.forEach((values, key) => {
    const sorted = values.sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].startTime < sorted[i - 1].endTime) {
        result.warnings.push(`تداخل في ${label}: ${key}`);
      }
    }
  });
};

export const validateImports = (
  employees: Employee[],
  punches: Punch[],
  missions: TimeRange[],
  permissions: TimeRange[]
): ImportValidationResult => {
  const result: ImportValidationResult = { errors: [], warnings: [] };
  const employeeCodes = new Set(employees.map((employee) => employee.employeeCode));
  const punchKeys = new Set<string>();

  punches.forEach((punch) => {
    if (!employeeCodes.has(punch.employeeCode)) {
      result.errors.push(`موظف غير معروف في البصمات: ${punch.employeeCode}`);
    }
    const key = `${punch.employeeCode}-${punch.punchDate}-${punch.punchTime}`;
    if (punchKeys.has(key)) result.warnings.push(`بصمة مكررة: ${key}`);
    punchKeys.add(key);
  });

  validateOverlap(missions, 'المأموريات', result);
  validateOverlap(permissions, 'الأذونات', result);
  return result;
};
