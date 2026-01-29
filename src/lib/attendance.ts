import type {
  DailyAttendanceRow,
  Employee,
  Leave,
  PenaltyValue,
  Punch,
  ShiftRuleConfig,
  SpecialRule,
  SummaryRow,
  TimeRange,
} from './types';
import { addAudit, addHours, buildSearchIndex, clamp, diffMinutes, formatDate } from './utils';
import { applySpecialRules } from './rules';

const defaultShiftConfig: ShiftRuleConfig = {
  defaultStart: '09:00:00',
  defaultDurationHours: 8,
  saturdayServiceHours: 7,
  saturdayOtherHours: 6,
};

export const computeDailyAttendance = (
  employees: Employee[],
  punches: Punch[],
  missions: TimeRange[],
  permissions: TimeRange[],
  leaves: Leave[],
  rules: SpecialRule[],
  config: ShiftRuleConfig = defaultShiftConfig
) => {
  const rows: DailyAttendanceRow[] = [];
  const punchMap = groupPunches(punches);
  const missionMap = groupRanges(missions);
  const permissionMap = groupRanges(permissions);
  const leaveMap = groupLeaves(leaves);
  const overnightConsumed = new Set<string>();

  for (const employee of employees) {
    const dates = collectDates(punchMap, missionMap, permissionMap, leaveMap, employee.employeeCode);
    for (const date of dates) {
      const audit: DailyAttendanceRow['audit'] = [];
      const dayOfWeek = new Date(date).getDay();
      const ruleResult = applySpecialRules(rules, { date, dayOfWeek, employee }, audit);

      const shiftStartBase = employee.shiftStart || config.defaultStart;
      const shiftDuration = dayOfWeek === 6
        ? employee.job === 'خدمات معاونة'
          ? config.saturdayServiceHours
          : config.saturdayOtherHours
        : config.defaultDurationHours;
      let shiftStart = ruleResult.shiftStart ?? shiftStartBase;
      let shiftEnd = ruleResult.shiftEnd ?? addHours(shiftStart, shiftDuration);

      addAudit(audit, 'الدوام', `بداية ${shiftStart} - نهاية ${shiftEnd}`);

      const punchKey = `${employee.employeeCode}-${date}`;
      const dailyPunches = (punchMap.get(punchKey) ?? []).filter(
        (punch) => !overnightConsumed.has(`${punch.employeeCode}-${punch.punchDate}-${punch.punchTime}`)
      );
      const dailyMissions = missionMap.get(punchKey) ?? [];
      const dailyPermissions = permissionMap.get(punchKey) ?? [];
      const dailyLeave = leaveMap.get(punchKey);

      if (ruleResult.ignoreBiometric) {
        addAudit(audit, 'البصمات', 'تم تجاهل البصمات حسب حالة خاصة', 'warning');
      }

      const punchTimes = ruleResult.ignoreBiometric ? [] : dailyPunches.map((p) => p.punchTime);
      const checkIn = punchTimes.length ? punchTimes[0] : undefined;
      let checkOut = punchTimes.length ? punchTimes[punchTimes.length - 1] : undefined;
      if (punchTimes.length > 1) {
        addAudit(audit, 'البصمات', `تم تسجيل ${punchTimes.length} بصمات، اعتمد أول وآخر بصمة`);
      } else if (punchTimes.length === 1) {
        addAudit(audit, 'البصمات', 'تم تسجيل بصمة واحدة فقط', 'warning');
      } else {
        addAudit(audit, 'البصمات', 'لا توجد بصمات', 'warning');
      }

      const missionStart = dailyMissions[0]?.startTime;
      const missionEnd = dailyMissions[0]?.endTime;
      const permissionStart = dailyPermissions[0]?.startTime;
      const permissionEnd = dailyPermissions[0]?.endTime;

      let firstStamp = minTime([checkIn, missionStart, permissionStart]);
      let lastStamp = maxTime([checkOut, missionEnd, permissionEnd]);

      if (!lastStamp && ruleResult.overtimeOvernight?.allowLinking) {
        const nextDate = formatDate(new Date(new Date(date).setDate(new Date(date).getDate() + 1)));
        const nextPunchKey = `${employee.employeeCode}-${nextDate}`;
        const nextPunches = punchMap.get(nextPunchKey) ?? [];
        const nextPunch = nextPunches[0];
        if (nextPunch) {
          const overnightMinutes = diffMinutes(shiftEnd, nextPunch.punchTime);
          if (overnightMinutes <= ruleResult.overtimeOvernight.maxOvernightHours * 60) {
            lastStamp = nextPunch.punchTime;
            const consumedKey = `${nextPunch.employeeCode}-${nextPunch.punchDate}-${nextPunch.punchTime}`;
            overnightConsumed.add(consumedKey);
            addAudit(audit, 'مبيت ليلي', `تم الربط مع بصمة اليوم التالي ${nextPunch.punchTime}`);
          } else {
            addAudit(audit, 'مبيت ليلي', 'تجاوز الحد الأقصى للمبيت', 'warning');
          }
        } else {
          addAudit(audit, 'مبيت ليلي', 'لا توجد بصمة لليوم التالي', 'warning');
        }
      }

      if (firstStamp) {
        addAudit(audit, 'أول حركة', `تم اعتماد ${firstStamp}`);
      }
      if (lastStamp) {
        addAudit(audit, 'آخر حركة', `تم اعتماد ${lastStamp}`);
      }

      const totalWorkingHours = firstStamp && lastStamp ? diffMinutes(firstStamp, lastStamp) / 60 : undefined;
      if (totalWorkingHours !== undefined) {
        addAudit(audit, 'إجمالي ساعات العمل', `${totalWorkingHours.toFixed(2)} ساعة`);
      }

      const suppressionReason = determineSuppression(employee, date, dailyLeave, ruleResult.suppressPenalties);
      if (suppressionReason) {
        addAudit(audit, 'استثناءات', suppressionReason, 'warning');
      }

      const penalties = computePenalties({
        shiftStart,
        shiftEnd,
        firstStamp,
        lastStamp,
        totalWorkingHours,
        suppressed: Boolean(suppressionReason),
      });

      const mergedPenalties: typeof penalties = {
        ...penalties,
        ...(ruleResult.penaltyOverrides ?? {}),
      };

      if (ruleResult.penaltyOverrides) {
        addAudit(audit, 'جزاءات', 'تم تطبيق تجاوز جزاءات حسب حالة خاصة', 'warning');
      }

      const dailyDeductionStatus =
        [mergedPenalties.lateArrival, mergedPenalties.earlyLeave, mergedPenalties.missingStamp, mergedPenalties.absence].some(
          (value) => value && value !== ''
        )
          ? 'يوجد جزاء'
          : '';

      rows.push({
        employeeCode: employee.employeeCode,
        name: employee.name,
        date,
        department: employee.department,
        section: employee.section,
        job: employee.job,
        branch: employee.branch,
        shiftStart,
        shiftEnd,
        firstStamp,
        lastStamp,
        totalWorkingHours,
        lateArrival: mergedPenalties.lateArrival,
        earlyLeave: mergedPenalties.earlyLeave,
        missingStamp: mergedPenalties.missingStamp,
        absence: mergedPenalties.absence,
        disciplinary: '',
        dailyDeductionStatus,
        overtimeDay: 0,
        overtimeNight: 0,
        overtimeTotal: 0,
        audit,
      });
    }
  }

  return rows;
};

export const computeMonthlySummary = (rows: DailyAttendanceRow[]): SummaryRow[] => {
  const summaryMap = new Map<string, SummaryRow>();
  for (const row of rows) {
    const key = row.employeeCode;
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        employeeCode: row.employeeCode,
        name: row.name,
        department: row.department,
        section: row.section,
        branch: row.branch,
        totalLate: 0,
        totalEarly: 0,
        totalMissing: 0,
        totalAbsence: 0,
        totalDisciplinary: 0,
        totalOvertimeHours: 0,
        overtimeDays: 0,
        monthlyStatus: '',
      });
    }
    const summary = summaryMap.get(key)!;
    summary.totalLate = sumPenalty(summary.totalLate, row.lateArrival);
    summary.totalEarly = sumPenalty(summary.totalEarly, row.earlyLeave);
    summary.totalMissing = sumPenalty(summary.totalMissing, row.missingStamp);
    summary.totalAbsence = sumPenalty(summary.totalAbsence, row.absence) * 2;
    summary.totalDisciplinary = sumPenalty(summary.totalDisciplinary, row.disciplinary);
    summary.totalOvertimeHours += row.overtimeTotal ?? 0;
    summary.overtimeDays = clamp((summary.totalOvertimeHours * 24) / 8, 0, 6);
    if (row.dailyDeductionStatus) {
      summary.monthlyStatus = 'يوجد خصم';
    }
  }
  return Array.from(summaryMap.values());
};

export const enrichWithSearchIndex = <T>(
  rows: T[],
  getter: (row: T) => Array<string | undefined>
): Array<T & { searchIndex: string }> =>
  rows.map((row) => ({ ...row, searchIndex: buildSearchIndex(getter(row)) }));

const groupPunches = (punches: Punch[]) => {
  const map = new Map<string, Punch[]>();
  for (const punch of punches) {
    const key = `${punch.employeeCode}-${punch.punchDate}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(punch);
  }
  for (const [key, value] of map.entries()) {
    map.set(
      key,
      value.sort((a, b) => a.punchTime.localeCompare(b.punchTime))
    );
  }
  return map;
};

const groupRanges = (ranges: TimeRange[]) => {
  const map = new Map<string, TimeRange[]>();
  for (const range of ranges) {
    const key = `${range.employeeCode}-${range.date}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(range);
  }
  return map;
};

const groupLeaves = (leaves: Leave[]) => {
  const map = new Map<string, Leave>();
  for (const leave of leaves) {
    const key = `${leave.employeeCode}-${leave.date}`;
    map.set(key, leave);
  }
  return map;
};

const collectDates = (
  punchMap: Map<string, Punch[]>,
  missionMap: Map<string, TimeRange[]>,
  permissionMap: Map<string, TimeRange[]>,
  leaveMap: Map<string, Leave>,
  employeeCode: string
) => {
  const dates = new Set<string>();
  for (const key of punchMap.keys()) {
    if (key.startsWith(`${employeeCode}-`)) dates.add(key.split('-').slice(1).join('-'));
  }
  for (const key of missionMap.keys()) {
    if (key.startsWith(`${employeeCode}-`)) dates.add(key.split('-').slice(1).join('-'));
  }
  for (const key of permissionMap.keys()) {
    if (key.startsWith(`${employeeCode}-`)) dates.add(key.split('-').slice(1).join('-'));
  }
  for (const key of leaveMap.keys()) {
    if (key.startsWith(`${employeeCode}-`)) dates.add(key.split('-').slice(1).join('-'));
  }
  return Array.from(dates).sort();
};

const minTime = (times: Array<string | undefined>) => {
  const filtered = times.filter(Boolean) as string[];
  return filtered.length ? filtered.sort()[0] : undefined;
};

const maxTime = (times: Array<string | undefined>) => {
  const filtered = times.filter(Boolean) as string[];
  return filtered.length ? filtered.sort()[filtered.length - 1] : undefined;
};

const determineSuppression = (
  employee: Employee,
  date: string,
  leave: Leave | undefined,
  ruleSuppressed: boolean | undefined
) => {
  if (ruleSuppressed) return 'تم إعفاء الحضور حسب حالة خاصة';
  if (leave) return `تم إعفاء الحضور بسبب اجازة (${leave.leaveType})`;
  if (employee.hireDate && date < employee.hireDate) return 'فترة قبل التعيين';
  if (employee.terminationDate && date > employee.terminationDate) return 'فترة بعد ترك العمل';
  return '';
};

const computePenalties = ({
  shiftStart,
  shiftEnd,
  firstStamp,
  lastStamp,
  totalWorkingHours,
  suppressed,
}: {
  shiftStart: string;
  shiftEnd: string;
  firstStamp?: string;
  lastStamp?: string;
  totalWorkingHours?: number;
  suppressed: boolean;
}): { lateArrival: PenaltyValue; earlyLeave: PenaltyValue; missingStamp: PenaltyValue; absence: PenaltyValue } => {
  if (suppressed) {
    return {
      lateArrival: '',
      earlyLeave: '',
      missingStamp: '',
      absence: '',
    };
  }
  if (!firstStamp || !lastStamp) {
    return {
      lateArrival: '',
      earlyLeave: '',
      missingStamp: '',
      absence: totalWorkingHours ? '' : 1,
    };
  }

  let lateArrival: number | '' = '';
  const lateness = diffMinutes(shiftStart, firstStamp);
  if (lateness > 15 && lateness <= 30) lateArrival = 0.25;
  if (lateness > 30 && lateness <= 60) lateArrival = 0.5;
  if (lateness > 60) lateArrival = 1;

  let earlyLeave: number | '' = '';
  const early = diffMinutes(lastStamp, shiftEnd);
  if (early > 5) earlyLeave = 0.5;

  let missingStamp: number | '' = '';
  if (firstStamp === lastStamp) missingStamp = 0.5;

  let absence: number | '' = '';
  if (!totalWorkingHours) absence = 1;

  return { lateArrival, earlyLeave, missingStamp, absence };
};

const sumPenalty = (current: number, value?: number | '') => {
  if (value === '' || value === undefined) return current;
  return current + value;
};
