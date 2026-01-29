import { diffMinutes } from '../utils';
import type { PenaltyValue } from '../types';

export const calculatePenalties = ({
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
    return { lateArrival: '', earlyLeave: '', missingStamp: '', absence: '' };
  }
  if (!firstStamp || !lastStamp) {
    return { lateArrival: '', earlyLeave: '', missingStamp: '', absence: totalWorkingHours ? '' : 1 };
  }
  let lateArrival: PenaltyValue = '';
  const lateness = diffMinutes(shiftStart, firstStamp);
  if (lateness > 15 && lateness <= 30) lateArrival = 0.25;
  if (lateness > 30 && lateness <= 60) lateArrival = 0.5;
  if (lateness > 60) lateArrival = 1;

  let earlyLeave: PenaltyValue = '';
  const early = diffMinutes(lastStamp, shiftEnd);
  if (early > 5) earlyLeave = 0.5;

  let missingStamp: PenaltyValue = '';
  if (firstStamp === lastStamp) missingStamp = 0.5;

  let absence: PenaltyValue = '';
  if (!totalWorkingHours) absence = 1;

  return { lateArrival, earlyLeave, missingStamp, absence };
};
