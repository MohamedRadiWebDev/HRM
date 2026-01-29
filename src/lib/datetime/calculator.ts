import { addHours, diffMinutes } from '../utils';

export const calculateShiftEnd = (shiftStart: string, durationHours: number) => addHours(shiftStart, durationHours);

export const calculateMinutesDiff = (start: string, end: string) => diffMinutes(start, end);
