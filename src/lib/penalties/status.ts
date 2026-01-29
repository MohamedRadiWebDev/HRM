import type { PenaltyValue } from '../types';

export const hasPenalty = (values: PenaltyValue[]) => values.some((value) => value !== '');
