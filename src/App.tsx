import { useEffect, useMemo, useState } from 'react';
import type { DailyAttendanceRow, ParsedInputs, SummaryRow, TemplateSchema } from './lib/types';
import {
  buildExportRows,
  emptyInputs,
  exportSpecialRulesTemplate,
  exportToExcel,
  parseEmployees,
  parseLeaves,
  parsePunches,
  parseSpecialRules,
  parseTemplateSchema,
  parseTimeRanges,
} from './lib/excel';
import { computeDailyAttendance, computeMonthlySummary, enrichWithSearchIndex } from './lib/attendance';
import { mockEmployees, mockLeaves, mockMissions, mockPermissions, mockPunches, mockRules } from './data/mock';
import { normalizeArabicName, normalizeEmployeeCode } from './lib/utils';

const screens = [
  'لوحة التحكم',
  'رفع الملفات',
  'شبكة الحضور اليومية',
  'الحالات الخاصة',
  'الملخص الشهري',
  'تصدير Excel',
  'التدقيق والتتبع',
] as const;

type Screen = (typeof screens)[number];

const initialInputs: ParsedInputs = {
  employees: mockEmployees,
  punches: mockPunches,
  missions: mockMissions,
  permissions: mockPermissions,
  leaves: mockLeaves,
  specialRules: mockRules,
};

const initialTemplate: TemplateSchema = {
  attendanceHeaders: [
    'كود الموظف',
    'اسم الموظف',
    'التاريخ',
    'بداية الدوام',
    'نهاية الدوام',
    'أول حركة',
    'آخر حركة',
    'إجمالي ساعات العمل',
    'التأخيرات',
    'انصراف بدون اذن',
    'عدم بصمة',
    'غياب بدون اذن',
    'يوجد جزاء',
  ],
  summaryHeaders: ['كود الموظف', 'اسم الموظف', 'إجمالي التأخيرات', 'إجمالي الغياب', 'يوجد خصم'],
};

const mapAttendanceRow = (row: DailyAttendanceRow) => ({
  'كود الموظف': row.employeeCode,
  'اسم الموظف': row.name,
  التاريخ: row.date,
  'بداية الدوام': row.shiftStart,
  'نهاية الدوام': row.shiftEnd,
  'أول حركة': row.firstStamp ?? '',
  'آخر حركة': row.lastStamp ?? '',
  'إجمالي ساعات العمل': row.totalWorkingHours ?? '',
  التأخيرات: row.lateArrival,
  'انصراف بدون اذن': row.earlyLeave,
  'عدم بصمة': row.missingStamp,
  'غياب بدون اذن': row.absence,
  'يوجد جزاء': row.dailyDeductionStatus,
});

const mapSummaryRow = (row: SummaryRow) => ({
  'كود الموظف': row.employeeCode,
  'اسم الموظف': row.name,
  'إجمالي التأخيرات': row.totalLate ?? '',
  'إجمالي الغياب': row.totalAbsence ?? '',
  'يوجد خصم': row.monthlyStatus ?? '',
});

const attendanceHeaderMap = new Set(
  Object.keys(
    mapAttendanceRow({
      employeeCode: '',
      name: '',
      date: '',
      shiftStart: '',
      shiftEnd: '',
      audit: [],
    } as DailyAttendanceRow)
  )
);
const summaryHeaderMap = new Set(
  Object.keys(
    mapSummaryRow({
      employeeCode: '',
      name: '',
      totalLate: 0,
      totalEarly: 0,
      totalMissing: 0,
      totalAbsence: 0,
      totalDisciplinary: 0,
      totalOvertimeHours: 0,
      overtimeDays: 0,
      monthlyStatus: '',
    })
  )
);

const useDebouncedValue = (value: string, delay = 200) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

const filterRows = <T extends { searchIndex: string }>(rows: T[], query: string) => {
  if (!query.trim()) return rows;
  const normalized = normalizeArabicName(normalizeEmployeeCode(query));
  return rows.filter((row) => row.searchIndex.includes(normalized));
};

const validateInputs = (inputs: ParsedInputs) => {
  const issues: string[] = [];
  const employeeCodes = new Set(inputs.employees.map((emp) => emp.employeeCode));
  const punchKeys = new Set<string>();
  inputs.punches.forEach((punch) => {
    if (!employeeCodes.has(punch.employeeCode)) {
      issues.push(`موظف غير معروف في البصمات: ${punch.employeeCode}`);
    }
    const key = `${punch.employeeCode}-${punch.punchDate}-${punch.punchTime}`;
    if (punchKeys.has(key)) issues.push(`بصمة مكررة: ${key}`);
    punchKeys.add(key);
  });
  const validateRanges = (ranges: ParsedInputs['missions'], label: string) => {
    const byDay = new Map<string, ParsedInputs['missions']>();
    for (const range of ranges) {
      if (range.startTime >= range.endTime) {
        issues.push(`نطاق وقت غير صالح في ${label}: ${range.employeeCode} ${range.date}`);
      }
      const key = `${range.employeeCode}-${range.date}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(range);
    }
    for (const [key, values] of byDay) {
      const sorted = values.sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].startTime < sorted[i - 1].endTime) {
          issues.push(`تداخل في ${label}: ${key}`);
        }
      }
    }
  };
  validateRanges(inputs.missions, 'المأموريات');
  validateRanges(inputs.permissions, 'الأذونات');
  return issues;
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('لوحة التحكم');
  const [inputs, setInputs] = useState<ParsedInputs>(initialInputs);
  const [template, setTemplate] = useState<TemplateSchema>(initialTemplate);
  const [importIssues, setImportIssues] = useState<string[]>([]);
  const [parseIssues, setParseIssues] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const dailyRows = useMemo(
    () => computeDailyAttendance(inputs.employees, inputs.punches, inputs.missions, inputs.permissions, inputs.leaves, inputs.specialRules),
    [inputs]
  );
  const summaryRows = useMemo(() => computeMonthlySummary(dailyRows), [dailyRows]);

  const searchableDailyRows = useMemo(
    () =>
      enrichWithSearchIndex(dailyRows, (row) => [row.employeeCode, row.name, row.department, row.section, row.branch]),
    [dailyRows]
  );
  const searchableSummaryRows = useMemo(
    () =>
      enrichWithSearchIndex(summaryRows, (row) => [row.employeeCode, row.name, row.department, row.section, row.branch]),
    [summaryRows]
  );

  const debouncedSearch = useDebouncedValue(searchQuery);
  const filteredDailyRows = useMemo(
    () => filterRows(searchableDailyRows, debouncedSearch),
    [searchableDailyRows, debouncedSearch]
  );
  const filteredSummaryRows = useMemo(
    () => filterRows(searchableSummaryRows, debouncedSearch),
    [searchableSummaryRows, debouncedSearch]
  );

  const handleFile = async (file: File, handler: (buffer: ArrayBuffer) => void) => {
    const buffer = await file.arrayBuffer();
    handler(buffer);
  };

  const resetData = () => {
    setInputs(emptyInputs());
    setImportIssues([]);
    setParseIssues([]);
  };

  useEffect(() => {
    setImportIssues([...parseIssues, ...validateInputs(inputs)]);
  }, [inputs, parseIssues]);

  return (
    <div className="app" dir="rtl">
      <aside className="sidebar">
        <h1>نظام الحضور والانصراف</h1>
        <nav className="nav">
          {screens.map((item) => (
            <button key={item} className={screen === item ? 'active' : ''} onClick={() => setScreen(item)}>
              {item}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        {screen === 'لوحة التحكم' && (
          <section className="grid cols-3">
            <div className="card">
              <div className="section-title">
                <h3>الموظفون</h3>
                <span className="badge success">{inputs.employees.length}</span>
              </div>
              <p className="small">عدد الموظفين المحملين من الماستر داتا.</p>
            </div>
            <div className="card">
              <div className="section-title">
                <h3>سجلات الحضور</h3>
                <span className="badge">{inputs.punches.length}</span>
              </div>
              <p className="small">إجمالي بصمات الحضور الخام.</p>
            </div>
            <div className="card">
              <div className="section-title">
                <h3>الحالات الخاصة</h3>
                <span className="badge warning">{inputs.specialRules.length}</span>
              </div>
              <p className="small">قواعد الاستثناء المفعّلة وغير المفعّلة.</p>
            </div>
            <div className="card">
              <h3>تنبيهات الاستيراد</h3>
              <p className="small">{importIssues.length ? importIssues.join('، ') : 'لا توجد مشاكل حالياً.'}</p>
            </div>
          </section>
        )}

        {screen === 'رفع الملفات' && (
          <section className="card stack">
            <h3>تحميل ملفات الإكسل</h3>
            <div className="grid cols-3">
              <div className="stack">
                <label>بصمة الحضور</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    handleFile(file, (buffer) => {
                      const { punches, invalidRows } = parsePunches(buffer);
                      setInputs((prev) => ({ ...prev, punches }));
                      if (invalidRows.length) {
                        setParseIssues((prev) => [
                          ...prev,
                          ...invalidRows.map((row) => `تنسيق تاريخ غير صالح: ${row}`),
                        ]);
                      }
                    });
                  }}
                />
              </div>
              <div className="stack">
                <label>الماستر داتا</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    handleFile(file, (buffer) => {
                      const employees = parseEmployees(buffer);
                      setInputs((prev) => ({ ...prev, employees }));
                    });
                  }}
                />
              </div>
              <div className="stack">
                <label>قالب الحضور الأساسي</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    handleFile(file, (buffer) => {
                      const schema = parseTemplateSchema(buffer);
                      setTemplate((prev) => ({ ...prev, attendanceHeaders: schema.attendanceHeaders }));
                    });
                  }}
                />
              </div>
              <div className="stack">
                <label>ماموريات</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    handleFile(file, (buffer) => {
                      const missions = parseTimeRanges(buffer, {
                        employeeCode: 'employee_code',
                        date: 'date',
                        startTime: 'start_time',
                        endTime: 'end_time',
                      });
                      setInputs((prev) => ({ ...prev, missions }));
                    });
                  }}
                />
              </div>
              <div className="stack">
                <label>اذونات</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    handleFile(file, (buffer) => {
                      const permissions = parseTimeRanges(buffer, {
                        employeeCode: 'employee_code',
                        date: 'date',
                        startTime: 'start_time',
                        endTime: 'end_time',
                      });
                      setInputs((prev) => ({ ...prev, permissions }));
                    });
                  }}
                />
              </div>
              <div className="stack">
                <label>اجازات</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    handleFile(file, (buffer) => {
                      const leaves = parseLeaves(buffer, {
                        employeeCode: 'employee_code',
                        date: 'date',
                        leaveType: 'leave_type',
                      });
                      setInputs((prev) => ({ ...prev, leaves }));
                    });
                  }}
                />
              </div>
              <div className="stack">
                <label>حالات خاصة</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    handleFile(file, (buffer) => {
                      const { rules, invalidRows } = parseSpecialRules(buffer);
                      setInputs((prev) => ({ ...prev, specialRules: rules }));
                      if (invalidRows.length) {
                        setParseIssues((prev) => [
                          ...prev,
                          ...invalidRows.map((row) => `بيانات حالات خاصة غير صالحة: ${row}`),
                        ]);
                      }
                    });
                  }}
                />
              </div>
            </div>
            <div className="inline">
              <button className="primary" onClick={resetData}>
                مسح البيانات
              </button>
              <button className="primary" onClick={exportSpecialRulesTemplate}>
                تنزيل قالب الحالات الخاصة
              </button>
            </div>
          </section>
        )}

        {screen === 'شبكة الحضور اليومية' && (
          <section className="card">
            <div className="section-title">
              <h3>شبكة الحضور اليومية</h3>
              <input
                placeholder="بحث برقم الموظف أو الاسم أو القسم"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>كود</th>
                  <th>اسم</th>
                  <th>تاريخ</th>
                  <th>أول بصمة</th>
                  <th>آخر بصمة</th>
                  <th>تأخير</th>
                  <th>انصراف مبكر</th>
                  <th>غياب</th>
                </tr>
              </thead>
              <tbody>
                {filteredDailyRows.map((row) => (
                  <tr key={`${row.employeeCode}-${row.date}`}>
                    <td>{row.employeeCode}</td>
                    <td>{row.name}</td>
                    <td>{row.date}</td>
                    <td>{row.firstStamp ?? '-'}</td>
                    <td>{row.lastStamp ?? '-'}</td>
                    <td className={row.lateArrival ? 'highlight' : ''}>{row.lateArrival || ''}</td>
                    <td className={row.earlyLeave ? 'highlight' : ''}>{row.earlyLeave || ''}</td>
                    <td className={row.absence ? 'highlight' : ''}>{row.absence || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {screen === 'الحالات الخاصة' && (
          <section className="card">
            <div className="section-title">
              <h3>الحالات الخاصة</h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الاسم</th>
                  <th>النوع</th>
                  <th>النطاق</th>
                  <th>الفترة</th>
                  <th>الأولوية</th>
                </tr>
              </thead>
              <tbody>
                {inputs.specialRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.id}</td>
                    <td>{rule.name}</td>
                    <td>{rule.ruleType}</td>
                    <td>{rule.scopeType}</td>
                    <td>
                      {rule.dateFrom} → {rule.dateTo}
                    </td>
                    <td>{rule.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {screen === 'الملخص الشهري' && (
          <section className="card">
            <div className="section-title">
              <h3>الملخص الشهري</h3>
              <input
                placeholder="بحث برقم الموظف أو الاسم أو القسم"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>كود</th>
                  <th>اسم</th>
                  <th>تأخيرات</th>
                  <th>غياب</th>
                  <th>خصم</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaryRows.map((row) => (
                  <tr key={row.employeeCode}>
                    <td>{row.employeeCode}</td>
                    <td>{row.name}</td>
                    <td>{row.totalLate}</td>
                    <td>{row.totalAbsence}</td>
                    <td>{row.monthlyStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {screen === 'تصدير Excel' && (
          <section className="card stack">
            <h3>تصدير ملفات الإكسل</h3>
            <p className="small">سيتم الاعتماد على الأعمدة الموجودة في قالب الحضور الذي تم تحميله.</p>
            {!!template.attendanceHeaders.length && (
              <div className="small">
                الأعمدة غير المعروفة سيتم وسمها بـ <span className="badge warning">Needs Mapping</span>.
              </div>
            )}
            <div className="stack small">
              {template.attendanceHeaders
                .filter((header) => !attendanceHeaderMap.has(header))
                .map((header) => (
                  <div key={`attendance-${header}`} className="badge warning">
                    {header} Needs Mapping
                  </div>
                ))}
              {template.summaryHeaders
                .filter((header) => !summaryHeaderMap.has(header))
                .map((header) => (
                  <div key={`summary-${header}`} className="badge warning">
                    {header} Needs Mapping
                  </div>
                ))}
            </div>
            <button
              className="primary"
              onClick={() => {
                const attendanceExport = buildExportRows(
                  template.attendanceHeaders,
                  dailyRows.map(mapAttendanceRow)
                );
                const summaryExport = buildExportRows(
                  template.summaryHeaders,
                  summaryRows.map(mapSummaryRow)
                );
                exportToExcel(attendanceExport, summaryExport, template);
              }}
            >
              إنشاء ملف الحضور والانصراف
            </button>
          </section>
        )}

        {screen === 'التدقيق والتتبع' && (
          <section className="card">
            <h3>التدقيق والتتبع</h3>
            {dailyRows.map((row) => (
              <div key={`${row.employeeCode}-${row.date}`} className="card">
                <div className="section-title">
                  <h4>
                    {row.employeeCode} - {row.name} ({row.date})
                  </h4>
                  <span className="badge">{row.dailyDeductionStatus || 'لا خصومات'}</span>
                </div>
                <ul className="stack small">
                  {row.audit.map((entry, index) => (
                    <li key={`${row.employeeCode}-${row.date}-${index}`}>
                      <strong>{entry.title}</strong>: {entry.detail}{' '}
                      {entry.status === 'needs-mapping' && <span className="badge warning">Needs Mapping</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
