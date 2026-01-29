export enum LeaveType {
  Annual = 'ANNUAL',
  Sick = 'SICK',
  Unpaid = 'UNPAID',
  Other = 'OTHER',
}

export enum RuleType {
  CustomShift = 'CUSTOM_SHIFT',
  AttendanceExempt = 'ATTENDANCE_EXEMPT',
  PenaltyOverride = 'PENALTY_OVERRIDE',
  IgnoreBiometric = 'IGNORE_BIOMETRIC',
  OvertimeOvernight = 'OVERTIME_OVERNIGHT',
}

export enum PenaltyType {
  LateArrival = 'LATE_ARRIVAL',
  EarlyLeave = 'EARLY_LEAVE',
  MissingStamp = 'MISSING_STAMP',
  Absence = 'ABSENCE',
  Disciplinary = 'DISCIPLINARY',
}

export enum DayOfWeek {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

export type RawBiometricPunch = {
  employee_code: string;
  punch_datetime: string;
};

export type MasterEmployee = {
  code: string;
  name_ar: string;
  department?: string;
  section?: string;
  job?: string;
  branch?: string;
  hire_date?: string;
  termination_date?: string;
  shift_start?: string;
};

export type AdjustmentRecord = {
  employee_code: string;
  date: string;
  start_time: string;
  end_time: string;
  type: 'MISSION' | 'PERMISSION' | 'LEAVE';
  leave_type?: LeaveType;
};

export type DailyAttendanceRow = {
  employee_code: string;
  name_ar: string;
  date: string;
  check_in?: string;
  check_out?: string;
  first_stamp?: string;
  last_stamp?: string;
  total_hours?: number;
  penalties?: Record<PenaltyType, number | ''>;
  overtime?: {
    early?: number;
    late?: number;
    day?: number;
    night?: number;
    total?: number;
  };
};

export type SpecialRule = {
  id: string;
  name: string;
  priority: number;
  scope: 'employee' | 'department' | 'branch' | 'all';
  scope_values: string[];
  date_from: string;
  date_to: string;
  days_of_week?: DayOfWeek[];
  rule_type: RuleType;
  params: Record<string, unknown>;
};

export type ExcelTemplateColumn = {
  excelColumn: string;
  headerArabic: string;
  headerEnglish?: string;
  dataType: 'text' | 'number' | 'date' | 'time' | 'datetime';
  format?: string;
  required?: boolean;
};

export type ExcelTemplateSchema = {
  id: string;
  name: string;
  description?: string;
  columns: ExcelTemplateColumn[];
  type: 'ATTENDANCE' | 'SUMMARY';
};

export type AuditTraceEntry = {
  title: string;
  detail: string;
  status?: 'ok' | 'warning' | 'needs-mapping';
};
