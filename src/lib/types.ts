export type Employee = {
  employeeCode: string;
  name: string;
  department?: string;
  section?: string;
  job?: string;
  branch?: string;
  hireDate?: string;
  terminationDate?: string;
  shiftStart?: string;
};

export type Punch = {
  employeeCode: string;
  punchDate: string;
  punchTime: string;
  rawDateTime: string;
};

export type TimeRange = {
  employeeCode: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type Leave = {
  employeeCode: string;
  date: string;
  leaveType: string;
  flags?: Record<string, boolean>;
};

export type SpecialRule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  scopeType: 'employee' | 'department' | 'branch' | 'all';
  scopeValues: string[];
  dateFrom: string;
  dateTo: string;
  daysOfWeek?: number[];
  ruleType:
    | 'CUSTOM_SHIFT'
    | 'ATTENDANCE_EXEMPT'
    | 'PENALTY_OVERRIDE'
    | 'IGNORE_BIOMETRIC'
    | 'OVERTIME_OVERNIGHT';
  params: Record<string, unknown>;
  notes?: string;
};

export type DailyAttendanceRow = {
  employeeCode: string;
  name: string;
  date: string;
  department?: string;
  section?: string;
  job?: string;
  branch?: string;
  shiftStart: string;
  shiftEnd: string;
  firstStamp?: string;
  lastStamp?: string;
  totalWorkingHours?: number;
  lateArrival?: number | '';
  earlyLeave?: number | '';
  missingStamp?: number | '';
  absence?: number | '';
  disciplinary?: number | '';
  dailyDeductionStatus?: string;
  overtimeDay?: number;
  overtimeNight?: number;
  overtimeTotal?: number;
  audit: AuditEntry[];
};

export type SummaryRow = {
  employeeCode: string;
  name: string;
  department?: string;
  section?: string;
  branch?: string;
  totalLate?: number;
  totalEarly?: number;
  totalMissing?: number;
  totalAbsence?: number;
  totalDisciplinary?: number;
  totalOvertimeHours?: number;
  overtimeDays?: number;
  monthlyStatus?: string;
};

export type AuditEntry = {
  title: string;
  detail: string;
  status?: 'ok' | 'warning' | 'needs-mapping';
};

export type ParsedInputs = {
  employees: Employee[];
  punches: Punch[];
  missions: TimeRange[];
  permissions: TimeRange[];
  leaves: Leave[];
  specialRules: SpecialRule[];
};

export type TemplateSchema = {
  attendanceHeaders: string[];
  summaryHeaders: string[];
};

export type ShiftRuleConfig = {
  defaultStart: string;
  defaultDurationHours: number;
  saturdayServiceHours: number;
  saturdayOtherHours: number;
};
