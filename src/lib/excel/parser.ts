import type { TemplateDefinition } from '../templates/schema';
import { parseEmployees, parseLeaves, parsePunches, parseSpecialRules, parseTemplateSchema, parseTimeRanges } from '../excel';
import { loadTemplateFromWorkbook } from '../templates/loader';

export const parseBiometricPunches = parsePunches;
export const parseMasterData = parseEmployees;
export const parseMissions = (data: ArrayBuffer) =>
  parseTimeRanges(data, { employeeCode: 'employee_code', date: 'date', startTime: 'start_time', endTime: 'end_time' });
export const parsePermissions = (data: ArrayBuffer) =>
  parseTimeRanges(data, { employeeCode: 'employee_code', date: 'date', startTime: 'start_time', endTime: 'end_time' });
export const parseLeavesFile = (data: ArrayBuffer) =>
  parseLeaves(data, { employeeCode: 'employee_code', date: 'date', leaveType: 'leave_type' });
export const parseSpecialRulesFile = parseSpecialRules;

export const parseTemplateFile = (data: ArrayBuffer): TemplateDefinition[] => {
  const schema = parseTemplateSchema(data);
  const attendanceTemplate = loadTemplateFromWorkbook(data, 0, 'ATTENDANCE');
  const summaryTemplate = schema.summaryHeaders.length ? loadTemplateFromWorkbook(data, 1, 'SUMMARY') : null;
  return summaryTemplate ? [attendanceTemplate, summaryTemplate] : [attendanceTemplate];
};
