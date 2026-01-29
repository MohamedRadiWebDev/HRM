import { create } from 'zustand';
import type { DailyAttendanceRow, ParsedInputs, SummaryRow, TemplateSchema } from '../lib/types';
import { emptyInputs } from '../lib/excel';

type AttendanceState = {
  inputs: ParsedInputs;
  dailyRows: DailyAttendanceRow[];
  summaryRows: SummaryRow[];
  template: TemplateSchema;
  setInputs: (inputs: ParsedInputs) => void;
  setDailyRows: (rows: DailyAttendanceRow[]) => void;
  setSummaryRows: (rows: SummaryRow[]) => void;
  setTemplate: (template: TemplateSchema) => void;
};

export const useAttendanceStore = create<AttendanceState>((set) => ({
  inputs: emptyInputs(),
  dailyRows: [],
  summaryRows: [],
  template: { attendanceHeaders: [], summaryHeaders: [] },
  setInputs: (inputs) => set({ inputs }),
  setDailyRows: (dailyRows) => set({ dailyRows }),
  setSummaryRows: (summaryRows) => set({ summaryRows }),
  setTemplate: (template) => set({ template }),
}));
