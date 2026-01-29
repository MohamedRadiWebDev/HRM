import { describe, expect, it } from 'vitest';
import { computeDailyAttendance } from './attendance';
import type { Employee, Punch, SpecialRule } from './types';

const employee: Employee = {
  employeeCode: '1001',
  name: 'Test User',
};

const buildPunch = (time: string): Punch => ({
  employeeCode: '1001',
  punchDate: '2025-03-01',
  punchTime: time,
  rawDateTime: `2025-03-01 ${time}`,
});

describe('attendance penalties', () => {
  it('applies lateness tiers', () => {
    const rows = computeDailyAttendance(
      [employee],
      [buildPunch('09:20:00'), buildPunch('17:00:00')],
      [],
      [],
      [],
      []
    );
    expect(rows[0].lateArrival).toBe(0.25);
  });

  it('suppresses penalties when attendance exempt', () => {
    const rules: SpecialRule[] = [
      {
        id: 'R1',
        name: 'Exempt',
        enabled: true,
        priority: 1,
        scopeType: 'all',
        scopeValues: [],
        dateFrom: '2025-03-01',
        dateTo: '2025-03-01',
        ruleType: 'ATTENDANCE_EXEMPT',
        params: {},
      },
    ];
    const rows = computeDailyAttendance(
      [employee],
      [buildPunch('09:45:00'), buildPunch('17:00:00')],
      [],
      [],
      [],
      rules
    );
    expect(rows[0].lateArrival).toBe('');
  });
});


describe('overnight linking', () => {
  it('links next day punch when overnight rule enabled', () => {
    const rules: SpecialRule[] = [
      {
        id: 'R2',
        name: 'Overnight',
        enabled: true,
        priority: 5,
        scopeType: 'all',
        scopeValues: [],
        dateFrom: '2025-03-01',
        dateTo: '2025-03-01',
        ruleType: 'OVERTIME_OVERNIGHT',
        params: { maxOvernightHours: 12 },
      },
    ];
    const rows = computeDailyAttendance(
      [employee],
      [
        {
          employeeCode: '1001',
          punchDate: '2025-03-02',
          punchTime: '02:00:00',
          rawDateTime: '2025-03-02 02:00:00',
        },
      ],
      [],
      [],
      [],
      rules
    );
    expect(rows[0].lastStamp).toBe('02:00:00');
  });
});
