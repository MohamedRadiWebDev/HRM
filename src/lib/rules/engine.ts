import type { AuditEntry, Employee, SpecialRule } from '../types';
import { applySpecialRules } from '../rules';

export const evaluateRules = (rules: SpecialRule[], employee: Employee, date: string, audit: AuditEntry[]) => {
  const dayOfWeek = new Date(date).getDay();
  return applySpecialRules(rules, { date, dayOfWeek, employee }, audit);
};
