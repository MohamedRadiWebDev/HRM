import type { AuditEntry, Employee, SpecialRule } from './types';
import { addAudit } from './utils';

export type RuleContext = {
  date: string;
  dayOfWeek: number;
  employee: Employee;
};

export type RuleApplication = {
  shiftStart?: string;
  shiftEnd?: string;
  suppressPenalties?: boolean;
  ignoreBiometric?: boolean;
  penaltyOverrides?: Record<string, number | ''>;
  overtimeOvernight?: {
    allowLinking: boolean;
    maxOvernightHours: number;
  };
  appliedRules: SpecialRule[];
};

const matchesScope = (rule: SpecialRule, employee: Employee) => {
  if (rule.scopeType === 'all') return true;
  const scopeValues = rule.scopeValues.map((value) => value.trim());
  if (rule.scopeType === 'employee') return scopeValues.includes(employee.employeeCode);
  if (rule.scopeType === 'department') return employee.department && scopeValues.includes(employee.department);
  if (rule.scopeType === 'branch') return employee.branch && scopeValues.includes(employee.branch);
  return false;
};

const matchesDate = (rule: SpecialRule, date: string, dayOfWeek: number) => {
  if (rule.dateFrom && date < rule.dateFrom) return false;
  if (rule.dateTo && date > rule.dateTo) return false;
  if (rule.daysOfWeek && !rule.daysOfWeek.includes(dayOfWeek)) return false;
  return true;
};

export const applySpecialRules = (
  rules: SpecialRule[],
  context: RuleContext,
  audit: AuditEntry[]
): RuleApplication => {
  const applicable = rules
    .filter((rule) => rule.enabled)
    .filter((rule) => matchesScope(rule, context.employee))
    .filter((rule) => matchesDate(rule, context.date, context.dayOfWeek))
    .sort((a, b) => b.priority - a.priority);

  const result: RuleApplication = {
    appliedRules: [],
  };

  for (const rule of applicable) {
    result.appliedRules.push(rule);
    switch (rule.ruleType) {
      case 'CUSTOM_SHIFT': {
        const shiftStart = rule.params.shiftStart as string | undefined;
        const shiftEnd = rule.params.shiftEnd as string | undefined;
        const duration = rule.params.durationHours as number | undefined;
        if (shiftStart) result.shiftStart = shiftStart;
        if (shiftEnd) result.shiftEnd = shiftEnd;
        if (duration && shiftStart) {
          const date = new Date(`1970-01-01T${shiftStart}`);
          date.setHours(date.getHours() + duration);
          result.shiftEnd = date.toTimeString().slice(0, 8);
        }
        break;
      }
      case 'ATTENDANCE_EXEMPT': {
        result.suppressPenalties = true;
        break;
      }
      case 'PENALTY_OVERRIDE': {
        result.penaltyOverrides = {
          ...result.penaltyOverrides,
          ...(rule.params.overrides as Record<string, number | ''>),
        };
        break;
      }
      case 'IGNORE_BIOMETRIC': {
        result.ignoreBiometric = true;
        break;
      }
      case 'OVERTIME_OVERNIGHT': {
        result.overtimeOvernight = {
          allowLinking: true,
          maxOvernightHours: Number(rule.params.maxOvernightHours ?? 12),
        };
        break;
      }
      default:
        break;
    }
  }

  if (!result.appliedRules.length) {
    addAudit(audit, 'حالات خاصة', 'لا توجد قواعد مطبقة', 'warning');
  }

  return result;
};
