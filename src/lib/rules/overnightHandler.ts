export type OvernightLinkResult = {
  linkedCheckout?: string;
  reason?: string;
};

export const linkOvernightPunch = (shiftEnd: string, nextPunch: string, maxOvernightHours: number): OvernightLinkResult => {
  const shiftDate = new Date(`1970-01-01T${shiftEnd}`);
  const punchDate = new Date(`1970-01-01T${nextPunch}`);
  const diffHours = (punchDate.getTime() - shiftDate.getTime()) / 3600000;
  if (diffHours < 0) return { reason: 'invalid-range' };
  if (diffHours > maxOvernightHours) return { reason: 'exceeds-max' };
  return { linkedCheckout: nextPunch };
};
