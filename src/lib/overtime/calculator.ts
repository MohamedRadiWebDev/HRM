import { diffMinutes } from '../utils';

export const calculateOvertimeWindows = ({
  shiftStart,
  shiftEnd,
  firstStamp,
  lastStamp,
}: {
  shiftStart: string;
  shiftEnd: string;
  firstStamp?: string;
  lastStamp?: string;
}) => {
  const earlyMinutes = firstStamp ? Math.max(0, diffMinutes(firstStamp, shiftStart)) : 0;
  const lateMinutes = lastStamp ? Math.max(0, diffMinutes(shiftEnd, lastStamp)) : 0;
  return { earlyMinutes, lateMinutes };
};

export const convertOvertimeToDays = (overtimeHours: number) => Math.min((overtimeHours * 24) / 8, 6);
