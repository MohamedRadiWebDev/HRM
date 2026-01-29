import type { Employee, Leave, Punch, SpecialRule, TimeRange } from '../lib/types';

export const mockEmployees: Employee[] = [
  {
    employeeCode: '1001',
    name: 'أحمد علي',
    department: 'الموارد البشرية',
    section: 'الحضور',
    job: 'موظف',
    branch: 'القاهرة',
    hireDate: '2024-01-01',
  },
  {
    employeeCode: '1002',
    name: 'مريم حسن',
    department: 'الخدمات',
    section: 'الدعم',
    job: 'خدمات معاونة',
    branch: 'الجيزة',
    hireDate: '2024-02-01',
    shiftStart: '08:30:00',
  },
];

export const mockPunches: Punch[] = [
  {
    employeeCode: '1001',
    punchDate: '2025-03-01',
    punchTime: '09:12:00',
    rawDateTime: '2025-03-01 09:12:00',
  },
  {
    employeeCode: '1001',
    punchDate: '2025-03-01',
    punchTime: '17:05:00',
    rawDateTime: '2025-03-01 17:05:00',
  },
  {
    employeeCode: '1002',
    punchDate: '2025-03-01',
    punchTime: '08:20:00',
    rawDateTime: '2025-03-01 08:20:00',
  },
  {
    employeeCode: '1002',
    punchDate: '2025-03-01',
    punchTime: '16:15:00',
    rawDateTime: '2025-03-01 16:15:00',
  },
];

export const mockMissions: TimeRange[] = [
  {
    employeeCode: '1001',
    date: '2025-03-02',
    startTime: '10:00:00',
    endTime: '12:00:00',
  },
];

export const mockPermissions: TimeRange[] = [
  {
    employeeCode: '1002',
    date: '2025-03-02',
    startTime: '15:00:00',
    endTime: '16:00:00',
  },
];

export const mockLeaves: Leave[] = [
  {
    employeeCode: '1001',
    date: '2025-03-03',
    leaveType: 'اجازة سنوية',
  },
];

export const mockRules: SpecialRule[] = [
  {
    id: 'R-001',
    name: 'دوام رمضان',
    enabled: true,
    priority: 10,
    scopeType: 'department',
    scopeValues: ['الموارد البشرية'],
    dateFrom: '2025-03-01',
    dateTo: '2025-03-30',
    ruleType: 'CUSTOM_SHIFT',
    params: { shiftStart: '09:30:00', durationHours: 6 },
    notes: 'تعديل ساعات العمل في رمضان',
  },
];
